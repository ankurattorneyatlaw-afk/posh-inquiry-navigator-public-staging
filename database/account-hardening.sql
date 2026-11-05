-- Keep privileged implementations outside the exposed API schema.
begin;
alter function public.navigator_is_operator() set schema navigator_private;
alter function public.navigator_admin_account(text) set schema navigator_private;
alter function public.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid) set schema navigator_private;
alter function public.navigator_admin_revoke(uuid) set schema navigator_private;
alter function public.navigator_admin_access(uuid) set schema navigator_private;
create function public.navigator_is_operator() returns boolean language sql stable security invoker set search_path='' as $$select navigator_private.navigator_is_operator()$$;
create function public.navigator_admin_account(p_email text) returns table(account_id uuid,email text) language sql security invoker set search_path='' as $$select * from navigator_private.navigator_admin_account(p_email)$$;
create function public.navigator_admin_grant(p_user uuid,p_plan text,p_starts timestamptz,p_ends timestamptz,p_reference uuid) returns uuid language sql security invoker set search_path='' as $$select navigator_private.navigator_admin_grant(p_user,p_plan,p_starts,p_ends,p_reference)$$;
create function public.navigator_admin_revoke(p_access uuid) returns boolean language sql security invoker set search_path='' as $$select navigator_private.navigator_admin_revoke(p_access)$$;
create function public.navigator_admin_access(p_user uuid) returns table(access_id uuid,plan text,status text,starts_at timestamptz,ends_at timestamptz,verification_reference uuid) language sql security invoker set search_path='' as $$select * from navigator_private.navigator_admin_access(p_user)$$;
revoke all on function public.navigator_is_operator(),public.navigator_admin_account(text),public.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid),public.navigator_admin_revoke(uuid),public.navigator_admin_access(uuid) from public,anon;
grant execute on function public.navigator_is_operator(),public.navigator_admin_account(text),public.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid),public.navigator_admin_revoke(uuid),public.navigator_admin_access(uuid) to authenticated;
create policy deny_direct_access_changes on navigator_private.access_changes for all to authenticated using(false) with check(false);
create policy deny_direct_operators on navigator_private.account_operators for all to authenticated using(false) with check(false);
create policy deny_direct_approved_owner on navigator_private.approved_owner for all to authenticated using(false) with check(false);
commit;
