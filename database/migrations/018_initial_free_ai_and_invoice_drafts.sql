-- 018: initial free-AI policy and draft invoice generation for paid human services.
alter table public.service_contracts
  add constraint service_contracts_initial_ai_free_check
  check (service_type <> 'ai_service' or base_amount = 0),
  add constraint service_contracts_initial_no_platform_fee_check
  check (platform_fee_model = 'none' and coalesce(platform_fee_rate,0) = 0);

drop policy if exists service_contracts_farmer_draft_insert on public.service_contracts;
create policy service_contracts_farmer_draft_insert on public.service_contracts
for insert to authenticated
with check (
  farmer_user_id = public.current_sarina_user_id()
  and status='draft'
  and farmer_accepted_at is null and expert_accepted_at is null
  and proposed_at is null and completed_at is null and cancelled_at is null
  and platform_fee_model='none' and coalesce(platform_fee_rate,0)=0
  and (service_type <> 'ai_service' or base_amount=0)
  and (expert_profile_id is null or exists (
    select 1 from public.expert_profiles ep where ep.id=service_contracts.expert_profile_id
      and ep.verification_status='verified'
  ))
  and (farm_id is null or exists (
    select 1 from public.farms f where f.id=service_contracts.farm_id
      and f.owner_user_id=public.current_sarina_user_id()
  ))
);

alter table public.contract_invoices
  add column if not exists tax_status text not null default 'not_configured'
    check (tax_status in ('not_configured','reviewed'));

create table if not exists public.contract_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.contract_invoices(id) on delete restrict,
  item_kind text not null check (item_kind in ('human_expert_service','field_service','result_share','other')),
  description text not null,
  quantity numeric(18,4) not null default 1 check (quantity > 0),
  unit_amount numeric(18,4) not null check (unit_amount >= 0),
  line_total numeric(18,4) not null check (line_total >= 0),
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  check (line_total = round(quantity * unit_amount,4))
);
create index if not exists contract_invoice_items_invoice_idx on public.contract_invoice_items(invoice_id,created_at);
alter table public.contract_invoice_items enable row level security;
drop policy if exists contract_invoice_items_party_select on public.contract_invoice_items;
create policy contract_invoice_items_party_select on public.contract_invoice_items for select to authenticated
using (exists (
  select 1 from public.contract_invoices i join public.service_contracts c on c.id=i.contract_id
  where i.id=contract_invoice_items.invoice_id
    and (c.farmer_user_id=public.current_sarina_user_id()
      or exists(select 1 from public.expert_profiles ep where ep.id=c.expert_profile_id and ep.user_id=public.current_sarina_user_id()))
));
revoke all on public.contract_invoice_items from public,anon,authenticated;
grant select on public.contract_invoice_items to authenticated;

create unique index if not exists contract_invoices_one_open_per_contract_idx
on public.contract_invoices(contract_id)
where status in ('draft','issued','partially_paid','paid','overdue');

create or replace function public.transition_service_contract(
  p_contract_id uuid,p_actor_user_id uuid,p_action text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_contract public.service_contracts%rowtype;
  v_is_farmer boolean;
  v_is_expert boolean;
  v_now timestamptz:=now();
  v_new_status text;
  v_invoice_id uuid;
  v_invoice_number text;
begin
  if p_action not in ('propose','accept','cancel') then raise exception 'Unsupported contract action' using errcode='22023'; end if;
  select * into v_contract from public.service_contracts where id=p_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  v_is_farmer:=v_contract.farmer_user_id=p_actor_user_id;
  v_is_expert:=false;
  if v_contract.expert_profile_id is not null then
    select exists(select 1 from public.expert_profiles ep where ep.id=v_contract.expert_profile_id
      and ep.user_id=p_actor_user_id and ep.verification_status='verified') into v_is_expert;
  end if;

  if p_action='propose' then
    if not v_is_farmer or v_contract.status<>'draft' then raise exception 'Only the contract farmer can propose a draft' using errcode='42501'; end if;
    update public.service_contracts set status='proposed',proposed_at=v_now,updated_at=v_now where id=p_contract_id;
    insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
      values(p_contract_id,p_actor_user_id,'offer_proposed',jsonb_build_object('version',v_contract.version,'terms_snapshot',v_contract.terms_snapshot));
    v_new_status:='proposed';
  elsif p_action='accept' then
    if not v_is_farmer and not v_is_expert then raise exception 'Actor is not a required contract party' using errcode='42501'; end if;
    if v_contract.status<>'proposed' then raise exception 'Only proposed contracts can be accepted' using errcode='22023'; end if;
    if v_is_farmer then
      if v_contract.farmer_accepted_at is not null then raise exception 'Farmer has already accepted this version' using errcode='22023'; end if;
      update public.service_contracts set farmer_accepted_at=v_now,updated_at=v_now where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'farmer_accepted',jsonb_build_object('version',v_contract.version));
    else
      if v_contract.expert_accepted_at is not null then raise exception 'Expert has already accepted this version' using errcode='22023'; end if;
      update public.service_contracts set expert_accepted_at=v_now,updated_at=v_now where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'expert_accepted',jsonb_build_object('version',v_contract.version));
    end if;
    select * into v_contract from public.service_contracts where id=p_contract_id for update;
    if v_contract.farmer_accepted_at is not null and (v_contract.expert_profile_id is null or v_contract.expert_accepted_at is not null) then
      if v_contract.service_type='ai_service' and v_contract.base_amount<>0 then raise exception 'SARINA AI services are free in the initial launch stage' using errcode='22023'; end if;
      update public.service_contracts set status='accepted',updated_at=v_now where id=p_contract_id;
      insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
        values(p_contract_id,p_actor_user_id,'contract_fully_accepted',jsonb_build_object('version',v_contract.version));
      v_new_status:='accepted';
      if v_contract.service_type in ('human_expert','hybrid','field_service') and v_contract.base_amount>0 then
        select id into v_invoice_id from public.contract_invoices where contract_id=p_contract_id
          and status in ('draft','issued','partially_paid','paid','overdue') limit 1;
        if v_invoice_id is null then
          v_invoice_number:='SAR-'||to_char(v_now,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
          insert into public.contract_invoices(contract_id,invoice_number,status,currency_code,subtotal,tax_amount,discount_amount,total_amount,tax_status)
            values(p_contract_id,v_invoice_number,'draft',v_contract.currency_code,v_contract.base_amount,0,0,v_contract.base_amount,'not_configured')
            returning id into v_invoice_id;
          insert into public.contract_invoice_items(invoice_id,item_kind,description,quantity,unit_amount,line_total,currency_code)
            values(v_invoice_id,case when v_contract.service_type='field_service' then 'field_service' else 'human_expert_service' end,
              case when v_contract.service_type='field_service' then 'Agreed field service — '||v_contract.contract_code else 'Agreed human expert service — '||v_contract.contract_code end,
              1,v_contract.base_amount,v_contract.base_amount,v_contract.currency_code);
          insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
            values(p_contract_id,p_actor_user_id,'invoice_draft_created',jsonb_build_object('invoice_id',v_invoice_id,
              'invoice_number',v_invoice_number,'amount',v_contract.base_amount,'currency',v_contract.currency_code,
              'tax_status','not_configured','platform_fee',0));
        end if;
      end if;
    else v_new_status:='proposed'; end if;
  else
    if (not v_is_farmer and not v_is_expert) or v_contract.status not in ('draft','proposed') then raise exception 'Actor cannot cancel this contract' using errcode='42501'; end if;
    update public.service_contracts set status='cancelled',cancelled_at=v_now,updated_at=v_now where id=p_contract_id;
    insert into public.contract_audit_events(contract_id,actor_user_id,event_type,event_payload)
      values(p_contract_id,p_actor_user_id,'contract_cancelled',jsonb_build_object('version',v_contract.version));
    v_new_status:='cancelled';
  end if;
  return jsonb_build_object('contract_id',p_contract_id,'status',v_new_status,'version',v_contract.version,'invoice_id',v_invoice_id);
end;
$$;
revoke all on function public.transition_service_contract(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.transition_service_contract(uuid,uuid,text) to service_role;
