-- Store only numbered tick states. A cleared tick is retained so an older
-- browser's one-time import cannot restore a tick cleared on another device.
create table navigator_private.inquiry_checklist_progress (
  order_id text not null references navigator_private.checklist_orders(id) on delete cascade,
  item_number smallint not null check (item_number between 1 and 43),
  checked boolean not null,
  primary key (order_id,item_number)
);
alter table navigator_private.inquiry_checklist_progress enable row level security;
revoke all on navigator_private.inquiry_checklist_progress from public,anon,authenticated;

create function navigator_checklist_internal.online_progress(
  p_token text,p_id text,p_number smallint,p_checked boolean,p_import smallint[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  entitlement jsonb;
  order_ref text;
  ticks jsonb;
begin
  entitlement:=navigator_checklist_internal.online_access(p_token,p_id);
  if entitlement is null or not coalesce((entitlement->>'active')::boolean,false) then
    return entitlement;
  end if;
  order_ref:=entitlement->>'id';

  if p_import is not null then
    if p_id is null or p_number is not null or p_checked is not null or cardinality(p_import)>43
      or exists(select 1 from unnest(p_import) n where n is null or n not between 1 and 43)
    then raise invalid_parameter_value; end if;
    insert into navigator_private.inquiry_checklist_progress(order_id,item_number,checked)
      select order_ref,n,true from unnest(p_import) n
      on conflict(order_id,item_number) do nothing;
  elsif p_number is not null or p_checked is not null then
    if p_id is null or p_number is null or p_number not between 1 and 43 or p_checked is null
    then raise invalid_parameter_value; end if;
    insert into navigator_private.inquiry_checklist_progress(order_id,item_number,checked)
      values(order_ref,p_number,p_checked)
      on conflict(order_id,item_number) do update set checked=excluded.checked;
  end if;

  select coalesce(jsonb_agg(item_number order by item_number),'[]'::jsonb) into ticks
  from navigator_private.inquiry_checklist_progress where order_id=order_ref and checked;
  return entitlement||jsonb_build_object('checked',ticks);
end $$;
revoke all on function navigator_checklist_internal.online_progress(text,text,smallint,boolean,smallint[]) from public,anon;
grant execute on function navigator_checklist_internal.online_progress(text,text,smallint,boolean,smallint[]) to authenticated;

create function public.navigator_inquiry_checklist_progress(
  p_token text,p_id text default null,p_number smallint default null,
  p_checked boolean default null,p_import smallint[] default null
) returns jsonb language sql security invoker set search_path='' as $$
  select navigator_checklist_internal.online_progress(p_token,p_id,p_number,p_checked,p_import);
$$;
revoke all on function public.navigator_inquiry_checklist_progress(text,text,smallint,boolean,smallint[]) from public,anon;
grant execute on function public.navigator_inquiry_checklist_progress(text,text,smallint,boolean,smallint[]) to authenticated;
