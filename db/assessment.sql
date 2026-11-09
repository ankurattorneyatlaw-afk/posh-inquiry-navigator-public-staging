create table navigator_private.compliance_assessment_catalogue (
  version integer primary key,
  checks jsonb not null check (jsonb_typeof(checks) = 'array')
);
create table navigator_private.compliance_assessments (
  order_id text primary key,
  account_id uuid not null,
  catalogue_version integer not null references navigator_private.compliance_assessment_catalogue(version),
  scope jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  final_snapshot jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table navigator_private.compliance_assessment_catalogue enable row level security;
alter table navigator_private.compliance_assessments enable row level security;
revoke all on navigator_private.compliance_assessment_catalogue, navigator_private.compliance_assessments from public, anon, authenticated;

create function public.navigator_compliance_assessment(
  p_token text, p_gateway text, p_order text, p_action text, p_payload jsonb, p_revision integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  buyer uuid := auth.uid();
  purchase jsonb;
  item navigator_private.compliance_assessments;
  selected_version integer;
  catalogue jsonb;
begin
  purchase := navigator_private.checklist_product_order(p_token,'get',p_gateway,p_order,null,null,'compliance-checklist');
  if buyer is null or purchase is null or purchase->>'captured' <> 'true' or purchase->>'cancelled' = 'true' then return null; end if;
  if p_action = 'start' then
    select max(version) into strict selected_version from navigator_private.compliance_assessment_catalogue;
    if jsonb_typeof(p_payload) is distinct from 'object' or selected_version is null then raise invalid_parameter_value; end if;
    insert into navigator_private.compliance_assessments(order_id,account_id,catalogue_version,scope)
      values(p_order,buyer,selected_version,p_payload) on conflict (order_id) do nothing;
  elsif p_action in ('save','finish') then
    select * into item from navigator_private.compliance_assessments
      where order_id=p_order and account_id=buyer for update;
    if item.order_id is null or item.revision is distinct from p_revision or item.final_snapshot is not null then
      return jsonb_build_object('conflict',true);
    end if;
    update navigator_private.compliance_assessments
      set answers=case when p_action='save' then jsonb_set(answers,array[p_payload->>'id'],p_payload->'answer',true) else answers end,
          final_snapshot=case when p_action='finish' then p_payload else final_snapshot end,
          revision=revision+1, updated_at=now()
      where order_id=p_order and account_id=buyer;
  elsif p_action is distinct from 'read' then
    raise invalid_parameter_value;
  end if;
  select * into item from navigator_private.compliance_assessments where order_id=p_order and account_id=buyer;
  if item.order_id is not null and item.final_snapshot is null then
    select checks into catalogue from navigator_private.compliance_assessment_catalogue where version=item.catalogue_version;
  end if;
  return jsonb_build_object('organisation',purchase->>'organisation','order',p_order,'scope',item.scope,
    'answers',item.answers,'revision',item.revision,'final',item.final_snapshot,'catalogue',catalogue);
end;
$$;
revoke all on function public.navigator_compliance_assessment(text,text,text,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.navigator_compliance_assessment(text,text,text,text,jsonb,integer) to authenticated;
