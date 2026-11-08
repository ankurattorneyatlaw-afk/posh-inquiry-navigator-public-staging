-- Seat reservations are visible only through the verified staging order RPC.
create table navigator_private.plan_test_invitations (
  order_id text not null references navigator_private.plan_test_orders(id) on delete cascade,
  email text not null,
  id uuid not null unique default gen_random_uuid(),
  attempted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  primary key(order_id,email)
);
create index plan_test_invitations_email_idx on navigator_private.plan_test_invitations(email);
create table navigator_private.plan_test_invite_attempts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index plan_test_invite_attempts_owner_idx on navigator_private.plan_test_invite_attempts(owner_id,attempted_at);
alter table navigator_private.plan_test_invitations enable row level security;
alter table navigator_private.plan_test_invite_attempts enable row level security;
revoke all on navigator_private.plan_test_invitations,navigator_private.plan_test_invite_attempts from public,anon,authenticated;

create or replace function navigator_private.plan_test_access(
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
  buyer_email text;
  invited_email text;
  invitation navigator_private.plan_test_invitations;
  pending_order record;
  notice text;
begin
  if not navigator_private.verified_session() or p_token is null or length(p_token)<>64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise insufficient_privilege; end if;

  if p_action='list' then
    select lower(email) into buyer_email from auth.users
    where id=buyer and email_confirmed_at is not null and not coalesce(is_anonymous,false);
    -- Claim only for the verified recipient, while the plan is editable. Lock the order
    -- before consuming the reservation, just as for owner seat changes.
    for pending_order in
      select x.id from navigator_private.plan_test_orders x
      join navigator_private.plan_test_invitations i on i.order_id=x.id
      where i.email=buyer_email and i.expires_at>now()
        and x.payment_id is not null and x.starts_at<=now() and x.ends_at>now()
      order by x.id for update of x
    loop
      delete from navigator_private.plan_test_invitations
      where order_id=pending_order.id and email=buyer_email and expires_at>now();
      if found then
        insert into navigator_private.plan_test_seats(order_id,account_id)
        values(pending_order.id,buyer) on conflict do nothing;
      end if;
    end loop;
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

  if p_action in ('capture','add','remove','invite_reserve','invite_sent','invite_cancel') then
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
  if p_action not in ('seats','add','remove','invite_reserve','invite_sent','invite_cancel') then
    raise invalid_parameter_value;
  end if;
  if o.owner_id<>buyer or info->>'state' not in ('active','read-only') then return null; end if;
  if p_action<>'seats' and info->>'state'<>'active' then
    return jsonb_build_object('error','Seat changes are only available during the active term.');
  end if;

  if p_action in ('add','invite_reserve') then
    invited_email:=lower(trim(p_email));
    if invited_email is null or length(invited_email)>254
      or invited_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise invalid_parameter_value;
    end if;
    select u.id into target from auth.users u
      where lower(u.email)=invited_email and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())
      limit 1;
    if target is null and p_action='add' then
      return jsonb_build_object('inviteRequired',true,'error','Use an existing, confirmed Navigator account.');
    end if;
    if target is distinct from buyer and not exists(
      select 1 from navigator_private.plan_test_seats where order_id=o.id and account_id=target
    ) then
      seat_limit:=(info->>'seatLimit')::integer;
      if (select count(*) from navigator_private.plan_test_seats where order_id=o.id)
        +(select count(*) from navigator_private.plan_test_invitations
          where order_id=o.id and email<>invited_email and expires_at>now())>=seat_limit-1 then
        return jsonb_build_object('error','All seats are assigned or reserved. Remove a member or cancel an invitation to free a seat.');
      end if;
      if target is not null then
        delete from navigator_private.plan_test_invitations where order_id=o.id and email=invited_email;
        insert into navigator_private.plan_test_seats values(o.id,target);
      else
        select * into invitation from navigator_private.plan_test_invitations
          where order_id=o.id and email=invited_email;
        if invitation.attempted_at>now()-interval '1 minute' then
          return jsonb_build_object('error','Wait one minute before sending another invitation to this address.');
        end if;
        perform pg_advisory_xact_lock(hashtextextended('navigator-invites:'||buyer::text,0));
        delete from navigator_private.plan_test_invite_attempts
          where owner_id=buyer and attempted_at<=now()-interval '1 hour';
        if (select count(*) from navigator_private.plan_test_invite_attempts where owner_id=buyer)>=12 then
          return jsonb_build_object('error','Invitation sending is temporarily limited. Try again in an hour.');
        end if;
        insert into navigator_private.plan_test_invite_attempts(owner_id) values(buyer);
        insert into navigator_private.plan_test_invitations(order_id,email,expires_at)
          values(o.id,invited_email,least(o.ends_at,now()+interval '10 minutes'))
          on conflict(order_id,email) do update
            set id=gen_random_uuid(),attempted_at=now(),expires_at=excluded.expires_at,sent_at=null
          returning * into invitation;
        return jsonb_build_object('invitationId',invitation.id,'email',invitation.email);
      end if;
    end if;
  elsif p_action='remove' then
    delete from navigator_private.plan_test_seats where order_id=o.id and account_id=p_member;
  elsif p_action='invite_cancel' then
    delete from navigator_private.plan_test_invitations where order_id=o.id and id=p_member;
    if found then notice:='Invitation cancelled. The seat is available again.'; end if;
  elsif p_action='invite_sent' then
    update navigator_private.plan_test_invitations set sent_at=now()
      where order_id=o.id and id=p_member and expires_at>now();
    if not found then return jsonb_build_object('error','This invitation is no longer active.'); end if;
    notice:='Invitation sent. This seat is reserved until the invitation expires or you cancel it.';
  end if;
  return info||jsonb_build_object('members',coalesce((
    select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email) order by u.email)
    from navigator_private.plan_test_seats s join auth.users u on u.id=s.account_id where s.order_id=o.id
  ),'[]'::jsonb),'invitations',coalesce((
    select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'expiresAt',i.expires_at,'sent',i.sent_at is not null)
      order by i.email)
    from navigator_private.plan_test_invitations i where i.order_id=o.id and i.expires_at>now()
  ),'[]'::jsonb),'notice',notice);
end;
$$;
revoke all on function navigator_private.plan_test_access(text,text,text,text,text,text,uuid) from public,anon;
grant execute on function navigator_private.plan_test_access(text,text,text,text,text,text,uuid) to authenticated;
