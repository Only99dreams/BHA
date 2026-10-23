-- ============================================================================
-- BHA Phase 1: RLS Fix & Status Transition Trigger
-- Uses SECURITY DEFINER function to avoid JWT timing issues.
-- Adds server-side state machine enforcement.
-- ============================================================================

-- Drop the broken policies
drop policy if exists "Admins can manage categories" on public.categories;
drop policy if exists "Admins can manage subcategories" on public.subcategories;
drop policy if exists "Owners can manage their business categories" on public.business_categories;
drop policy if exists "Admins can manage attributes" on public.category_attributes;
drop policy if exists "Owners can manage their attribute values" on public.business_attribute_values;
drop policy if exists "Owners can manage their locations" on public.business_locations;
drop policy if exists "Admins can manage business type vocabulary" on public.business_type_vocabulary;
drop policy if exists "Admins can manage redirects" on public.legacy_redirects;

-- Create SECURITY DEFINER function to check admin role
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('ADMIN', 'REVIEWER')
  )
$$;

-- Recreate admin policies using the function
create policy "Admins can manage categories" on public.categories for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage subcategories" on public.subcategories for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Owners can manage their business categories" on public.business_categories for all
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "Admins can manage attributes" on public.category_attributes for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Owners can manage their attribute values" on public.business_attribute_values for all
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "Owners can manage their locations" on public.business_locations for all
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "Admins can manage business type vocabulary" on public.business_type_vocabulary for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage redirects" on public.legacy_redirects for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Status Transition Enforcement (State Machine)
-- ============================================================================
create or replace function public.validate_business_status_transition(
  old_status text,
  new_status text
)
returns boolean
language plpgsql
as $$
begin
  return case
    when old_status = 'APPLICATION_STARTED' and new_status in ('VERIFICATION_PENDING', 'VERIFICATION_FAILED') then true
    when old_status = 'VERIFICATION_PENDING' and new_status in ('VERIFIED', 'VERIFICATION_FAILED') then true
    when old_status = 'VERIFIED' and new_status in ('PAYMENT_PENDING') then true
    when old_status = 'PAYMENT_PENDING' and new_status in ('PAID', 'VERIFICATION_FAILED') then true
    when old_status = 'PAID' and new_status in ('INFORMATION_PENDING') then true
    when old_status = 'INFORMATION_PENDING' and new_status in ('INFORMATION_RECEIVED') then true
    when old_status = 'INFORMATION_RECEIVED' and new_status in ('AI_PAGE_GENERATING') then true
    when old_status = 'AI_PAGE_GENERATING' and new_status in ('QUALITY_REVIEW') then true
    when old_status = 'QUALITY_REVIEW' and new_status in ('APPROVED', 'INFORMATION_PENDING') then true
    when old_status = 'APPROVED' and new_status in ('LIVE') then true
    when old_status = 'LIVE' and new_status in ('RENEWAL_DUE', 'SUSPENDED', 'EXPIRED') then true
    when old_status = 'RENEWAL_DUE' and new_status in ('LIVE', 'EXPIRED') then true
    when old_status = 'EXPIRED' and new_status in ('APPLICATION_STARTED') then true
    when old_status = 'SUSPENDED' and new_status in ('APPLICATION_STARTED') then true
    else false
  end;
end;
$$;

create or replace function public.check_business_status_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status is distinct from old.status then
    if not public.validate_business_status_transition(old.status, new.status) then
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
    -- Log the transition
    insert into public.audit_logs (actor_id, business_id, action, details)
    values (auth.uid(), new.id, 'STATUS_CHANGE',
            jsonb_build_object('from', old.status, 'to', new.status, 'changed_at', now()));
  end if;
  return new;
end;
$$;

drop trigger if exists business_status_transition on public.businesses;
create trigger business_status_transition
  before update of status on public.businesses
  for each row execute function public.check_business_status_trigger();
