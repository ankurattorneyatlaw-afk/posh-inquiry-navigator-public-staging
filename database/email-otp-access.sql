-- Account authentication only. Email OTP is single-factor, not MFA/AAL2.
begin;
create or replace function navigator_private.verified_session() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and (coalesce(auth.jwt()->>'aal','')='aal2' or exists(
   select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end) m
   where m->>'method'='otp'
 ))
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now()))
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function navigator_private.verified_session() from public,anon;
grant execute on function navigator_private.verified_session() to authenticated;
commit;
