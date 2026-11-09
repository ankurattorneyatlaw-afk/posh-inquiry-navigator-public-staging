
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema navigator_recovery_internal;
revoke all on schema navigator_recovery_internal from public;

create table navigator_private.checkout_recovery (
  buyer uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('checklist','compliance-checklist','aggrieved','respondent','essential','professional','advanced')),
  attempt uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  failed boolean not null default false,
  consent_at timestamptz,
  email_hash bytea not null,
  unsubscribe uuid not null unique default gen_random_uuid(),
  due_at timestamptz,
  reminders smallint not null default 0 check (reminders between 0 and 2),
  claim uuid unique,
  last_result text,
  primary key (buyer,product)
);
alter table navigator_private.checkout_recovery enable row level security;
revoke all on navigator_private.checkout_recovery from public, anon, authenticated;
create index checkout_recovery_due on navigator_private.checkout_recovery(due_at) where due_at is not null;

create function navigator_recovery_internal.checkout_recovery_buyer(p_token text,p_product text,p_action text,p_opt_in boolean,p_attempt uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_buyer uuid := auth.uid();
  v_email_hash bytea;
  v_attempt uuid;
begin
  if v_buyer is null or not navigator_private.verified_session() or p_token is null or length(p_token)<>64
     or not exists (select 1 from navigator_private.checklist_checkout_key where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'))
  then raise insufficient_privilege; end if;
  select sha256(convert_to(lower(email),'UTF8')) into v_email_hash from auth.users
  where id=v_buyer and email_confirmed_at is not null and not is_anonymous;
  if v_email_hash is null then raise insufficient_privilege; end if;

  if p_action='begin' and p_opt_in is not null then
    insert into navigator_private.checkout_recovery as r(buyer,product,email_hash,consent_at,due_at)
    values(v_buyer,p_product,v_email_hash,case when p_opt_in then now() end,case when p_opt_in then now()+interval '1 hour' end)
    on conflict (buyer,product) do update set
      attempt=gen_random_uuid(),updated_at=now(),failed=false,
      claim=case when p_opt_in and r.email_hash=v_email_hash and r.consent_at is not null then r.claim end,
      started_at=case when r.updated_at<now()-interval '30 days' then now() else r.started_at end,
      email_hash=v_email_hash,
      consent_at=case when p_opt_in then coalesce(r.consent_at,now()) end,
      unsubscribe=case when p_opt_in and (r.consent_at is null or r.email_hash<>v_email_hash) then gen_random_uuid() else r.unsubscribe end,
      reminders=case when r.updated_at<now()-interval '30 days' then 0 else r.reminders end,
      due_at=case when p_opt_in then
        case when r.updated_at<now()-interval '30 days' or r.reminders=0 then now()+interval '1 hour'
             when r.reminders=1 then greatest(now()+interval '1 hour',coalesce(r.due_at,now()+interval '2 days'))
        end end
    returning attempt into v_attempt;
  elsif p_action='failed' and p_attempt is not null then
    update navigator_private.checkout_recovery set failed=true,updated_at=now()
    where buyer=v_buyer and product=p_product and attempt=p_attempt;
  elsif p_action='stop' then
    update navigator_private.checkout_recovery set consent_at=null,due_at=null,claim=null
    where buyer=v_buyer and product=p_product;
  else raise invalid_parameter_value;
  end if;
  return jsonb_build_object('attempt',v_attempt);
end $$;
revoke all on function navigator_recovery_internal.checkout_recovery_buyer(text,text,text,boolean,uuid) from public;
grant usage on schema navigator_recovery_internal to authenticated, anon;
grant execute on function navigator_recovery_internal.checkout_recovery_buyer(text,text,text,boolean,uuid) to authenticated;

create function public.navigator_checkout_recovery(p_token text,p_product text,p_action text,p_opt_in boolean default null,p_attempt uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select navigator_recovery_internal.checkout_recovery_buyer(p_token,p_product,p_action,p_opt_in,p_attempt);
$$;
revoke all on function public.navigator_checkout_recovery(text,text,text,boolean,uuid) from public,anon;
grant execute on function public.navigator_checkout_recovery(text,text,text,boolean,uuid) to authenticated;

create function navigator_recovery_internal.checkout_recovery_worker(p_token text,p_action text,p_id uuid,p_result text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r navigator_private.checkout_recovery;
  v_email text;
  v_orders jsonb;
  v_paid boolean;
begin
  if p_token is null or length(p_token)<>64 or not exists (
    select 1 from vault.decrypted_secrets where name='navigator_checkout_recovery_worker' and decrypted_secret=p_token
  ) then raise insufficient_privilege; end if;

  if p_action='unsubscribe' then
    update navigator_private.checkout_recovery set consent_at=null,due_at=null,claim=null where unsubscribe=p_id;
    return '{}'::jsonb;
  end if;
  if p_action='claim' then
    select * into r from navigator_private.checkout_recovery
      where due_at<=now() and updated_at>=now()-interval '30 days' and consent_at is not null and claim is null
      order by due_at limit 1 for update skip locked;
    if not found then return null; end if;
    update navigator_private.checkout_recovery set claim=gen_random_uuid() where buyer=r.buyer and product=r.product returning * into r;
    return jsonb_build_object('claim',r.claim);
  end if;
  select * into r from navigator_private.checkout_recovery where claim=p_id for update;
  if not found then return null; end if;
  if p_action='finish' and p_result in ('preview','accepted','paid','uncertain','rejected','retry','ineligible') then
    update navigator_private.checkout_recovery set claim=null,last_result=p_result,
      reminders=reminders+case when p_result in ('preview','accepted','uncertain') then 1 else 0 end,
      due_at=case when consent_at is not null then case
        when p_result='retry' then now()+interval '30 minutes'
        when reminders=0 and p_result in ('preview','accepted') then greatest(now()+interval '1 hour',updated_at+interval '2 days')
      end end
      where buyer=r.buyer and product=r.product;
    return '{}'::jsonb;
  end if;
  if p_action<>'authorize' then raise invalid_parameter_value; end if;

  select email into v_email from auth.users where id=r.buyer and email_confirmed_at is not null and not is_anonymous
    and (banned_until is null or banned_until<=now()) and sha256(convert_to(lower(email),'UTF8'))=r.email_hash;
  if v_email is null or r.consent_at is null then return null; end if;
  if r.product in ('checklist','compliance-checklist') then
    select coalesce(bool_or(captured_at is not null),false),
      coalesce(jsonb_agg(id) filter (where gateway='razorpay-test' and cancelled_at is null),'[]'::jsonb)
    into v_paid,v_orders from navigator_private.checklist_orders
    where account_id=r.buyer and product=r.product and created_at>=r.started_at-interval '30 days';
  elsif r.product in ('aggrieved','respondent') then
    select exists(select 1 from navigator_private.individual_guide_test_orders
      where account_id=r.buyer and product=r.product and activated_at>=r.started_at-interval '90 days'), '[]'::jsonb
    into v_paid,v_orders;
  else
    select coalesce(bool_or(starts_at is not null),false),coalesce(jsonb_agg(id),'[]'::jsonb)
    into v_paid,v_orders from navigator_private.plan_test_orders
    where owner_id=r.buyer and plan=r.product and (created_at>=r.started_at-interval '30 days' or ends_at>=now());
  end if;
  if v_paid then return jsonb_build_object('paid',true); end if;
  return jsonb_build_object('email',v_email,'product',r.product,'step',r.reminders+1,'unsubscribe',r.unsubscribe,'failed',r.failed,'orders',v_orders);
end $$;
revoke all on function navigator_recovery_internal.checkout_recovery_worker(text,text,uuid,text) from public;
grant execute on function navigator_recovery_internal.checkout_recovery_worker(text,text,uuid,text) to anon;

create function public.navigator_checkout_recovery_worker(p_token text,p_action text,p_id uuid default null,p_result text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select navigator_recovery_internal.checkout_recovery_worker(p_token,p_action,p_id,p_result);
$$;
revoke all on function public.navigator_checkout_recovery_worker(text,text,uuid,text) from public, authenticated;
grant execute on function public.navigator_checkout_recovery_worker(text,text,uuid,text) to anon;

select cron.schedule('navigator-checkout-recovery', '*/5 * * * *', $job$
  delete from navigator_private.checkout_recovery where updated_at<now()-interval '30 days';
  select net.http_post(
    url:='https://posh-inquiry-navigator-staging.onrender.com/api/checkout-recovery/dispatch',
    headers:=jsonb_build_object('Authorization','Bearer '||s.decrypted_secret),
    timeout_milliseconds:=90000
  ) from vault.decrypted_secrets s
  where s.name='navigator_checkout_recovery_worker'
    and exists(select 1 from navigator_private.checkout_recovery
      where due_at<=now() and consent_at is not null and claim is null);
$job$);

