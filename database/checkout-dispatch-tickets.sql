
-- Managed pg_net gives its request queue broad defaults. Queue only a short-lived
-- one-time ticket. The durable worker credential stays in Vault and Render.
create table navigator_private.checkout_dispatch_tickets (
  ticket uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null default now()+interval '5 minutes'
);
alter table navigator_private.checkout_dispatch_tickets enable row level security;
revoke all on navigator_private.checkout_dispatch_tickets from public, anon, authenticated;

create function navigator_recovery_internal.claim_checkout_dispatch(p_token text,p_ticket uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_token is null or length(p_token)<>64 or not exists (
    select 1 from vault.decrypted_secrets where name='navigator_checkout_recovery_worker' and decrypted_secret=p_token
  ) then raise insufficient_privilege; end if;
  delete from navigator_private.checkout_dispatch_tickets where ticket=p_ticket and expires_at>now();
  return found;
end $$;
revoke all on function navigator_recovery_internal.claim_checkout_dispatch(text,uuid) from public;
grant execute on function navigator_recovery_internal.claim_checkout_dispatch(text,uuid) to anon;
create function public.navigator_claim_checkout_dispatch(p_token text,p_ticket uuid)
returns boolean language sql security invoker set search_path='' as $$
  select navigator_recovery_internal.claim_checkout_dispatch(p_token,p_ticket);
$$;
revoke all on function public.navigator_claim_checkout_dispatch(text,uuid) from public, authenticated;
grant execute on function public.navigator_claim_checkout_dispatch(text,uuid) to anon;

select cron.alter_job(job_id=>jobid,active=>false,command=>$job$
  delete from navigator_private.checkout_recovery where updated_at<now()-interval '30 days';
  delete from navigator_private.checkout_dispatch_tickets where expires_at<=now();
  with issued as (
    insert into navigator_private.checkout_dispatch_tickets(ticket)
    select gen_random_uuid()
    where exists(select 1 from navigator_private.checkout_recovery
      where due_at<=now() and consent_at is not null and claim is null)
    returning ticket
  )
  select net.http_post(
    url:='https://posh-inquiry-navigator-staging.onrender.com/api/checkout-recovery/dispatch',
    headers:=jsonb_build_object('X-Navigator-Dispatch',ticket),
    timeout_milliseconds:=90000
  ) from issued;
$job$) from cron.job where jobname='navigator-checkout-recovery';

