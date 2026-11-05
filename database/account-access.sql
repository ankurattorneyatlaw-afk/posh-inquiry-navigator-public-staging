-- Navigator accounts and verified plan access ONLY. No case/evidence storage.
begin;
create schema if not exists navigator_private;
revoke all on schema navigator_private from public, anon;
grant usage on schema navigator_private to authenticated;

create table public.navigator_plan_access (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan text not null check(plan in ('essential','professional','advanced','institutional','enterprise','knowledge')),
 status text not null default 'active' check(status in ('active','revoked')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 verification_reference uuid not null,
 created_at timestamptz not null default now(),
 constraint access_date_order check(ends_at>starts_at)
);
comment on table public.navigator_plan_access is 'Account entitlement only. Purchase verification reference is an opaque administrative UUID. Never add case details, names of parties, complaint numbers, evidence or hearing data.';
create index navigator_plan_access_user_idx on public.navigator_plan_access(user_id,status,ends_at);
alter table public.navigator_plan_access enable row level security;
revoke all on public.navigator_plan_access from public,anon,authenticated;
grant select(user_id,plan,status,starts_at,ends_at) on public.navigator_plan_access to authenticated;

-- Narrow privileged lookup: auth.sessions is not exposed to the client.
create function navigator_private.verified_session() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now()))
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function navigator_private.verified_session() from public,anon;
grant execute on function navigator_private.verified_session() to authenticated;
create policy navigator_read_own_access on public.navigator_plan_access
 for select to authenticated using(user_id=(select auth.uid()) and (select navigator_private.verified_session()));

create function public.navigator_my_access()
 returns table(plan text,status text,starts_at timestamptz,ends_at timestamptz)
 language sql stable security invoker set search_path='' as $$
 select a.plan,a.status,a.starts_at,a.ends_at from public.navigator_plan_access a
 where a.user_id=(select auth.uid()) and a.status='active' and a.starts_at<=now() and a.ends_at>now();
$$;
revoke all on function public.navigator_my_access() from public,anon;
grant execute on function public.navigator_my_access() to authenticated;

create table navigator_private.access_changes(
 id bigint generated always as identity primary key,
 at timestamptz not null default now(),
 operation text not null,
 access_id uuid not null,
 previous jsonb,
 replacement jsonb
);
alter table navigator_private.access_changes enable row level security;
revoke all on navigator_private.access_changes from public,anon,authenticated;
create function navigator_private.record_access_change() returns trigger
 language plpgsql security definer set search_path='' as $$
 begin
 insert into navigator_private.access_changes(operation,access_id,previous,replacement)
 values(tg_op,coalesce(new.id,old.id),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
 end;
$$;
revoke all on function navigator_private.record_access_change() from public,anon,authenticated;
create trigger navigator_record_access_change after insert or update or delete on public.navigator_plan_access for each row execute function navigator_private.record_access_change();
commit;
