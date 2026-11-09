
create function navigator_recovery_internal.save_sales_enquiry(p_token text,p_enquiry jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_token is null or length(p_token)<>64 or not exists (
    select 1 from navigator_private.checklist_checkout_key where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise insufficient_privilege; end if;
  if jsonb_typeof(p_enquiry) is distinct from 'object' or (p_enquiry->>'consent') is distinct from 'true'
  then raise invalid_parameter_value; end if;
  insert into public.navigator_sales_enquiries(id,contact_name,email,organisation,role,plan,need,users,consent)
  values ((p_enquiry->>'id')::uuid,p_enquiry->>'contact_name',p_enquiry->>'email',
    p_enquiry->>'organisation',p_enquiry->>'role',p_enquiry->>'plan',p_enquiry->>'need',p_enquiry->>'users',true);
end $$;
revoke all on function navigator_recovery_internal.save_sales_enquiry(text,jsonb) from public;
grant execute on function navigator_recovery_internal.save_sales_enquiry(text,jsonb) to anon;
create function public.navigator_save_sales_enquiry(p_token text,p_enquiry jsonb)
returns void language sql security invoker set search_path='' as $$
  select navigator_recovery_internal.save_sales_enquiry(p_token,p_enquiry);
$$;
revoke all on function public.navigator_save_sales_enquiry(text,jsonb) from public, authenticated;
grant execute on function public.navigator_save_sales_enquiry(text,jsonb) to anon;
revoke insert on public.navigator_sales_enquiries from anon, authenticated;

