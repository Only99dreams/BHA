-- ============================================================================
-- BHA Phase 1: Data Migration — 15 Old Industries → 22 New Categories
-- Preserves all existing business records, maps old industry IDs to new
-- categories, and creates legacy URL redirects.
-- ============================================================================

-- Step 1: Map existing businesses to new categories via business_categories
-- ============================================================================
insert into public.business_categories (business_id, category_id, subcategory_id, is_primary)
select
  b.id as business_id,
  c.id as category_id,
  null as subcategory_id, -- subcategory mapping can be refined later
  true as is_primary
from public.businesses b
join public.categories c on c.legacy_industry_id = b.industry_id
on conflict (business_id, category_id) do nothing;

-- Step 2: Set primary_category_id on businesses table
-- ============================================================================
update public.businesses b
set primary_category_id = bc.category_id
from public.business_categories bc
where bc.business_id = b.id and bc.is_primary;

-- Step 3: Map old business_type_id → new business_type_vocabulary
-- ============================================================================
-- Old business_types are industry-scoped; map them to the global vocabulary
update public.businesses b
set business_type_vocabulary_id = btv.id
from public.business_types bt
join public.business_type_vocabulary btv on lower(bt.name) = lower(btv.name)
where b.business_type_id = bt.id;

-- Step 4: Set verification_status based on existing is_verified flag
-- ============================================================================
update public.businesses
set verification_status = case
  when is_verified then 'VERIFIED'
  else 'UNVERIFIED'
end;

-- Step 5: Set payment_status based on existing status
-- ============================================================================
update public.businesses
set payment_status = case
  when status in ('PAID', 'INFORMATION_PENDING', 'INFORMATION_RECEIVED', 'AI_PAGE_GENERATING', 'QUALITY_REVIEW', 'APPROVED', 'LIVE', 'RENEWAL_DUE') then 'PAID'
  when status in ('PAYMENT_PENDING') then 'PENDING'
  else 'UNPAID'
end;

-- Step 6: Set publication_status based on existing status
-- ============================================================================
update public.businesses
set publication_status = case
  when status = 'LIVE' then 'PUBLISHED'
  when status in ('APPROVED') then 'APPROVED'
  when status in ('QUALITY_REVIEW', 'AI_PAGE_GENERATING') then 'IN_REVIEW'
  when status in ('SUSPENDED', 'EXPIRED') then 'SUSPENDED'
  else 'DRAFT'
end;

-- Step 7: Create legacy URL redirects for old industry pages
-- Old industry pages were served at /industry/<industry-slug>; they now map to
-- the corresponding /category/<category-slug>. The app resolves
-- legacy_redirects.old_slug = 'industry/<slug>' → new_slug.
-- ============================================================================
insert into public.legacy_redirects (old_slug, new_slug)
select
  'industry/' || i.slug,
  'category/' || c.slug
from public.industries i
join public.categories c on c.legacy_industry_id = i.id
on conflict (old_slug) do nothing;

-- Step 8: Backfill business_locations from existing business_profiles
-- ============================================================================
insert into public.business_locations (business_id, location_type, country_code, region, city, address, latitude, longitude, is_primary)
select
  bp.business_id,
  'HEADQUARTERS',
  b.country_code,
  bp.region,
  b.city,
  bp.address,
  bp.latitude,
  bp.longitude,
  true
from public.business_profiles bp
join public.businesses b on b.id = bp.business_id
where b.country_code is not null
on conflict (business_id, location_type, is_primary) do nothing;

-- Step 9: (removed) business_profiles has no city column; city lives on
-- businesses and is already populated during onboarding.
-- ============================================================================

-- Step 10: Update search_text to include category/subcategory names
-- ============================================================================
update public.businesses b
set search_text = concat_ws(' ',
  b.business_name,
  b.short_description,
  coalesce(b.city, ''),
  coalesce((select string_agg(c.name || ' ' || coalesce(sc.name, ''), ' ')
    from public.business_categories bc
    join public.categories c on c.id = bc.category_id
    left join public.subcategories sc on sc.id = bc.subcategory_id
    where bc.business_id = b.id), ''),
  coalesce((select string_agg(bav.value, ' ')
    from public.business_attribute_values bav
    where bav.business_id = b.id), '')
);

-- Step 11: Verification counts by category (for migration validation)
-- ============================================================================
select
  c.name as category_name,
  count(bc.business_id) as business_count
from public.categories c
left join public.business_categories bc on bc.category_id = c.id
group by c.name, c.sort_order
order by c.sort_order;

-- Step 12: Summary of migration results
-- ============================================================================
select
  'Total businesses' as metric,
  count(*)::text as value
from public.businesses
union all
select
  'Businesses with primary category',
  count(*)::text
from public.businesses
where primary_category_id is not null
union all
select
  'Businesses with category associations',
  count(distinct business_id)::text
from public.business_categories
union all
select
  'Businesses with business type vocabulary',
  count(*)::text
from public.businesses
where business_type_vocabulary_id is not null
union all
select
  'Legacy redirects created',
  count(*)::text
from public.legacy_redirects
union all
select
  'Locations backfilled',
  count(*)::text
from public.business_locations;
