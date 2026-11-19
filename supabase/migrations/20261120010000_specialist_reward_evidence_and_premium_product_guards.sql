begin;

alter table public.marketplace_products
  add column if not exists is_sarina_premium boolean not null default false;
comment on column public.marketplace_products.is_sarina_premium is
  'Central-admin designation for SARINA premium products; only admin-controlled reward rules may award specialist credits.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='specialist_workspace_billing_stays_disabled' and conrelid='public.specialist_workspace_pricing'::regclass) then
    alter table public.specialist_workspace_pricing add constraint specialist_workspace_billing_stays_disabled check (billing_enabled=false);
  end if;
end $$;

create or replace function private.guard_sarina_premium_product_flag()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' then
    if new.is_sarina_premium and not (select private.is_sarina_admin()) then
      raise exception 'admin_required_to_designate_premium_product' using errcode='42501';
    end if;
  elsif new.is_sarina_premium is distinct from old.is_sarina_premium
    and not (select private.is_sarina_admin()) then
    raise exception 'admin_required_to_change_premium_product_flag' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_sarina_premium_product_flag on public.marketplace_products;
create trigger guard_sarina_premium_product_flag before insert or update of is_sarina_premium
on public.marketplace_products for each row execute function private.guard_sarina_premium_product_flag();

create or replace function public.admin_create_specialist_productivity_reward_rule(
  p_product_id uuid,p_credit_units integer,p_minimum_measurements integer default 1,p_rule_notes text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_rule_id uuid; v_admin_user_id uuid;
begin
  if not (select private.is_sarina_admin()) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_credit_units is null or p_credit_units<=0 or p_minimum_measurements is null or p_minimum_measurements<=0 then
    raise exception 'invalid_reward_rule_values';
  end if;
  update public.marketplace_products set is_sarina_premium=true,updated_at=now()
   where id=p_product_id and status='published';
  if not found then raise exception 'published_product_not_found'; end if;
  select id into v_admin_user_id from public.users where auth_user_id=(select auth.uid()) limit 1;
  insert into public.specialist_productivity_reward_rules(product_id,credit_units,minimum_measurements,requires_expert_review,is_active,rule_notes,created_by)
  values(p_product_id,p_credit_units,p_minimum_measurements,true,true,p_rule_notes,v_admin_user_id)
  returning id into v_rule_id;
  return v_rule_id;
end;
$$;
revoke all on function public.admin_create_specialist_productivity_reward_rule(uuid,integer,integer,text) from public,anon;
grant execute on function public.admin_create_specialist_productivity_reward_rule(uuid,integer,integer,text) to authenticated;

create or replace function private.validate_specialist_productivity_reward_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_rule public.specialist_productivity_reward_rules%rowtype;
  v_product_premium boolean; v_product_status text;
  v_action_farm_id uuid; v_action_completed_at timestamptz;
  v_measurement_farm_id uuid; v_measurement_observed_at timestamptz;
  v_measurement_count integer;
begin
  if new.status in ('declined','cancelled') then return new; end if;
  select is_sarina_premium,status into v_product_premium,v_product_status
    from public.marketplace_products where id=new.product_id;
  if not found or v_product_premium is distinct from true or v_product_status<>'published' then
    raise exception 'product_is_not_published_sarina_premium';
  end if;
  select * into v_rule from public.specialist_productivity_reward_rules r
   where r.product_id=new.product_id and r.is_active and now()>=r.valid_from
     and (r.valid_until is null or now()<r.valid_until) order by r.created_at desc limit 1;
  if not found then raise exception 'active_reward_rule_not_found'; end if;
  if new.requested_credit_units<>v_rule.credit_units then raise exception 'requested_reward_units_do_not_match_rule'; end if;
  if new.improvement_action_id is null or new.measurement_id is null then
    raise exception 'completed_action_and_measurement_required';
  end if;
  select p.farm_id,a.completed_at into v_action_farm_id,v_action_completed_at
    from public.farm_improvement_actions a join public.farm_improvement_plans p on p.id=a.plan_id
   where a.id=new.improvement_action_id and a.status='completed' and a.completed_at is not null;
  if not found or v_action_farm_id is distinct from new.farm_id then
    raise exception 'completed_action_must_belong_to_reward_farm';
  end if;
  select farm_id,observed_at into v_measurement_farm_id,v_measurement_observed_at
    from public.farm_productivity_measurements where id=new.measurement_id;
  if not found or v_measurement_farm_id is distinct from new.farm_id or v_measurement_observed_at<v_action_completed_at then
    raise exception 'post_action_measurement_for_same_farm_required';
  end if;
  select count(*)::integer into v_measurement_count from public.farm_productivity_measurements m
   where m.farm_id=new.farm_id and m.observed_at>=v_action_completed_at;
  if v_measurement_count<v_rule.minimum_measurements then raise exception 'minimum_post_action_measurements_not_met'; end if;
  return new;
end;
$$;
drop trigger if exists validate_specialist_productivity_reward_event on public.specialist_productivity_reward_events;
create trigger validate_specialist_productivity_reward_event before insert or update
on public.specialist_productivity_reward_events for each row execute function private.validate_specialist_productivity_reward_event();

create or replace function public.review_specialist_productivity_reward(p_reward_event_id uuid,p_approve boolean,p_review_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_event public.specialist_productivity_reward_events%rowtype;
  v_rule public.specialist_productivity_reward_rules%rowtype;
  v_admin_user_id uuid; v_multiplier numeric; v_awarded_units integer;
begin
  if not (select private.is_sarina_admin()) then raise exception 'admin_required' using errcode='42501'; end if;
  select id into v_admin_user_id from public.users where auth_user_id=(select auth.uid()) limit 1;
  select * into v_event from public.specialist_productivity_reward_events where id=p_reward_event_id for update;
  if not found then raise exception 'reward_event_not_found'; end if;
  if v_event.status<>'pending' then raise exception 'reward_event_already_reviewed'; end if;
  if p_approve then
    select * into v_rule from public.specialist_productivity_reward_rules r
     where r.product_id=v_event.product_id and r.is_active and now()>=r.valid_from
       and (r.valid_until is null or now()<r.valid_until) order by r.created_at desc limit 1;
    if not found or v_rule.credit_units<>v_event.requested_credit_units then raise exception 'active_reward_rule_changed_or_missing'; end if;
    select reward_multiplier into v_multiplier from public.specialist_workspace_pricing where id=1;
    v_awarded_units:=round(v_rule.credit_units*coalesce(v_multiplier,0))::integer;
    if v_awarded_units<=0 then raise exception 'reward_multiplier_disables_credit'; end if;
    insert into public.specialist_workspace_credit_ledger(expert_profile_id,delta_units,entry_type,source_event_id,idempotency_key,description_code,metadata)
    values(v_event.expert_profile_id,v_awarded_units,'product_reward',v_event.id,'specialist-product-reward:'||v_event.id::text,
      'premium_product_productivity_reward',jsonb_build_object('farm_id',v_event.farm_id,'product_id',v_event.product_id,
      'improvement_action_id',v_event.improvement_action_id,'measurement_id',v_event.measurement_id,
      'base_credit_units',v_rule.credit_units,'reward_multiplier',v_multiplier));
    update public.specialist_productivity_reward_events set status='credited',awarded_credit_units=v_awarded_units,
      reviewed_by=v_admin_user_id,reviewed_at=now(),review_note=p_review_note,updated_at=now() where id=v_event.id;
  else
    update public.specialist_productivity_reward_events set status='declined',reviewed_by=v_admin_user_id,
      reviewed_at=now(),review_note=p_review_note,updated_at=now() where id=v_event.id;
  end if;
  return v_event.id;
end;
$$;
revoke all on function public.review_specialist_productivity_reward(uuid,boolean,text) from public,anon;
grant execute on function public.review_specialist_productivity_reward(uuid,boolean,text) to authenticated;
commit;