-- ============================================================================
-- BHA owner workflow: onboarding, page generation, page editing, review.
--
-- The original schema only granted public read access. Without these policies
-- an authenticated business owner cannot create or update their business, its
-- profile, services, socials or page versions, so onboarding silently failed.
-- This migration makes the owner flow actually work.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Legacy taxonomy columns are no longer required.
--    The 22-category taxonomy lives on primary_category_id and
--    business_type_vocabulary_id. industry_id / business_type_id remain for
--    backwards compatibility but must not block new businesses.
-- ----------------------------------------------------------------------------
alter table public.businesses alter column industry_id drop not null;
alter table public.businesses alter column business_type_id drop not null;

-- ----------------------------------------------------------------------------
-- 2. Admin helper (same definition as 003, recreated so this migration can be
--    applied safely on databases where 003 was skipped).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Useful indexes.
-- ----------------------------------------------------------------------------
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists page_versions_business_status_idx
  on public.page_versions (business_id, status, version desc);
create index if not exists business_services_business_idx on public.business_services (business_id);
create index if not exists business_socials_business_idx on public.business_socials (business_id);

-- ----------------------------------------------------------------------------
-- 4. updated_at maintenance.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_touch_updated_at on public.businesses;
create trigger businesses_touch_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();

drop trigger if exists business_profiles_touch_updated_at on public.business_profiles;
create trigger business_profiles_touch_updated_at
  before update on public.business_profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Owners can write their own business record.
-- ----------------------------------------------------------------------------
drop policy if exists "Owners can insert their own business" on public.businesses;
create policy "Owners can insert their own business" on public.businesses
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update their own business" on public.businesses;
create policy "Owners can update their own business" on public.businesses
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can delete their own business" on public.businesses;
create policy "Owners can delete their own business" on public.businesses
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Admins can manage businesses" on public.businesses;
create policy "Admins can manage businesses" on public.businesses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Owner access to the business profile and child records.
-- ----------------------------------------------------------------------------
drop policy if exists "Anyone can view profiles for published businesses" on public.business_profiles;
create policy "Anyone can view profiles for published businesses" on public.business_profiles
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.is_published and b.status = 'LIVE'
  ));

drop policy if exists "Owners can view their business profile" on public.business_profiles;
create policy "Owners can view their business profile" on public.business_profiles
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can manage their business profile" on public.business_profiles;
create policy "Owners can manage their business profile" on public.business_profiles
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage business profiles" on public.business_profiles;
create policy "Admins can manage business profiles" on public.business_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Owners can manage their services" on public.business_services;
create policy "Owners can manage their services" on public.business_services
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage services" on public.business_services;
create policy "Admins can manage services" on public.business_services
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Owners can manage their socials" on public.business_socials;
create policy "Owners can manage their socials" on public.business_socials
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage socials" on public.business_socials;
create policy "Admins can manage socials" on public.business_socials
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Owners can manage their media" on public.business_media;
create policy "Owners can manage their media" on public.business_media
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage media" on public.business_media;
create policy "Admins can manage media" on public.business_media
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. Page versions: owners edit drafts; the public sees only published pages
--    for live businesses; admins review everything.
-- ----------------------------------------------------------------------------
drop policy if exists "Anyone can view published page versions" on public.page_versions;
create policy "Anyone can view published page versions" on public.page_versions
  for select using (
    status = 'PUBLISHED'
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_published and b.status = 'LIVE'
    )
  );

drop policy if exists "Owners can view their page versions" on public.page_versions;
create policy "Owners can view their page versions" on public.page_versions
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can create their page versions" on public.page_versions;
create policy "Owners can create their page versions" on public.page_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can update their page versions" on public.page_versions;
create policy "Owners can update their page versions" on public.page_versions
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage page versions" on public.page_versions;
create policy "Admins can manage page versions" on public.page_versions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. Owners can read their subscription/payment state (dashboard display).
-- ----------------------------------------------------------------------------
drop policy if exists "Owners can view their subscriptions" on public.subscriptions;
create policy "Owners can view their subscriptions" on public.subscriptions
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions" on public.subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Owners can view their payments" on public.payments;
create policy "Owners can view their payments" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments" on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. Owners can see and manage their enquiries/bookings (dashboard).
-- ----------------------------------------------------------------------------
drop policy if exists "Owners can view their enquiries" on public.enquiries;
create policy "Owners can view their enquiries" on public.enquiries
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can manage their enquiries" on public.enquiries;
create policy "Owners can manage their enquiries" on public.enquiries
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can view their bookings" on public.bookings;
create policy "Owners can view their bookings" on public.bookings
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can manage their bookings" on public.bookings;
create policy "Owners can manage their bookings" on public.bookings
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- 10. Audit trail access. The status trigger writes with SECURITY DEFINER, but
--     admin actions from the review panel insert directly, so allow that here.
-- ----------------------------------------------------------------------------
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs" on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert audit logs" on public.audit_logs;
create policy "Admins can insert audit logs" on public.audit_logs
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Owners can view their audit logs" on public.audit_logs;
create policy "Owners can view their audit logs" on public.audit_logs
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));
