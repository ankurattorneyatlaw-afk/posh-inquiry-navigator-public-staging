begin;
alter table public.navigator_plan_access add constraint navigator_verification_reference_unique unique(verification_reference);
create or replace function navigator_private.navigator_admin_grant(p_user uuid,p_plan text,p_starts timestamptz,p_ends timestamptz,p_reference uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid;
 begin
 if not public.navigator_is_operator() then raise insufficient_privilege;end if;
 if p_ends<=p_starts or p_ends>now()+interval '5 years' or p_reference is null then raise exception 'Invalid entitlement dates or reference';end if;
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not is_anonymous) then raise exception 'Confirmed account required';end if;
 insert into public.navigator_plan_access(user_id,plan,starts_at,ends_at,verification_reference) values(p_user,p_plan,p_starts,p_ends,p_reference)
 on conflict(verification_reference) do nothing returning id into result;
 if result is null then
 select id into result from public.navigator_plan_access where verification_reference=p_reference and user_id=p_user and plan=p_plan and starts_at=p_starts and ends_at=p_ends;
 if result is null then raise exception 'Verification reference already used for a different assignment';end if;
 end if;
 return result;
 end;
$$;
revoke all on function navigator_private.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function navigator_private.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid) to authenticated;
commit;
