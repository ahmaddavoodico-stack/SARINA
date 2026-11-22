-- Public specialist portrait with owner-controlled upload and narrowly scoped profile update.
alter table public.expert_profiles add column if not exists avatar_path text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('expert-avatars','expert-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists expert_avatars_owner_insert on storage.objects;
create policy expert_avatars_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='expert-avatars' and (storage.foldername(name))[2]=auth.uid()::text
and exists(select 1 from public.expert_profiles p where p.id::text=(storage.foldername(name))[1] and p.user_id=auth.uid()));

drop policy if exists expert_avatars_owner_delete on storage.objects;
create policy expert_avatars_owner_delete on storage.objects for delete to authenticated
using (bucket_id='expert-avatars' and (storage.foldername(name))[2]=auth.uid()::text
and exists(select 1 from public.expert_profiles p where p.id::text=(storage.foldername(name))[1] and p.user_id=auth.uid()));

create or replace function public.set_expert_profile_avatar(p_avatar_path text)
returns void language plpgsql security definer set search_path='' as $
declare v_profile_id text; v_owner_id text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_profile_id:=split_part(coalesce(p_avatar_path,''),'/',1);
 v_owner_id:=split_part(coalesce(p_avatar_path,''),'/',2);
 if v_profile_id='' or v_owner_id<>auth.uid()::text or split_part(coalesce(p_avatar_path,''),'/',3)='' then raise exception 'Invalid avatar path'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='expert-avatars' and o.name=p_avatar_path) then raise exception 'Avatar file not found'; end if;
 update public.expert_profiles set avatar_path=p_avatar_path,updated_at=now() where id::text=v_profile_id and user_id=auth.uid();
 if not found then raise exception 'Expert profile not found'; end if;
end; $$;
revoke all on function public.set_expert_profile_avatar(text) from public, anon;
grant execute on function public.set_expert_profile_avatar(text) to authenticated;
