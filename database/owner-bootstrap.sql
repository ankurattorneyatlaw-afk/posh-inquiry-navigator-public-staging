begin;
create table navigator_private.approved_owner(email text primary key);
alter table navigator_private.approved_owner enable row level security;
revoke all on navigator_private.approved_owner from public,anon,authenticated;
create function navigator_private.provision_verified_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and not new.is_anonymous and exists(select 1 from navigator_private.approved_owner where lower(email)=lower(new.email)) then
 insert into navigator_private.account_operators(user_id) values(new.id) on conflict do nothing;
 if not exists(select 1 from public.navigator_plan_access where user_id=new.id and plan='enterprise' and status='active' and ends_at>now()) then
 insert into public.navigator_plan_access(user_id,plan,ends_at,verification_reference) values(new.id,'enterprise',now()+interval '5 years',gen_random_uuid());
 end if;
 end if;
 return new;
end;
$$;
revoke all on function navigator_private.provision_verified_owner() from public,anon,authenticated;
create trigger navigator_verified_owner after insert or update of email,email_confirmed_at on auth.users for each row execute function navigator_private.provision_verified_owner();
create function public.navigator_admin_access(p_user uuid) returns table(access_id uuid,plan text,status text,starts_at timestamptz,ends_at timestamptz,verification_reference uuid) language plpgsql security definer set search_path='' as $$
begin
 if not public.navigator_is_operator() then raise insufficient_privilege;end if;
 return query select a.id,a.plan,a.status,a.starts_at,a.ends_at,a.verification_reference from public.navigator_plan_access a where a.user_id=p_user order by a.created_at desc limit 100;
end;
$$;
revoke all on function public.navigator_admin_access(uuid) from public,anon;
grant execute on function public.navigator_admin_access(uuid) to authenticated;
commit;
