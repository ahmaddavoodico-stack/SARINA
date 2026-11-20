-- SIACP replay protection. Only the service-role Edge Function may consume nonces.
create schema if not exists private;

create table if not exists private.siacp_nonce_registry (
  sender text not null,
  nonce text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  primary key (sender, nonce)
);
create index if not exists siacp_nonce_registry_expiry_idx
  on private.siacp_nonce_registry (expires_at);

alter table private.siacp_nonce_registry enable row level security;
revoke all on private.siacp_nonce_registry from public, anon, authenticated;

create or replace function public.siacp_consume_nonce(
  p_sender text,
  p_nonce text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_sender is null or length(p_sender) < 1 or length(p_sender) > 120
     or p_nonce is null or length(p_nonce) < 16 or length(p_nonce) > 64
     or p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '15 minutes' then
    raise exception 'invalid SIACP nonce request';
  end if;
  delete from private.siacp_nonce_registry where expires_at <= now();
  insert into private.siacp_nonce_registry(sender, nonce, expires_at)
  values (p_sender, p_nonce, p_expires_at)
  on conflict (sender, nonce) do nothing;
  return found;
end;
$$;

revoke all on function public.siacp_consume_nonce(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.siacp_consume_nonce(text,text,timestamptz) to service_role;
