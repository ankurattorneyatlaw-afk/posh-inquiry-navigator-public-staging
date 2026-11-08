-- Preserve prior captured orders and persist cancellation of pending test orders.
alter table navigator_private.checklist_orders
  add column cancelled_at timestamptz,
  add constraint checklist_orders_captured_or_cancelled
    check (captured_at is null or cancelled_at is null);

-- Both the signed-in buyer and the Navigator server credential are required.
create or replace function public.navigator_checklist_order(p_token text, p_action text, p_gateway text,
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
        where account_id=buyer and gateway=p_gateway and cancelled_at is null
        order by created_at desc,id desc limit 1;
    when 'cancel' then
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway for update;
      if item.id is null then return null; end if;
      if item.captured_at is null and item.cancelled_at is null then
        update navigator_private.checklist_orders set cancelled_at=now()
          where id=item.id returning * into item;
      end if;
    when 'capture' then
      if p_payment is null then raise invalid_parameter_value; end if;
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway for update;
      if item.id is null then return null; end if;
      if item.cancelled_at is not null then return null; end if;
      if item.payment_id is not null and item.payment_id <> p_payment then raise unique_violation; end if;
      if item.payment_id is null then
        update navigator_private.checklist_orders set payment_id=p_payment,captured_at=now()
          where id=item.id returning * into item;
      end if;
    else raise invalid_parameter_value;
  end case;
  if item.id is null then return null; end if;
  return jsonb_build_object('id',item.id,'organisation',item.organisation,
    'captured',item.payment_id is not null,'paymentId',item.payment_id,
    'cancelled',item.cancelled_at is not null,
    'downloadUntil',item.captured_at + interval '2160 hours',
    'downloadAvailable',coalesce(statement_timestamp() < item.captured_at + interval '2160 hours',false));
end;
$$;
