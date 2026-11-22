drop policy if exists expert_profiles_admin_review_update on public.expert_profiles;
create policy expert_profiles_admin_review_update
on public.expert_profiles for update to authenticated
using (coalesce(public.is_sarina_admin(), false))
with check (coalesce(public.is_sarina_admin(), false));