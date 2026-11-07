begin;
create schema if not exists navigator_private;

create table navigator_private.checklist_checkout_key (
  singleton boolean primary key default true check (singleton),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$')
);
create table navigator_private.checklist_orders (
  id text primary key check (id ~ '^order_[A-Za-z0-9]{1,40}$'),
  account_id uuid not null references auth.users(id),
  organisation text not null check (char_length(organisation) between 1 and 64),
  gateway text not null check (gateway in ('simulated', 'razorpay-test')),
  amount integer not null default 99900 check (amount = 99900),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  payment_id text unique check (payment_id ~ '^pay_[A-Za-z0-9]{1,50}$'),
  captured_at timestamptz,
  check ((payment_id is null) = (captured_at is null))
);
create index checklist_orders_account_created on navigator_private.checklist_orders (account_id, created_at desc);
alter table navigator_private.checklist_checkout_key enable row level security;
alter table navigator_private.checklist_orders enable row level security;
revoke all on navigator_private.checklist_checkout_key, navigator_private.checklist_orders from public, anon, authenticated;

-- Both the signed-in buyer and the Navigator server credential are required.
create function public.navigator_checklist_order(p_token text, p_action text, p_gateway text,
  p_id text default null, p_organisation text default null, p_payment text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  buyer uuid := auth.uid();
  item navigator_private.checklist_orders;
begin
  if buyer is null or p_token is null or length(p_token) <> 64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then raise insufficient_privilege; end if;

  if p_gateway is null or p_gateway not in ('simulated','razorpay-test') then
    raise invalid_parameter_value;
  end if;

  case p_action
    when 'create' then
      insert into navigator_private.checklist_orders(id,account_id,organisation,gateway)
      values(p_id,buyer,p_organisation,p_gateway) returning * into item;
    when 'get' then
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway;
    when 'latest' then
      select * into item from navigator_private.checklist_orders
        where account_id=buyer and gateway=p_gateway order by created_at desc,id desc limit 1;
    when 'capture' then
      if p_payment is null then raise invalid_parameter_value; end if;
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway for update;
      if item.id is null then return null; end if;
      if item.payment_id is not null and item.payment_id <> p_payment then raise unique_violation; end if;
      if item.payment_id is null then
        update navigator_private.checklist_orders set payment_id=p_payment,captured_at=now()
          where id=item.id returning * into item;
      end if;
    else raise invalid_parameter_value;
  end case;
  if item.id is null then return null; end if;
  return jsonb_build_object('id',item.id,'organisation',item.organisation,
    'captured',item.payment_id is not null,'paymentId',item.payment_id);
end;
$$;
revoke all on function public.navigator_checklist_order(text,text,text,text,text,text) from public, anon;
grant execute on function public.navigator_checklist_order(text,text,text,text,text,text) to authenticated;
commit;
