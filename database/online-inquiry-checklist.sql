
-- Existing and future orders from this offer refer to edition 2.0.
-- A new offer must select a new edition explicitly and retain the earlier asset.
alter table navigator_private.checklist_orders
  add column inquiry_edition text not null default '2.0';
create index checklist_orders_online_edition on navigator_private.checklist_orders(account_id,captured_at desc,id desc)
  where product='checklist' and captured_at is not null;

create schema navigator_checklist_internal;
revoke all on schema navigator_checklist_internal from public;
grant usage on schema navigator_checklist_internal to authenticated;

create function navigator_checklist_internal.online_access(p_token text,p_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_buyer uuid := auth.uid();
  item navigator_private.checklist_orders;
  expires timestamptz;
begin
  if v_buyer is null or not navigator_private.verified_session() or p_token is null or length(p_token)<>64 or not exists (
    select 1 from navigator_private.checklist_checkout_key
    where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise insufficient_privilege; end if;

  select * into item from navigator_private.checklist_orders
  where account_id=v_buyer and product='checklist' and captured_at is not null and cancelled_at is null
    and (p_id is null or id=p_id)
  order by captured_at desc,id desc limit 1;
  if not found then return null; end if;
  expires := item.captured_at + interval '2880 hours';
  return jsonb_build_object('id',item.id,'organisation',item.organisation,'edition',item.inquiry_edition,
    'accessUntil',expires,'active',statement_timestamp()<expires);
end $$;
revoke all on function navigator_checklist_internal.online_access(text,text) from public,anon;
grant execute on function navigator_checklist_internal.online_access(text,text) to authenticated;

create function public.navigator_online_checklist(p_token text,p_id text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select navigator_checklist_internal.online_access(p_token,p_id);
$$;
revoke all on function public.navigator_online_checklist(text,text) from public,anon;
grant execute on function public.navigator_online_checklist(text,text) to authenticated;

