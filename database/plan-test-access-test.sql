begin;
create temporary table audit_users as
select i,gen_random_uuid() as user_id,gen_random_uuid() as session_id,
       'plan-audit-'||i||'-'||gen_random_uuid()||'@example.invalid' as email
from generate_series(0,8) i;
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
select user_id,email,now(),false from audit_users;
insert into auth.sessions(id,user_id,not_after)
select session_id,user_id,now()+interval '1 hour' from audit_users;
update navigator_private.checklist_checkout_key
set token_hash=encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex');
do $$
declare
  owner_claims text;
  member_claims text;
  owner_id uuid;
  member_id uuid;
  account_email text;
  tier text;
  seat_limit int;
  active_months int;
  n int;
  ref text;
  token text:=repeat('a',64);
  result jsonb;
begin
  select user_id,jsonb_build_object('sub',user_id,'session_id',session_id,'role','authenticated',
    'aal','aal1','amr',jsonb_build_array(jsonb_build_object('method','otp')))::text
    into owner_id,owner_claims from audit_users where i=0;
  select user_id,jsonb_build_object('sub',user_id,'session_id',session_id,'role','authenticated',
    'aal','aal1','amr',jsonb_build_array(jsonb_build_object('method','otp')))::text
    into member_id,member_claims from audit_users where i=1;
  foreach tier in array array['essential','professional','advanced'] loop
    ref:='order_StageAudit'||tier;
    seat_limit:=case tier when 'essential' then 2 when 'professional' then 5 else 8 end;
    active_months:=case tier when 'essential' then 6 when 'professional' then 9 else 12 end;
    perform set_config('request.jwt.claims',owner_claims,true);
    result:=public.navigator_plan_test_access(token,'create',ref,tier);
    if result->>'state' is distinct from 'pending' then raise exception 'Expected pending: %',tier; end if;
    result:=public.navigator_plan_test_access(token,'capture',ref,tier,'pay_StageAudit'||tier);
    if result->>'state' is distinct from 'active'
      or (result->>'ends_at')::timestamptz <> now()+make_interval(months=>active_months)
      or (result->>'readOnlyUntil')::timestamptz <> (result->>'ends_at')::timestamptz+interval '3 months' then
      raise exception 'Wrong dates or state for %: %',tier,result; end if;
    if public.navigator_plan_test_access(token,'capture',ref,tier,'pay_StageAudit'||tier) is distinct from result then
      raise exception 'Capture retry changed the activation: %',tier; end if;
    for n in 1..seat_limit-1 loop
      select email into account_email from audit_users where i=n;
      result:=public.navigator_plan_test_access(token,'add',ref,p_email=>account_email);
      if jsonb_array_length(result->'members') is distinct from n then raise exception 'Wrong seat count: %',tier; end if;
    end loop;
    select email into account_email from audit_users where i=seat_limit;
    result:=public.navigator_plan_test_access(token,'add',ref,p_email=>account_email);
    if not result?'error' then raise exception 'Cap exceeded: %',tier; end if;
    perform set_config('request.jwt.claims',member_claims,true);
    result:=public.navigator_plan_test_access(token,'get',ref);
    if result->>'state' is distinct from 'active' or result->>'owner' is distinct from 'false' then
      raise exception 'Member did not inherit tier %',tier; end if;
    if public.navigator_plan_test_access(token,'add',ref,p_email=>account_email) is not null then
      raise exception 'Member could grant a seat: %',tier; end if;
    perform set_config('request.jwt.claims',owner_claims,true);
    result:=public.navigator_plan_test_access(token,'remove',ref,p_member=>member_id);
    if jsonb_array_length(result->'members') is distinct from seat_limit-2 then raise exception 'Remove failed: %',tier; end if;
    perform set_config('request.jwt.claims',member_claims,true);
    if public.navigator_plan_test_access(token,'get',ref) is not null then raise exception 'Revoked member retained access: %',tier; end if;
    perform set_config('request.jwt.claims',owner_claims,true);
    result:=public.navigator_plan_test_access(token,'add',ref,p_email=>account_email);
    if jsonb_array_length(result->'members') is distinct from seat_limit-1 then raise exception 'Released seat not reusable: %',tier; end if;
    update navigator_private.plan_test_orders set starts_at=now()-interval '2 days',ends_at=now(),
      read_only_until=now()+interval '3 months' where id=ref;
    result:=public.navigator_plan_test_access(token,'get',ref);
    if result->>'state' is distinct from 'read-only' then raise exception 'Read-only boundary: %',tier; end if;
    result:=public.navigator_plan_test_access(token,'remove',ref,p_member=>member_id);
    if not result?'error' then raise exception 'Read-only seat change allowed: %',tier; end if;
    update navigator_private.plan_test_orders set starts_at=now()-interval '6 months',ends_at=now()-interval '3 months',
      read_only_until=now() where id=ref;
    result:=public.navigator_plan_test_access(token,'get',ref);
    if result->>'state' is distinct from 'expired' then raise exception 'Expiry boundary: %',tier; end if;
  end loop;
end $$;
rollback;
select 'PASS: staging database capture, duration, 2/5/8 limits, member and owner checks, seat reuse and exact read-only/expiry boundaries for all three tiers' as result;
