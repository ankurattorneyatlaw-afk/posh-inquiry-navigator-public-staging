-- Synthetic, transactional permission tests. Every fixture is rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('10000000-0000-4000-8000-000000000001','navigator-access-a@example.invalid',now(),false),
 ('10000000-0000-4000-8000-000000000002','navigator-access-b@example.invalid',now(),false);
insert into auth.sessions(id,user_id,not_after) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()+interval '1 hour'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',now()+interval '1 hour');
insert into public.navigator_plan_access(user_id,plan,starts_at,ends_at,verification_reference) values
 ('10000000-0000-4000-8000-000000000001','essential',now()-interval '1 day',now()+interval '1 day',gen_random_uuid()),
 ('10000000-0000-4000-8000-000000000002','advanced',now()-interval '1 day',now()+interval '1 day',gen_random_uuid()),
 ('10000000-0000-4000-8000-000000000001','professional',now()-interval '2 days',now()-interval '1 day',gen_random_uuid());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2","session_id":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.navigator_my_access())<>1 then raise exception 'Own active entitlement not isolated'; end if;
 if exists(select 1 from public.navigator_my_access() where plan<>'essential') then raise exception 'Cross-user or expired access leak'; end if;
 begin insert into public.navigator_plan_access(user_id,plan,ends_at,verification_reference) values(auth.uid(),'advanced',now()+interval '1 day',gen_random_uuid());raise exception 'Self-grant unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin update public.navigator_plan_access set plan='advanced';raise exception 'Self-update unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin perform public.navigator_admin_account('navigator-access-b@example.invalid');raise exception 'Non-admin lookup allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$begin if exists(select 1 from public.navigator_my_access()) then raise exception 'Unverified password bypass';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","amr":[{"method":"otp"}],"session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$begin if (select count(*) from public.navigator_my_access())<>1 then raise exception 'Email OTP rejected';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","amr":[{"method":"recovery"}],"session_id":"20000000-0000-4000-8000-000000000001","user_metadata":{"amr":[{"method":"otp"}]}}',true);
do $$begin if exists(select 1 from public.navigator_my_access()) then raise exception 'Recovery or user metadata bypass';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2","session_id":"20000000-0000-4000-8000-000000000099"}',true);
do $$begin if exists(select 1 from public.navigator_my_access()) then raise exception 'Revoked session bypass';end if;end$$;
reset role;
insert into navigator_private.account_operators values('10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","amr":[{"method":"otp"}],"session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$begin if not public.navigator_is_operator() then raise exception 'OTP owner rejected';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2","session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$declare aid uuid;again uuid;reference uuid:=gen_random_uuid();begin
 if not public.navigator_is_operator() then raise exception 'Verified owner rejected';end if;
 if (select count(*) from public.navigator_admin_account('navigator-access-b@example.invalid'))<>1 then raise exception 'Owner lookup failed';end if;
 aid:=public.navigator_admin_grant('10000000-0000-4000-8000-000000000002','professional',now(),now()+interval '1 day',reference);
 again:=public.navigator_admin_grant('10000000-0000-4000-8000-000000000002','professional',now(),now()+interval '1 day',reference);
 if again<>aid then raise exception 'Grant retry is not idempotent';end if;
 if not public.navigator_admin_revoke(aid) then raise exception 'Owner revoke failed';end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.navigator_my_access();raise exception 'Anonymous entitlement read allowed';exception when insufficient_privilege then null;end;
 begin perform public.navigator_is_operator();raise exception 'Anonymous operator read allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS: own-user isolation, expired access, self-grant/update refusal, operator lookup refusal, MFA, revoked session, verified owner grant/revoke and anonymous refusal; fixtures rolled back' as result;
