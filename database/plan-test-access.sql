begin;
create table navigator_private.plan_test_orders (
  id text primary key check (id ~ '^order_[A-Za-z0-9]{1,40}$'),
  owner_id uuid not null references auth.users(id),
  plan text not null check (plan in ('essential','professional','advanced')),
  created_at timestamptz not null default now(),
  payment_id text unique check (payment_id ~ '^pay_[A-Za-z0-9]{1,50}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  read_only_until timestamptz,
  check (
    (payment_id is null and starts_at is null and ends_at is null and read_only_until is null)
    or
    (payment_id is not null and starts_at is not null and ends_at is not null and read_only_until is not null
      and starts_at < ends_at and ends_at < read_only_until)
  )
);
create index plan_test_orders_owner_idx on navigator_private.plan_test_orders(owner_id);
create table navigator_private.plan_test_seats (
  order_id text not null references navigator_private.plan_test_orders(id),
  account_id uuid not null references auth.users(id) on delete cascade,
  primary key (order_id, account_id)
);
create index plan_test_seats_account_idx on navigator_private.plan_test_seats(account_id);
alter table navigator_private.plan_test_orders enable row level security;
alter table navigator_private.plan_test_seats enable row level security;
revoke all on navigator_private.plan_test_orders,navigator_private.plan_test_seats from public,anon,authenticated;

create function navigator_private.plan_test_summary(o navigator_private.plan_test_orders, buyer uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',o.id,'plan',o.plan,'starts_at',o.starts_at,'ends_at',o.ends_at,
    'readOnlyUntil',o.read_only_until,'owner',o.owner_id=buyer,
    'state',case when o.payment_id is null then 'pending'
                 when now() < o.starts_at then 'pending'
                 when now() < o.ends_at then 'active'
                 when now() < o.read_only_until then 'read-only'
                 else 'expired' end,
    'seatLimit',case o.plan when 'essential' then 2 when 'professional' then 5 else 8 end
  );
$$;
revoke all on function navigator_private.plan_test_summary(navigator_private.plan_test_orders,uuid) from public,anon,authenticated;

-- The application checks gateway capture. The database verifies the signed-in buyer,
-- binds the saved order to its tier, and atomically applies capture and seat changes.
create function navigator_private.plan_test_access(
  p_token text,p_action text,p_id text,p_plan text,p_payment text,p_email text,p_member uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  buyer uuid := auth.uid();
  o navigator_private.plan_test_orders;
  target uuid;
  seat_limit integer;
  captured_at timestamptz;
  active_until timestamptz;
  info jsonb;
begin
  if not navigator_private.verified_session() or p_token is null or length(p_token)<>64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise insufficient_privilege; end if;

  if p_action='list' then
    return coalesce((
      select jsonb_agg(navigator_private.plan_test_summary(x,buyer) order by x.created_at desc)
      from navigator_private.plan_test_orders x
      where x.payment_id is not null
        and (x.owner_id=buyer or exists(
          select 1 from navigator_private.plan_test_seats s where s.order_id=x.id and s.account_id=buyer))
    ),'[]'::jsonb);
  end if;

  if p_action='create' then
    insert into navigator_private.plan_test_orders(id,owner_id,plan)
      values (p_id,buyer,p_plan) returning * into o;
    return navigator_private.plan_test_summary(o,buyer);
  end if;

  if p_action in ('capture','add','remove') then
    select * into o from navigator_private.plan_test_orders where id=p_id and owner_id=buyer for update;
  else
    select * into o from navigator_private.plan_test_orders x where x.id=p_id and
      (x.owner_id=buyer or exists(
        select 1 from navigator_private.plan_test_seats s where s.order_id=x.id and s.account_id=buyer));
  end if;
  if o.id is null then return null; end if;

  if p_action='capture' then
    if p_plan is distinct from o.plan or p_payment is null then raise invalid_parameter_value; end if;
    if o.payment_id is not null and o.payment_id<>p_payment then raise unique_violation; end if;
    if o.payment_id is null then
      captured_at:=now();
      active_until:=((captured_at at time zone 'Asia/Kolkata')+
        make_interval(months=>case o.plan when 'essential' then 6 when 'professional' then 9 else 12 end))
        at time zone 'Asia/Kolkata';
      update navigator_private.plan_test_orders set payment_id=p_payment,starts_at=captured_at,
        ends_at=active_until,read_only_until=((active_until at time zone 'Asia/Kolkata')+interval '3 months')
          at time zone 'Asia/Kolkata' where id=o.id returning * into o;
    end if;
    return navigator_private.plan_test_summary(o,buyer);
  end if;

  info:=navigator_private.plan_test_summary(o,buyer);
  if p_action='get' then return info; end if;
  if p_action not in ('seats','add','remove') then raise invalid_parameter_value; end if;
  if o.owner_id<>buyer or info->>'state' not in ('active','read-only') then return null; end if;
  if p_action in ('add','remove') and info->>'state'<>'active' then
    return jsonb_build_object('error','Seat changes are only available during the active term.');
  end if;
  if p_action='add' then
    if p_email is null or length(p_email)>254 then raise invalid_parameter_value; end if;
    select u.id into target from auth.users u
      where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())
      limit 1;
    if target is null then return jsonb_build_object('error','Use an existing, confirmed Navigator account.'); end if;
    seat_limit:=(info->>'seatLimit')::integer;
    if target<>buyer and not exists(
      select 1 from navigator_private.plan_test_seats where order_id=o.id and account_id=target
    ) then
      if (select count(*) from navigator_private.plan_test_seats where order_id=o.id)>=seat_limit-1 then
        return jsonb_build_object('error','All seats are assigned. Remove a member before adding another.');
      end if;
      insert into navigator_private.plan_test_seats values(o.id,target);
    end if;
  elsif p_action='remove' then
    delete from navigator_private.plan_test_seats where order_id=o.id and account_id=p_member;
  end if;
  return info||jsonb_build_object('members',coalesce((
    select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email) order by u.email)
    from navigator_private.plan_test_seats s join auth.users u on u.id=s.account_id where s.order_id=o.id
  ),'[]'::jsonb));
end;
$$;
revoke all on function navigator_private.plan_test_access(text,text,text,text,text,text,uuid) from public,anon;
grant execute on function navigator_private.plan_test_access(text,text,text,text,text,text,uuid) to authenticated;

create function public.navigator_plan_test_access(
  p_token text,p_action text,p_id text default null,p_plan text default null,p_payment text default null,
  p_email text default null,p_member uuid default null
) returns jsonb language sql security invoker set search_path='' as $$
  select navigator_private.plan_test_access(p_token,p_action,p_id,p_plan,p_payment,p_email,p_member);
$$;
revoke all on function public.navigator_plan_test_access(text,text,text,text,text,text,uuid) from public,anon;
grant execute on function public.navigator_plan_test_access(text,text,text,text,text,text,uuid) to authenticated;
commit;
