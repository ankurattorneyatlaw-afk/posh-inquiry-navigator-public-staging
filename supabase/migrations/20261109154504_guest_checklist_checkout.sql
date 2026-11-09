begin;

alter table navigator_private.checklist_orders
  alter column account_id drop not null,
  add column guest_id uuid unique,
  add column guest_email text,
  add column resume_hash text unique,
  add constraint checklist_order_owner check (
    (account_id is not null and guest_id is null and guest_email is null and resume_hash is null) or
    (account_id is null and guest_id is not null and guest_email is not null and
      ((captured_at is null and resume_hash is null) or (captured_at is not null and resume_hash is not null)))
  ),
  drop constraint checklist_orders_amount_check,
  add constraint checklist_orders_amount_check check (
    amount = case when guest_id is not null and product='compliance-checklist' then 199900 else 99900 end
  );

create table navigator_private.checklist_receipts (
  order_id text primary key references navigator_private.checklist_orders(id),
  resume_token text,
  state text not null default 'queued' check (state in ('queued','sending','sent','review')),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table navigator_private.checklist_receipts enable row level security;
revoke all on navigator_private.checklist_receipts from public, anon, authenticated;

create function navigator_private.guest_compliance_assessment(
  item navigator_private.checklist_orders,p_action text,p_data jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare
  assessment navigator_private.compliance_assessments;
  catalogue jsonb;
  version_id integer;
  payload jsonb := p_data->'payload';
begin
  if p_action='assessment-start' then
    select max(version) into version_id from navigator_private.compliance_assessment_catalogue;
    if jsonb_typeof(payload) is distinct from 'object' or version_id is null then raise invalid_parameter_value; end if;
    insert into navigator_private.compliance_assessments(order_id,account_id,catalogue_version,scope)
      values(item.id,item.guest_id,version_id,payload) on conflict (order_id) do nothing;
  elsif p_action in ('assessment-save','assessment-finish') then
    select * into assessment from navigator_private.compliance_assessments
      where order_id=item.id and account_id=item.guest_id for update;
    if assessment.order_id is null or assessment.revision is distinct from (p_data->>'revision')::integer
      or assessment.final_snapshot is not null then return jsonb_build_object('conflict',true); end if;
    update navigator_private.compliance_assessments
      set answers=case when p_action='assessment-save' then jsonb_set(answers,array[payload->>'id'],payload->'answer',true) else answers end,
          final_snapshot=case when p_action='assessment-finish' then payload else final_snapshot end,
          revision=revision+1, updated_at=now()
      where order_id=item.id and account_id=item.guest_id;
  elsif p_action is distinct from 'assessment-read' then
    raise invalid_parameter_value;
  end if;
  select * into assessment from navigator_private.compliance_assessments where order_id=item.id and account_id=item.guest_id;
  if assessment.order_id is not null and assessment.final_snapshot is null then
    select checks into catalogue from navigator_private.compliance_assessment_catalogue where version=assessment.catalogue_version;
  end if;
  return jsonb_build_object('organisation',item.organisation,'order',item.id,'scope',assessment.scope,
    'answers',assessment.answers,'revision',assessment.revision,'final',assessment.final_snapshot,'catalogue',catalogue);
end;
$$;
revoke all on function navigator_private.guest_compliance_assessment(navigator_private.checklist_orders,text,jsonb)
  from public, anon, authenticated;

create schema navigator_guest_checkout;
revoke all on schema navigator_guest_checkout from public, anon, authenticated;

create function navigator_guest_checkout.run(
  p_token text,p_action text,p_product text,p_gateway text,p_guest uuid,p_order text,p_data jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item navigator_private.checklist_orders;
  ticks jsonb;
  receipt_state text;
  resume_token text;
  expires timestamptz;
  item_number integer;
  recipient text := p_data->>'email';
begin
  if p_token is null or length(p_token)<>64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise insufficient_privilege; end if;

  if p_action='resume' then
    if coalesce(p_data->>'resume','') !~ '^[a-f0-9]{64}$' then return null; end if;
    select * into item from navigator_private.checklist_orders
      where resume_hash=encode(sha256(convert_to(p_data->>'resume','UTF8')),'hex')
        and guest_id is not null and captured_at is not null and cancelled_at is null;
    if item.id is null or (item.product='checklist' and now()>=item.captured_at+interval '120 days') then return null; end if;
    return jsonb_build_object('id',item.id,'guest',item.guest_id,'product',item.product);
  end if;

  if p_guest is null or p_product is null or p_product not in ('checklist','compliance-checklist')
    or p_gateway is null or p_gateway not in ('simulated','razorpay-test') then
    raise invalid_parameter_value;
  end if;

  if p_action='create' then
    if recipient is null or recipient not in (
      'ankur.attorneyatlaw+navigator-hosted-owner@gmail.com',
      'ankur.attorneyatlaw+navigator-hosted-customer@gmail.com'
    ) then raise insufficient_privilege; end if;
    -- The browser may retry, but each guest can own at most one order.
    insert into navigator_private.checklist_orders(id,guest_id,guest_email,organisation,gateway,product,amount)
      values(p_order,p_guest,recipient,p_data->>'organisation',p_gateway,p_product,
        case when p_product='checklist' then 99900 else 199900 end)
      returning * into item;
  else
    select * into item from navigator_private.checklist_orders
      where guest_id=p_guest and product=p_product and gateway=p_gateway
        and (id=p_order or (p_order is null and p_action in ('latest','progress')))
      for update;
    if item.id is null then return null; end if;
    if p_action='cancel' then
      if item.captured_at is null and item.cancelled_at is null then
        update navigator_private.checklist_orders set cancelled_at=now() where id=item.id returning * into item;
      end if;
    elsif p_action='capture' then
      if item.cancelled_at is not null then return null; end if;
      if p_data->>'payment' is null then raise invalid_parameter_value; end if;
      if item.payment_id is not null and item.payment_id<>p_data->>'payment' then raise unique_violation; end if;
      if item.payment_id is null then
        resume_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
        update navigator_private.checklist_orders
          set payment_id=p_data->>'payment', captured_at=now(),
              resume_hash=encode(sha256(convert_to(resume_token,'UTF8')),'hex')
          where id=item.id returning * into item;
        insert into navigator_private.checklist_receipts(order_id,resume_token) values(item.id,resume_token);
      end if;
    elsif p_action='progress' then
      if item.product<>'checklist' or item.captured_at is null or item.cancelled_at is not null then return null; end if;
      expires:=item.captured_at+interval '120 days';
      if now()<expires then
        if jsonb_typeof(p_data->'import')='array' then
          insert into navigator_private.inquiry_checklist_progress(order_id,item_number,checked)
            select item.id,value::smallint,true from jsonb_array_elements_text(p_data->'import')
            on conflict on constraint inquiry_checklist_progress_pkey do nothing;
        elsif p_data ? 'number' then
          item_number:=(p_data->>'number')::integer;
          insert into navigator_private.inquiry_checklist_progress(order_id,item_number,checked)
            values(item.id,item_number,(p_data->>'checked')::boolean)
            on conflict on constraint inquiry_checklist_progress_pkey do update set checked=excluded.checked;
        end if;
      end if;
      select coalesce(jsonb_agg(t.item_number order by t.item_number),'[]'::jsonb) into ticks
        from navigator_private.inquiry_checklist_progress t where t.order_id=item.id and t.checked;
      return jsonb_build_object('id',item.id,'organisation',item.organisation,'edition',item.inquiry_edition,
        'accessUntil',expires,'active',now()<expires,'checked',ticks);
    elsif p_action in ('assessment-read','assessment-start','assessment-save','assessment-finish') then
      if item.product<>'compliance-checklist' or item.captured_at is null or item.cancelled_at is not null then return null; end if;
      return navigator_private.guest_compliance_assessment(item,p_action,p_data);
    elsif p_action='latest' then
      if item.cancelled_at is not null then return null; end if;
    elsif p_action is distinct from 'get' then
      raise invalid_parameter_value;
    end if;
  end if;
  select state into receipt_state from navigator_private.checklist_receipts where order_id=item.id;
  return jsonb_build_object('id',item.id,'organisation',item.organisation,'captured',item.captured_at is not null,
    'paymentId',item.payment_id,'cancelled',item.cancelled_at is not null,'receiptStatus',receipt_state,
    'downloadUntil',item.captured_at+interval '90 days');
end;
$$;
revoke all on function navigator_guest_checkout.run(text,text,text,text,uuid,text,jsonb) from public, anon, authenticated;
grant usage on schema navigator_guest_checkout to anon;
grant execute on function navigator_guest_checkout.run(text,text,text,text,uuid,text,jsonb) to anon;

create function public.navigator_guest_checklist(
  p_token text,p_action text,p_product text,p_gateway text,p_guest uuid,p_order text,p_data jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select navigator_guest_checkout.run(p_token,p_action,p_product,p_gateway,p_guest,p_order,p_data);
$$;
revoke all on function public.navigator_guest_checklist(text,text,text,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.navigator_guest_checklist(text,text,text,text,uuid,text,jsonb) to anon;

create function navigator_walkthrough_mail.claim_checklist_receipt()
returns jsonb language sql security definer set search_path='' as $$
  with next_job as (
    select order_id from navigator_private.checklist_receipts where state='queued'
    order by updated_at,order_id limit 1 for update skip locked
  ), claimed as (
    update navigator_private.checklist_receipts r set state='sending',attempts=r.attempts+1,updated_at=now()
    from next_job n where r.order_id=n.order_id returning r.*
  )
  select jsonb_build_object('order',c.order_id,'token',c.resume_token,'email',o.guest_email,
    'product',o.product,'amount',o.amount,'attempt',c.attempts)
  from claimed c join navigator_private.checklist_orders o on o.id=c.order_id
  where o.captured_at is not null and o.cancelled_at is null;
$$;

create function navigator_walkthrough_mail.finish_checklist_receipt(p_order text,p_attempt integer,p_result text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_result is null or p_result not in ('sent','retry','review') then raise invalid_parameter_value; end if;
  update navigator_private.checklist_receipts
    set state=case when p_result='sent' then 'sent' when p_result='retry' and attempts<3 then 'queued' else 'review' end,
        resume_token=case when p_result='sent' then null else resume_token end, updated_at=now()
    where order_id=p_order and attempts=p_attempt and state='sending';
  return found;
end;
$$;
revoke all on function navigator_walkthrough_mail.claim_checklist_receipt() from public, anon, authenticated;
revoke all on function navigator_walkthrough_mail.finish_checklist_receipt(text,integer,text) from public, anon, authenticated;
grant execute on function navigator_walkthrough_mail.claim_checklist_receipt() to navigator_walkthrough_mailer;
grant execute on function navigator_walkthrough_mail.finish_checklist_receipt(text,integer,text) to navigator_walkthrough_mailer;

commit;
