-- Account-bound test orders only. Guide selections and recovery files stay local.
create table navigator_private.individual_guide_test_orders (
  id text primary key check (id ~ '^NAVTEST-[0-9a-f-]{36}$'),
  account_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('aggrieved','respondent')),
  terms_version text not null check (length(terms_version) between 1 and 80),
  created_at timestamptz not null default clock_timestamp(),
  activated_at timestamptz check (activated_at >= created_at)
);
create index individual_guide_test_orders_account_idx
  on navigator_private.individual_guide_test_orders (account_id, product, activated_at desc);
alter table navigator_private.individual_guide_test_orders enable row level security;
revoke all on navigator_private.individual_guide_test_orders from public, anon, authenticated;

create function navigator_private.individual_guide_test_access(
  p_token text, p_action text, p_id text, p_product text, p_terms_version text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  buyer uuid := auth.uid();
  item navigator_private.individual_guide_test_orders;
  checked_at timestamptz;
begin
  if buyer is null or not navigator_private.verified_session() or
      p_token is null or length(p_token)<>64 or not exists (
        select 1 from navigator_private.checklist_checkout_key
        where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
      ) then
    raise insufficient_privilege;
  end if;

  case p_action
    when 'create' then
      insert into navigator_private.individual_guide_test_orders(id,account_id,product,terms_version)
      values(p_id,buyer,p_product,p_terms_version) returning * into item;
    when 'confirm' then
      select * into item from navigator_private.individual_guide_test_orders
      where id=p_id and account_id=buyer for update;
      if not found then return null; end if;
      checked_at:=clock_timestamp();
      if item.activated_at is null then
        if checked_at>=item.created_at+interval '15 minutes' then return null; end if;
        update navigator_private.individual_guide_test_orders
        set activated_at=checked_at where id=item.id returning * into item;
      elsif checked_at>=item.activated_at+interval '2160 hours' then
        return null;
      end if;
    when 'access' then
      select * into item from navigator_private.individual_guide_test_orders
      where account_id=buyer and product=p_product
        and activated_at>statement_timestamp()-interval '2160 hours'
        and activated_at<=statement_timestamp()
      order by activated_at desc, id desc limit 1;
      if not found then return null; end if;
    else
      raise invalid_parameter_value;
  end case;

  return jsonb_build_object(
    'id',item.id,'product',item.product,'termsVersion',item.terms_version,
    'expires',item.created_at+interval '15 minutes',
    'until',item.activated_at+interval '2160 hours'
  );
end $$;
revoke all on function navigator_private.individual_guide_test_access(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function navigator_private.individual_guide_test_access(text,text,text,text,text)
  to authenticated;

create function public.navigator_individual_guide_test_access(
  p_token text, p_action text, p_id text default null, p_product text default null,
  p_terms_version text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select navigator_private.individual_guide_test_access(p_token,p_action,p_id,p_product,p_terms_version);
$$;
revoke all on function public.navigator_individual_guide_test_access(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.navigator_individual_guide_test_access(text,text,text,text,text)
  to authenticated;
