alter table navigator_private.checklist_orders
  add column product text not null default 'checklist'
  check (product in ('checklist','compliance-checklist'));

create index checklist_orders_product_latest
  on navigator_private.checklist_orders (account_id, product, gateway, created_at desc, id desc)
  where cancelled_at is null;

create function navigator_private.checklist_product_order(p_token text, p_action text, p_gateway text,
  p_id text, p_organisation text, p_payment text, p_product text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  buyer uuid := auth.uid();
  item navigator_private.checklist_orders;
begin
  if buyer is null or p_token is null or length(p_token) <> 64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then raise insufficient_privilege; end if;

  if p_product is null or p_product not in ('checklist','compliance-checklist')
     or p_gateway is null or p_gateway not in ('simulated','razorpay-test') then
    raise invalid_parameter_value;
  end if;

  case p_action
    when 'create' then
      insert into navigator_private.checklist_orders(id,account_id,organisation,gateway,product)
      values(p_id,buyer,p_organisation,p_gateway,p_product) returning * into item;
    when 'get' then
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway and product=p_product;
    when 'latest' then
      select * into item from navigator_private.checklist_orders
        where account_id=buyer and gateway=p_gateway and product=p_product and cancelled_at is null
        order by created_at desc,id desc limit 1;
    when 'cancel' then
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway and product=p_product for update;
      if item.id is null then return null; end if;
      if item.captured_at is null and item.cancelled_at is null then
        update navigator_private.checklist_orders set cancelled_at=now()
          where id=item.id returning * into item;
      end if;
    when 'capture' then
      if p_payment is null then raise invalid_parameter_value; end if;
      select * into item from navigator_private.checklist_orders
        where id=p_id and account_id=buyer and gateway=p_gateway and product=p_product for update;
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
$function$;

revoke all on function navigator_private.checklist_product_order(text,text,text,text,text,text,text)
  from public, anon, authenticated;

create or replace function public.navigator_checklist_order(p_token text, p_action text, p_gateway text,
  p_id text default null, p_organisation text default null, p_payment text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select navigator_private.checklist_product_order(p_token,p_action,p_gateway,
    p_id,p_organisation,p_payment,'checklist');
$function$;

revoke all on function public.navigator_checklist_order(text,text,text,text,text,text) from public, anon;
grant execute on function public.navigator_checklist_order(text,text,text,text,text,text) to authenticated;

create or replace function public.navigator_compliance_checklist_order(p_token text, p_action text, p_gateway text,
  p_id text default null, p_organisation text default null, p_payment text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select navigator_private.checklist_product_order(p_token,p_action,p_gateway,
    p_id,p_organisation,p_payment,'compliance-checklist');
$function$;

revoke all on function public.navigator_compliance_checklist_order(text,text,text,text,text,text) from public, anon;
grant execute on function public.navigator_compliance_checklist_order(text,text,text,text,text,text) to authenticated;
