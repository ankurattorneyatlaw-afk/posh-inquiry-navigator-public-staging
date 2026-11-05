begin;
create table navigator_private.account_operators(user_id uuid primary key references auth.users(id) on delete cascade);
alter table navigator_private.account_operators enable row level security;
revoke all on navigator_private.account_operators from public,anon,authenticated;
create function public.navigator_is_operator() returns boolean language sql stable security definer set search_path='' as $$
 select navigator_private.verified_session() and exists(select 1 from navigator_private.account_operators where user_id=auth.uid());
$$;
revoke all on function public.navigator_is_operator() from public,anon;
grant execute on function public.navigator_is_operator() to authenticated;

create function public.navigator_admin_account(p_email text) returns table(account_id uuid,email text) language plpgsql security definer set search_path='' as $$
 begin
 if not public.navigator_is_operator() then raise insufficient_privilege; end if;
 if length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 return query select u.id,u.email::text from auth.users u where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null and not u.is_anonymous;
 end;
$$;
revoke all on function public.navigator_admin_account(text) from public,anon;
grant execute on function public.navigator_admin_account(text) to authenticated;

create function public.navigator_admin_grant(p_user uuid,p_plan text,p_starts timestamptz,p_ends timestamptz,p_reference uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid;
 begin
 if not public.navigator_is_operator() then raise insufficient_privilege; end if;
 if p_ends<=p_starts or p_ends>now()+interval '5 years' or p_reference is null then raise exception 'Invalid entitlement dates or reference'; end if;
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not is_anonymous) then raise exception 'Confirmed account required'; end if;
 insert into public.navigator_plan_access(user_id,plan,starts_at,ends_at,verification_reference) values(p_user,p_plan,p_starts,p_ends,p_reference) returning id into result;
 return result;
 end;
$$;
revoke all on function public.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.navigator_admin_grant(uuid,text,timestamptz,timestamptz,uuid) to authenticated;

create function public.navigator_admin_revoke(p_access uuid) returns boolean language plpgsql security definer set search_path='' as $$
 begin
 if not public.navigator_is_operator() then raise insufficient_privilege; end if;
 update public.navigator_plan_access set status='revoked' where id=p_access and status='active';
 return found;
 end;
$$;
revoke all on function public.navigator_admin_revoke(uuid) from public,anon;
grant execute on function public.navigator_admin_revoke(uuid) to authenticated;
commit;
