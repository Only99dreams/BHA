-- ============================================================================
-- BHA Phase 1: Taxonomy Foundation Migration
-- Creates new tables for 22-category taxonomy with many-to-many associations,
-- structured filters, and global business type vocabulary.
-- ============================================================================

-- 1. CATEGORIES (top-level taxonomy, replaces industries)
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  seo_title text,
  seo_description text,
  icon_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  legacy_industry_id uuid, -- for migration mapping back to old industries.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. SUBCATEGORIES (second-level grouping within categories)
-- ============================================================================
create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name),
  unique (category_id, slug)
);

-- 3. BUSINESS_CATEGORIES (many-to-many join with primary/secondary flag)
-- ============================================================================
create table if not exists public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (business_id, category_id)
);

-- A business has exactly one primary category, but any number of secondary
-- associations. A partial unique index enforces this (a plain unique constraint
-- on (business_id, is_primary) would cap a business at two associations).
alter table public.business_categories drop constraint if exists primary_category_unique;
create unique index if not exists business_categories_one_primary_idx
  on public.business_categories (business_id) where is_primary;

-- 4. CATEGORY_ATTRIBUTES (filter definitions per category/subcategory)
-- ============================================================================
create table if not exists public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  key text not null,
  label text not null,
  data_type text not null check (data_type in ('STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'MULTI_ENUM', 'RANGE')),
  allowed_values jsonb,
  is_searchable boolean not null default true,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  validation_rules jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

-- 5. BUSINESS_ATTRIBUTE_VALUES (typed filter values per business)
-- ============================================================================
create table if not exists public.business_attribute_values (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  attribute_id uuid not null references public.category_attributes(id) on delete cascade,
  value text not null,
  value_jsonb jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, attribute_id)
);

-- 6. BUSINESS_LOCATIONS (structured location + service areas)
-- ============================================================================
create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_type text not null check (location_type in ('HEADQUARTERS', 'BRANCH', 'SERVICE_AREA')),
  country_code text not null references public.countries(code),
  region text,
  city text not null default '',
  address text,
  latitude double precision,
  longitude double precision,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint business_primary_location unique (business_id, location_type, is_primary)
);

-- 7. BUSINESS_TYPE_VOCABULARY (global, decoupled from industry)
-- ============================================================================
create table if not exists public.business_type_vocabulary (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 8. LEGACY_REDIRECTS (URL redirect mapping for old → new slugs)
-- ============================================================================
create table if not exists public.legacy_redirects (
  id uuid primary key default gen_random_uuid(),
  old_slug text not null unique,
  new_slug text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  redirect_type integer not null default 301,
  created_at timestamptz not null default now()
);

-- 9. MODIFY BUSINESSES TABLE (add new columns, keep old for migration)
-- ============================================================================
alter table public.businesses
  add column if not exists primary_category_id uuid references public.categories(id),
  add column if not exists primary_subcategory_id uuid references public.subcategories(id),
  add column if not exists business_type_vocabulary_id uuid references public.business_type_vocabulary(id),
  add column if not exists verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED', 'MANUAL_REVIEW')),
  add column if not exists payment_status text not null default 'UNPAID'
    check (payment_status in ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  add column if not exists publication_status text not null default 'DRAFT'
    check (publication_status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUSPENDED', 'EXPIRED'));

-- 10. INDEXES
-- ============================================================================
create index if not exists subcategories_category_idx on public.subcategories (category_id, sort_order);
create index if not exists business_categories_business_idx on public.business_categories (business_id);
create index if not exists business_categories_category_idx on public.business_categories (category_id);
create index if not exists business_categories_subcategory_idx on public.business_categories (subcategory_id);
create index if not exists category_attributes_category_idx on public.category_attributes (category_id, sort_order);
create index if not exists category_attributes_subcategory_idx on public.category_attributes (subcategory_id);
create index if not exists business_attribute_values_business_idx on public.business_attribute_values (business_id);
create index if not exists business_attribute_values_attribute_idx on public.business_attribute_values (attribute_id);
create index if not exists business_locations_business_idx on public.business_locations (business_id);
create index if not exists business_locations_country_idx on public.business_locations (country_code);
create index if not exists legacy_redirects_old_slug_idx on public.legacy_redirects (old_slug);

-- 11. ROW LEVEL SECURITY
-- ============================================================================
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.business_categories enable row level security;
alter table public.category_attributes enable row level security;
alter table public.business_attribute_values enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_type_vocabulary enable row level security;
alter table public.legacy_redirects enable row level security;

-- RLS Policies: Categories
drop policy if exists "Anyone can view active categories" on public.categories;
create policy "Anyone can view active categories" on public.categories for select using (is_active);
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('ADMIN', 'REVIEWER')));

-- RLS Policies: Subcategories
drop policy if exists "Anyone can view active subcategories" on public.subcategories;
create policy "Anyone can view active subcategories" on public.subcategories for select using (is_active);
drop policy if exists "Admins can manage subcategories" on public.subcategories;
create policy "Admins can manage subcategories" on public.subcategories for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('ADMIN', 'REVIEWER')));

-- RLS Policies: Business Categories
drop policy if exists "Anyone can view business categories" on public.business_categories;
create policy "Anyone can view business categories" on public.business_categories for select using (true);
drop policy if exists "Owners can manage their business categories" on public.business_categories;
create policy "Owners can manage their business categories" on public.business_categories for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- RLS Policies: Category Attributes
drop policy if exists "Anyone can view active attributes" on public.category_attributes;
create policy "Anyone can view active attributes" on public.category_attributes for select using (is_active);
drop policy if exists "Admins can manage attributes" on public.category_attributes;
create policy "Admins can manage attributes" on public.category_attributes for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('ADMIN', 'REVIEWER')));

-- RLS Policies: Business Attribute Values
drop policy if exists "Anyone can view attribute values for published businesses" on public.business_attribute_values;
create policy "Anyone can view attribute values for published businesses" on public.business_attribute_values for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.is_published and b.status = 'LIVE')
);
drop policy if exists "Owners can manage their attribute values" on public.business_attribute_values;
create policy "Owners can manage their attribute values" on public.business_attribute_values for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- RLS Policies: Business Locations
drop policy if exists "Anyone can view locations for published businesses" on public.business_locations;
create policy "Anyone can view locations for published businesses" on public.business_locations for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.is_published and b.status = 'LIVE')
);
drop policy if exists "Owners can manage their locations" on public.business_locations;
create policy "Owners can manage their locations" on public.business_locations for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- RLS Policies: Business Type Vocabulary
drop policy if exists "Anyone can view active business types" on public.business_type_vocabulary;
create policy "Anyone can view active business types" on public.business_type_vocabulary for select using (is_active);
drop policy if exists "Admins can manage business type vocabulary" on public.business_type_vocabulary;
create policy "Admins can manage business type vocabulary" on public.business_type_vocabulary for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('ADMIN', 'REVIEWER')));

-- RLS Policies: Legacy Redirects
drop policy if exists "Anyone can view redirects" on public.legacy_redirects;
create policy "Anyone can view redirects" on public.legacy_redirects for select using (true);
drop policy if exists "Admins can manage redirects" on public.legacy_redirects;
create policy "Admins can manage redirects" on public.legacy_redirects for all to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('ADMIN', 'REVIEWER')));

-- 12. SEED DATA: 22 Master Categories
-- ============================================================================
insert into public.categories (name, slug, description, sort_order, legacy_industry_id)
select c.name, c.slug, c.description, c.sort_order, i.id
from (values
  ('Agriculture, Agribusiness & Agricultural Technology', 'agriculture-agribusiness', 'Crop farming, livestock, fisheries, agro-processing, AgTech and agricultural services across Africa.', 1, 'Agriculture & Food'),
  ('Business & Corporate Services', 'business-corporate-services', 'Business registration, consulting, training, compliance, accounting, HR and professional support services.', 2, 'Business Services'),
  ('Commerce, Retail & E-commerce', 'commerce-retail-ecommerce', 'General retail, wholesale, online stores, marketplaces, electronics, fashion, building materials and FMCG.', 3, 'Commerce & Retail'),
  ('Construction, Engineering & Infrastructure', 'construction-engineering-infrastructure', 'Building contractors, civil engineering, architecture, project management and infrastructure development.', 4, 'Construction'),
  ('Creative, Media & Entertainment', 'creative-media-entertainment', 'Advertising, design, photography, film, music, publishing, PR, gaming and creative enterprises.', 5, 'Creative & Media'),
  ('Green Economy, Energy & Environment', 'green-economy-energy-environment', 'Solar, renewables, energy efficiency, waste management, water treatment, climate tech and conservation.', 6, 'Green Economy'),
  ('Health, Medical & Wellness', 'health-medical-wellness', 'Hospitals, clinics, diagnostics, pharmacies, telemedicine, dental, mental health and wellness services.', 7, 'Health & Wellness'),
  ('Hospitality, Tourism & Leisure', 'hospitality-tourism-leisure', 'Hotels, restaurants, lodges, travel agencies, tour operators, car hire and leisure facilities.', 8, 'Hospitality & Tourism'),
  ('Logistics, Courier & Supply Chain', 'logistics-courier-supply-chain', 'Courier, freight forwarding, haulage, warehousing, cold chain, customs clearing and last-mile delivery.', 9, 'Logistics'),
  ('Manufacturing & Industrial Production', 'manufacturing-industrial-production', 'Food/beverage, textiles, electronics, automotive, pharmaceuticals, metal fabrication and industrial maintenance.', 10, 'Manufacturing'),
  ('Professional & Legal Services', 'professional-legal-services', 'Law firms, audit, management consulting, engineering consultancy, translation and professional coaching.', 11, 'Professional Services'),
  ('Real Estate & Property Services', 'real-estate-property-services', 'Residential/commercial sales, rentals, property development, management, valuation and facilities management.', 12, 'Real Estate'),
  ('Education, Schools & Training', 'education-schools-training', 'Nursery, primary, secondary, vocational, universities, professional certification and corporate training.', 13, 'Education'),
  ('Technology, Software & Digital Services', 'technology-software-digital', 'Software development, web/mobile apps, IT support, cloud, cybersecurity, AI, FinTech and IoT.', 14, 'Technology'),
  ('Transportation, Mobility & Aviation', 'transportation-mobility-aviation', 'Bus/coach, ride-hailing, car rental, corporate transport, aviation, vehicle sales/repair and mobility tech.', 15, 'Transportation'),
  ('Fashion, Beauty & Lifestyle', 'fashion-beauty-lifestyle', 'Fashion designers, tailoring, footwear, jewellery, beauty salons, barbershops, styling and lifestyle products.', 16, null),
  ('Food, Beverage & Catering', 'food-beverage-catering', 'Food production, packaged foods, beverage production, bakeries, catering, meal delivery and food distribution.', 17, null),
  ('Mining, Natural Resources & Commodities', 'mining-natural-resources-commodities', 'Mining, quarrying, solid minerals, oil & gas services, commodity trading and mineral exporters.', 18, null),
  ('Financial Services, Payments & Insurance', 'financial-services-payments-insurance', 'Banks, payment providers, FinTech, insurance, pensions, loans, investment advisory and FX/remittance.', 19, null),
  ('Events, Conferences & Experiences', 'events-conferences-experiences', 'Event planners, conference organisers, venues, AV technology, rentals, decor and event staffing.', 20, null),
  ('Home, Repair & Personal Services', 'home-repair-personal-services', 'Cleaning, plumbing/electrical repairs, pest control, gardening, security, laundry and pet care.', 21, null),
  ('NGOs, Social Enterprises & Development', 'ngos-social-enterprises-development', 'NGOs, CBOs, social enterprises, foundations, youth development, women''s empowerment and impact ventures.', 22, null)
) as c(name, slug, description, sort_order, legacy_name)
left join public.industries i on i.name = c.legacy_name
on conflict (slug) do nothing;

-- 13. SEED DATA: Subcategories for all 22 categories
-- ============================================================================
-- Category 1: Agriculture
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Agriculture, Agribusiness & Agricultural Technology', 'Crop farming & plantations', 'crop-farming-plantations', 1),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Livestock & poultry', 'livestock-poultry', 2),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Fisheries & aquaculture', 'fisheries-aquaculture', 3),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Agro-processing', 'agro-processing', 4),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Agricultural inputs, seeds & fertilisers', 'agricultural-inputs-seeds-fertilisers', 5),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Farm equipment & machinery', 'farm-equipment-machinery', 6),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Irrigation & water systems', 'irrigation-water-systems', 7),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Agricultural drones & precision farming', 'agri-drones-precision-farming', 8),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Farm management & advisory', 'farm-management-advisory', 9),
  ('Agriculture, Agribusiness & Agricultural Technology', 'AgTech', 'agtech', 10),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Agricultural storage, warehousing & cold chain', 'agricultural-storage-warehousing-cold-chain', 11),
  ('Agriculture, Agribusiness & Agricultural Technology', 'Cooperatives & outgrower schemes', 'cooperatives-outgrower-schemes', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 2: Business & Corporate Services
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Business & Corporate Services', 'Business registration', 'business-registration', 1),
  ('Business & Corporate Services', 'Corporate consulting & strategy', 'corporate-consulting-strategy', 2),
  ('Business & Corporate Services', 'Business training & advisory', 'business-training-advisory', 3),
  ('Business & Corporate Services', 'Market research', 'market-research', 4),
  ('Business & Corporate Services', 'Coworking spaces', 'coworking-spaces', 5),
  ('Business & Corporate Services', 'Virtual office services', 'virtual-office-services', 6),
  ('Business & Corporate Services', 'Company secretarial services', 'company-secretarial-services', 7),
  ('Business & Corporate Services', 'Compliance & regulatory support', 'compliance-regulatory-support', 8),
  ('Business & Corporate Services', 'Accounting & bookkeeping', 'accounting-bookkeeping', 9),
  ('Business & Corporate Services', 'Tax advisory', 'tax-advisory', 10),
  ('Business & Corporate Services', 'HR & recruitment', 'hr-recruitment', 11),
  ('Business & Corporate Services', 'Payroll services', 'payroll-services', 12),
  ('Business & Corporate Services', 'Procurement & outsourcing', 'procurement-outsourcing', 13),
  ('Business & Corporate Services', 'BPO', 'bpo', 14),
  ('Business & Corporate Services', 'Quality management & certification support', 'quality-management-certification-support', 15),
  ('Business & Corporate Services', 'Office administration', 'office-administration', 16)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 3: Commerce, Retail & E-commerce
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Commerce, Retail & E-commerce', 'General retail', 'general-retail', 1),
  ('Commerce, Retail & E-commerce', 'Wholesale & distribution', 'wholesale-distribution', 2),
  ('Commerce, Retail & E-commerce', 'Online stores', 'online-stores', 3),
  ('Commerce, Retail & E-commerce', 'Marketplaces & social commerce', 'marketplaces-social-commerce', 4),
  ('Commerce, Retail & E-commerce', 'Electronics & appliances', 'electronics-appliances', 5),
  ('Commerce, Retail & E-commerce', 'Fashion retail', 'fashion-retail', 6),
  ('Commerce, Retail & E-commerce', 'Home, furniture & decor retail', 'home-furniture-decor-retail', 7),
  ('Commerce, Retail & E-commerce', 'Beauty retail', 'beauty-retail', 8),
  ('Commerce, Retail & E-commerce', 'Books & stationery', 'books-stationery', 9),
  ('Commerce, Retail & E-commerce', 'Building materials & hardware', 'building-materials-hardware', 10),
  ('Commerce, Retail & E-commerce', 'FMCG', 'fmcg', 11),
  ('Commerce, Retail & E-commerce', 'Importers & exporters', 'importers-exporters', 12),
  ('Commerce, Retail & E-commerce', 'B2B trade & supply', 'b2b-trade-supply', 13),
  ('Commerce, Retail & E-commerce', 'Franchises', 'franchises', 14)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 4: Construction, Engineering & Infrastructure
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Construction, Engineering & Infrastructure', 'Building contractors', 'building-contractors', 1),
  ('Construction, Engineering & Infrastructure', 'Civil engineering', 'civil-engineering', 2),
  ('Construction, Engineering & Infrastructure', 'Structural engineering', 'structural-engineering', 3),
  ('Construction, Engineering & Infrastructure', 'Architecture', 'architecture', 4),
  ('Construction, Engineering & Infrastructure', 'Quantity surveying', 'quantity-surveying', 5),
  ('Construction, Engineering & Infrastructure', 'Construction & project management', 'construction-project-management', 6),
  ('Construction, Engineering & Infrastructure', 'Roads & bridges', 'roads-bridges', 7),
  ('Construction, Engineering & Infrastructure', 'Electrical installations', 'electrical-installations', 8),
  ('Construction, Engineering & Infrastructure', 'Mechanical engineering', 'mechanical-engineering', 9),
  ('Construction, Engineering & Infrastructure', 'Plumbing & sanitation', 'plumbing-sanitation', 10),
  ('Construction, Engineering & Infrastructure', 'HVAC & refrigeration', 'hvac-refrigeration', 11),
  ('Construction, Engineering & Infrastructure', 'Interior fit-out', 'interior-fit-out', 12),
  ('Construction, Engineering & Infrastructure', 'Construction materials', 'construction-materials', 13),
  ('Construction, Engineering & Infrastructure', 'Water & wastewater infrastructure', 'water-wastewater-infrastructure', 14),
  ('Construction, Engineering & Infrastructure', 'Telecom infrastructure', 'telecom-infrastructure', 15),
  ('Construction, Engineering & Infrastructure', 'Renewable energy installation', 'renewable-energy-installation', 16),
  ('Construction, Engineering & Infrastructure', 'Surveying & geomatics', 'surveying-geomatics', 17)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 5: Creative, Media & Entertainment
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Creative, Media & Entertainment', 'Advertising agencies', 'advertising-agencies', 1),
  ('Creative, Media & Entertainment', 'Branding & graphic design', 'branding-graphic-design', 2),
  ('Creative, Media & Entertainment', 'Photography & videography', 'photography-videography', 3),
  ('Creative, Media & Entertainment', 'Film, TV & video production', 'film-tv-video-production', 4),
  ('Creative, Media & Entertainment', 'Music & audio production', 'music-audio-production', 5),
  ('Creative, Media & Entertainment', 'Publishing & printing', 'publishing-printing', 6),
  ('Creative, Media & Entertainment', 'Journalism & news media', 'journalism-news-media', 7),
  ('Creative, Media & Entertainment', 'Digital content creators', 'digital-content-creators', 8),
  ('Creative, Media & Entertainment', 'Animation & motion graphics', 'animation-motion-graphics', 9),
  ('Creative, Media & Entertainment', 'PR & communications', 'pr-communications', 10),
  ('Creative, Media & Entertainment', 'Talent, artists & entertainment', 'talent-artists-entertainment', 11),
  ('Creative, Media & Entertainment', 'Gaming & interactive media', 'gaming-interactive-media', 12),
  ('Creative, Media & Entertainment', 'Cultural & creative enterprises', 'cultural-creative-enterprises', 13)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 6: Green Economy, Energy & Environment
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Green Economy, Energy & Environment', 'Solar energy & equipment', 'solar-energy-equipment', 1),
  ('Green Economy, Energy & Environment', 'Renewable energy development', 'renewable-energy-development', 2),
  ('Green Economy, Energy & Environment', 'Energy efficiency', 'energy-efficiency', 3),
  ('Green Economy, Energy & Environment', 'Clean cooking & alternative fuels', 'clean-cooking-alternative-fuels', 4),
  ('Green Economy, Energy & Environment', 'Battery storage', 'battery-storage', 5),
  ('Green Economy, Energy & Environment', 'Electric mobility & charging', 'electric-mobility-charging', 6),
  ('Green Economy, Energy & Environment', 'Waste collection & recycling', 'waste-collection-recycling', 7),
  ('Green Economy, Energy & Environment', 'Waste-to-energy & circular economy', 'waste-to-energy-circular-economy', 8),
  ('Green Economy, Energy & Environment', 'Water treatment', 'water-treatment', 9),
  ('Green Economy, Energy & Environment', 'Climate tech & carbon services', 'climate-tech-carbon-services', 10),
  ('Green Economy, Energy & Environment', 'Sustainable agriculture', 'sustainable-agriculture', 11),
  ('Green Economy, Energy & Environment', 'Green building & materials', 'green-building-materials', 12),
  ('Green Economy, Energy & Environment', 'Environmental & sustainability consulting', 'environmental-sustainability-consulting', 13),
  ('Green Economy, Energy & Environment', 'Conservation & biodiversity', 'conservation-biodiversity', 14)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 7: Health, Medical & Wellness
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Health, Medical & Wellness', 'Hospitals & specialist clinics', 'hospitals-specialist-clinics', 1),
  ('Health, Medical & Wellness', 'Primary healthcare', 'primary-healthcare', 2),
  ('Health, Medical & Wellness', 'Diagnostic labs', 'diagnostic-labs', 3),
  ('Health, Medical & Wellness', 'Medical imaging & testing', 'medical-imaging-testing', 4),
  ('Health, Medical & Wellness', 'Pharmacies', 'pharmacies', 5),
  ('Health, Medical & Wellness', 'Medical equipment & supplies', 'medical-equipment-supplies', 6),
  ('Health, Medical & Wellness', 'Telemedicine & digital health', 'telemedicine-digital-health', 7),
  ('Health, Medical & Wellness', 'Dental', 'dental', 8),
  ('Health, Medical & Wellness', 'Optical & eye care', 'optical-eye-care', 9),
  ('Health, Medical & Wellness', 'Mental health & counselling', 'mental-health-counselling', 10),
  ('Health, Medical & Wellness', 'Physiotherapy & rehabilitation', 'physiotherapy-rehabilitation', 11),
  ('Health, Medical & Wellness', 'Fitness & gyms', 'fitness-gyms', 12),
  ('Health, Medical & Wellness', 'Spa & wellness', 'spa-wellness', 13),
  ('Health, Medical & Wellness', 'Occupational health & safety', 'occupational-health-safety', 14),
  ('Health, Medical & Wellness', 'Public health programmes', 'public-health-programmes', 15)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 8: Hospitality, Tourism & Leisure
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Hospitality, Tourism & Leisure', 'Hotels & resorts', 'hotels-resorts', 1),
  ('Hospitality, Tourism & Leisure', 'Guest houses & serviced apartments', 'guest-houses-serviced-apartments', 2),
  ('Hospitality, Tourism & Leisure', 'Lodges & eco-lodges', 'lodges-eco-lodges', 3),
  ('Hospitality, Tourism & Leisure', 'Travel agencies & tour operators', 'travel-agencies-tour-operators', 4),
  ('Hospitality, Tourism & Leisure', 'Tourism experiences & attractions', 'tourism-experiences-attractions', 5),
  ('Hospitality, Tourism & Leisure', 'Visitor car hire', 'visitor-car-hire', 6),
  ('Hospitality, Tourism & Leisure', 'Restaurants & dining', 'restaurants-dining', 7),
  ('Hospitality, Tourism & Leisure', 'Cafés', 'cafes', 8),
  ('Hospitality, Tourism & Leisure', 'Bars & lounges', 'bars-lounges', 9),
  ('Hospitality, Tourism & Leisure', 'Cultural heritage tours', 'cultural-heritage-tours', 10),
  ('Hospitality, Tourism & Leisure', 'Recreation & leisure facilities', 'recreation-leisure-facilities', 11),
  ('Hospitality, Tourism & Leisure', 'Holiday rentals', 'holiday-rentals', 12),
  ('Hospitality, Tourism & Leisure', 'Conference hotels & retreat centres', 'conference-hotels-retreat-centres', 13)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 9: Logistics, Courier & Supply Chain
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Logistics, Courier & Supply Chain', 'Courier & parcel delivery', 'courier-parcel-delivery', 1),
  ('Logistics, Courier & Supply Chain', 'Freight forwarding', 'freight-forwarding', 2),
  ('Logistics, Courier & Supply Chain', 'Road haulage & trucking', 'road-haulage-trucking', 3),
  ('Logistics, Courier & Supply Chain', 'Air freight', 'air-freight', 4),
  ('Logistics, Courier & Supply Chain', 'Sea freight & shipping', 'sea-freight-shipping', 5),
  ('Logistics, Courier & Supply Chain', 'Warehousing & fulfilment', 'warehousing-fulfilment', 6),
  ('Logistics, Courier & Supply Chain', 'Cold chain', 'cold-chain', 7),
  ('Logistics, Courier & Supply Chain', 'Last-mile delivery', 'last-mile-delivery', 8),
  ('Logistics, Courier & Supply Chain', 'Customs clearing & trade facilitation', 'customs-clearing-trade-facilitation', 9),
  ('Logistics, Courier & Supply Chain', 'Supply-chain consulting', 'supply-chain-consulting', 10),
  ('Logistics, Courier & Supply Chain', 'Moving & relocation', 'moving-relocation', 11),
  ('Logistics, Courier & Supply Chain', 'Inventory & distribution', 'inventory-distribution', 12),
  ('Logistics, Courier & Supply Chain', 'Port & terminal services', 'port-terminal-services', 13)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 10: Manufacturing & Industrial Production
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Manufacturing & Industrial Production', 'Food & beverage manufacturing', 'food-beverage-manufacturing', 1),
  ('Manufacturing & Industrial Production', 'Textiles & garments', 'textiles-garments', 2),
  ('Manufacturing & Industrial Production', 'Footwear', 'footwear', 3),
  ('Manufacturing & Industrial Production', 'Electronics & electrical equipment', 'electronics-electrical-equipment', 4),
  ('Manufacturing & Industrial Production', 'Automotive components', 'automotive-components', 5),
  ('Manufacturing & Industrial Production', 'Pharmaceuticals & medical products', 'pharmaceuticals-medical-products', 6),
  ('Manufacturing & Industrial Production', 'Plastics & rubber', 'plastics-rubber', 7),
  ('Manufacturing & Industrial Production', 'Chemicals & industrial materials', 'chemicals-industrial-materials', 8),
  ('Manufacturing & Industrial Production', 'Metal fabrication', 'metal-fabrication', 9),
  ('Manufacturing & Industrial Production', 'Machinery & equipment', 'machinery-equipment', 10),
  ('Manufacturing & Industrial Production', 'Paper, packaging & printing', 'paper-packaging-printing', 11),
  ('Manufacturing & Industrial Production', 'Furniture & wood', 'furniture-wood', 12),
  ('Manufacturing & Industrial Production', 'Building products', 'building-products', 13),
  ('Manufacturing & Industrial Production', 'Cosmetics & personal care', 'cosmetics-personal-care', 14),
  ('Manufacturing & Industrial Production', 'OEM', 'oem', 15),
  ('Manufacturing & Industrial Production', 'Contract manufacturing', 'contract-manufacturing', 16),
  ('Manufacturing & Industrial Production', 'ODM', 'odm', 17),
  ('Manufacturing & Industrial Production', 'Industrial maintenance', 'industrial-maintenance', 18)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 11: Professional & Legal Services
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Professional & Legal Services', 'Law firms & legal practitioners', 'law-firms-legal-practitioners', 1),
  ('Professional & Legal Services', 'Legal advisory & documentation', 'legal-advisory-documentation', 2),
  ('Professional & Legal Services', 'IP & trademark', 'ip-trademark', 3),
  ('Professional & Legal Services', 'Mediation & arbitration', 'mediation-arbitration', 4),
  ('Professional & Legal Services', 'Audit & assurance', 'audit-assurance', 5),
  ('Professional & Legal Services', 'Management consulting', 'management-consulting', 6),
  ('Professional & Legal Services', 'Engineering consultancy', 'engineering-consultancy', 7),
  ('Professional & Legal Services', 'Architecture consultancy', 'architecture-consultancy', 8),
  ('Professional & Legal Services', 'Research & policy advisory', 'research-policy-advisory', 9),
  ('Professional & Legal Services', 'Translation & interpretation', 'translation-interpretation', 10),
  ('Professional & Legal Services', 'Professional coaching', 'professional-coaching', 11),
  ('Professional & Legal Services', 'Project management consultancy', 'project-management-consultancy', 12),
  ('Professional & Legal Services', 'Surveying & valuation', 'surveying-valuation', 13),
  ('Professional & Legal Services', 'Forensic & investigation services', 'forensic-investigation-services', 14)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 12: Real Estate & Property Services
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Real Estate & Property Services', 'Residential sales', 'residential-sales', 1),
  ('Real Estate & Property Services', 'Commercial & industrial property', 'commercial-industrial-property', 2),
  ('Real Estate & Property Services', 'Rentals & leasing', 'rentals-leasing', 3),
  ('Real Estate & Property Services', 'Property development', 'property-development', 4),
  ('Real Estate & Property Services', 'Estate & property management', 'estate-property-management', 5),
  ('Real Estate & Property Services', 'Real estate agencies', 'real-estate-agencies', 6),
  ('Real Estate & Property Services', 'Valuation', 'valuation', 7),
  ('Real Estate & Property Services', 'Facilities management', 'facilities-management', 8),
  ('Real Estate & Property Services', 'Land & property advisory', 'land-property-advisory', 9),
  ('Real Estate & Property Services', 'Short-let management', 'short-let-management', 10),
  ('Real Estate & Property Services', 'Inspection & surveying', 'inspection-surveying', 11),
  ('Real Estate & Property Services', 'PropTech', 'proptech', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 13: Education, Schools & Training
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Education, Schools & Training', 'Nursery & early years', 'nursery-early-years', 1),
  ('Education, Schools & Training', 'Primary schools', 'primary-schools', 2),
  ('Education, Schools & Training', 'Secondary schools', 'secondary-schools', 3),
  ('Education, Schools & Training', 'Technical & vocational education', 'technical-vocational-education', 4),
  ('Education, Schools & Training', 'Colleges & polytechnics', 'colleges-polytechnics', 5),
  ('Education, Schools & Training', 'Universities', 'universities', 6),
  ('Education, Schools & Training', 'Professional certification & exam prep', 'professional-certification-exam-prep', 7),
  ('Education, Schools & Training', 'Corporate training', 'corporate-training', 8),
  ('Education, Schools & Training', 'Digital skills', 'digital-skills', 9),
  ('Education, Schools & Training', 'Entrepreneurship & business education', 'entrepreneurship-business-education', 10),
  ('Education, Schools & Training', 'Online learning', 'online-learning', 11),
  ('Education, Schools & Training', 'Special needs education', 'special-needs-education', 12),
  ('Education, Schools & Training', 'Language schools', 'language-schools', 13),
  ('Education, Schools & Training', 'Educational research & services', 'educational-research-services', 14)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 14: Technology, Software & Digital Services
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Technology, Software & Digital Services', 'Software development', 'software-development', 1),
  ('Technology, Software & Digital Services', 'Web design & development', 'web-design-development', 2),
  ('Technology, Software & Digital Services', 'Mobile apps', 'mobile-apps', 3),
  ('Technology, Software & Digital Services', 'IT support & managed services', 'it-support-managed-services', 4),
  ('Technology, Software & Digital Services', 'Cloud & hosting', 'cloud-hosting', 5),
  ('Technology, Software & Digital Services', 'Cybersecurity', 'cybersecurity', 6),
  ('Technology, Software & Digital Services', 'Data analytics & BI', 'data-analytics-bi', 7),
  ('Technology, Software & Digital Services', 'AI & automation', 'ai-automation', 8),
  ('Technology, Software & Digital Services', 'Digital marketing & SEO', 'digital-marketing-seo', 9),
  ('Technology, Software & Digital Services', 'E-commerce technology', 'ecommerce-technology', 10),
  ('Technology, Software & Digital Services', 'FinTech providers', 'fintech-providers', 11),
  ('Technology, Software & Digital Services', 'Telecom & connectivity', 'telecom-connectivity', 12),
  ('Technology, Software & Digital Services', 'Hardware & IT equipment', 'hardware-it-equipment', 13),
  ('Technology, Software & Digital Services', 'ERP & enterprise systems', 'erp-enterprise-systems', 14),
  ('Technology, Software & Digital Services', 'UX & UI', 'ux-ui', 15),
  ('Technology, Software & Digital Services', 'Digital transformation', 'digital-transformation', 16),
  ('Technology, Software & Digital Services', 'IoT', 'iot', 17),
  ('Technology, Software & Digital Services', 'Blockchain & emerging tech', 'blockchain-emerging-tech', 18)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 15: Transportation, Mobility & Aviation
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Transportation, Mobility & Aviation', 'Inter-city bus & coach', 'inter-city-bus-coach', 1),
  ('Transportation, Mobility & Aviation', 'Urban transit & shuttle', 'urban-transit-shuttle', 2),
  ('Transportation, Mobility & Aviation', 'Airport transfers', 'airport-transfers', 3),
  ('Transportation, Mobility & Aviation', 'Ride-hailing', 'ride-hailing', 4),
  ('Transportation, Mobility & Aviation', 'Car rental & fleet', 'car-rental-fleet', 5),
  ('Transportation, Mobility & Aviation', 'Corporate transport', 'corporate-transport', 6),
  ('Transportation, Mobility & Aviation', 'Haulage & commercial vehicles', 'haulage-commercial-vehicles', 7),
  ('Transportation, Mobility & Aviation', 'Ferry & water transport', 'ferry-water-transport', 8),
  ('Transportation, Mobility & Aviation', 'Rail services', 'rail-services', 9),
  ('Transportation, Mobility & Aviation', 'Aviation services', 'aviation-services', 10),
  ('Transportation, Mobility & Aviation', 'Air charter', 'air-charter', 11),
  ('Transportation, Mobility & Aviation', 'Vehicle sales & leasing', 'vehicle-sales-leasing', 12),
  ('Transportation, Mobility & Aviation', 'Vehicle repair', 'vehicle-repair', 13),
  ('Transportation, Mobility & Aviation', 'EV services', 'ev-services', 14),
  ('Transportation, Mobility & Aviation', 'Mobility technology', 'mobility-technology', 15)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 16: Fashion, Beauty & Lifestyle
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Fashion, Beauty & Lifestyle', 'Fashion designers & labels', 'fashion-designers-labels', 1),
  ('Fashion, Beauty & Lifestyle', 'Tailoring & garment making', 'tailoring-garment-making', 2),
  ('Fashion, Beauty & Lifestyle', 'Footwear & leather goods', 'footwear-leather-goods', 3),
  ('Fashion, Beauty & Lifestyle', 'Jewellery & accessories', 'jewellery-accessories', 4),
  ('Fashion, Beauty & Lifestyle', 'Beauty salons & hair', 'beauty-salons-hair', 5),
  ('Fashion, Beauty & Lifestyle', 'Barbershops', 'barbershops', 6),
  ('Fashion, Beauty & Lifestyle', 'Make-up artists', 'make-up-artists', 7),
  ('Fashion, Beauty & Lifestyle', 'Skincare & cosmetics services', 'skincare-cosmetics-services', 8),
  ('Fashion, Beauty & Lifestyle', 'Personal styling', 'personal-styling', 9),
  ('Fashion, Beauty & Lifestyle', 'Laundry & dry cleaning', 'laundry-dry-cleaning', 10),
  ('Fashion, Beauty & Lifestyle', 'Lifestyle products', 'lifestyle-products', 11),
  ('Fashion, Beauty & Lifestyle', 'Fashion events & showrooms', 'fashion-events-showrooms', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 17: Food, Beverage & Catering
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Food, Beverage & Catering', 'Food production & processing', 'food-production-processing', 1),
  ('Food, Beverage & Catering', 'Packaged foods & snacks', 'packaged-foods-snacks', 2),
  ('Food, Beverage & Catering', 'Beverage production', 'beverage-production', 3),
  ('Food, Beverage & Catering', 'Bakeries & confectionery', 'bakeries-confectionery', 4),
  ('Food, Beverage & Catering', 'Catering', 'catering', 5),
  ('Food, Beverage & Catering', 'Event catering', 'event-catering', 6),
  ('Food, Beverage & Catering', 'Corporate & institutional catering', 'corporate-institutional-catering', 7),
  ('Food, Beverage & Catering', 'Meal preparation & delivery', 'meal-preparation-delivery', 8),
  ('Food, Beverage & Catering', 'Food trucks', 'food-trucks', 9),
  ('Food, Beverage & Catering', 'Specialty & traditional foods', 'specialty-traditional-foods', 10),
  ('Food, Beverage & Catering', 'Food distribution & wholesale', 'food-distribution-wholesale', 11),
  ('Food, Beverage & Catering', 'Food safety & quality services', 'food-safety-quality-services', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 18: Mining, Natural Resources & Commodities
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Mining, Natural Resources & Commodities', 'Mining & quarrying', 'mining-quarrying', 1),
  ('Mining, Natural Resources & Commodities', 'Solid minerals & processing', 'solid-minerals-processing', 2),
  ('Mining, Natural Resources & Commodities', 'Oil & gas services', 'oil-gas-services', 3),
  ('Mining, Natural Resources & Commodities', 'Industrial minerals', 'industrial-minerals', 4),
  ('Mining, Natural Resources & Commodities', 'Agricultural commodity trading', 'agricultural-commodity-trading', 5),
  ('Mining, Natural Resources & Commodities', 'Mineral & commodity exporters', 'mineral-commodity-exporters', 6),
  ('Mining, Natural Resources & Commodities', 'Exploration & geology', 'exploration-geology', 7),
  ('Mining, Natural Resources & Commodities', 'Mining equipment & services', 'mining-equipment-services', 8),
  ('Mining, Natural Resources & Commodities', 'Natural-resource consulting', 'natural-resource-consulting', 9),
  ('Mining, Natural Resources & Commodities', 'Commodity storage & trade', 'commodity-storage-trade', 10)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 19: Financial Services, Payments & Insurance
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Financial Services, Payments & Insurance', 'Commercial banks', 'commercial-banks', 1),
  ('Financial Services, Payments & Insurance', 'Microfinance banks', 'microfinance-banks', 2),
  ('Financial Services, Payments & Insurance', 'Payment service providers', 'payment-service-providers', 3),
  ('Financial Services, Payments & Insurance', 'FinTech & digital payments', 'fintech-digital-payments', 4),
  ('Financial Services, Payments & Insurance', 'Insurance companies & brokers', 'insurance-companies-brokers', 5),
  ('Financial Services, Payments & Insurance', 'Pensions', 'pensions', 6),
  ('Financial Services, Payments & Insurance', 'Loans & credit', 'loans-credit', 7),
  ('Financial Services, Payments & Insurance', 'Leasing & asset finance', 'leasing-asset-finance', 8),
  ('Financial Services, Payments & Insurance', 'Investment advisory & asset management', 'investment-advisory-asset-management', 9),
  ('Financial Services, Payments & Insurance', 'Financial planning', 'financial-planning', 10),
  ('Financial Services, Payments & Insurance', 'FX & remittance', 'fx-remittance', 11),
  ('Financial Services, Payments & Insurance', 'Credit reporting & risk', 'credit-reporting-risk', 12),
  ('Financial Services, Payments & Insurance', 'Cooperative & community finance', 'cooperative-community-finance', 13)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 20: Events, Conferences & Experiences
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Events, Conferences & Experiences', 'Event planners & producers', 'event-planners-producers', 1),
  ('Events, Conferences & Experiences', 'Conference & exhibition organisers', 'conference-exhibition-organisers', 2),
  ('Events, Conferences & Experiences', 'Event venues & halls', 'event-venues-halls', 3),
  ('Events, Conferences & Experiences', 'AV & event technology', 'av-event-technology', 4),
  ('Events, Conferences & Experiences', 'Rentals & equipment', 'rentals-equipment', 5),
  ('Events, Conferences & Experiences', 'Decorators & florists', 'decorators-florists', 6),
  ('Events, Conferences & Experiences', 'Ticketing & registration', 'ticketing-registration', 7),
  ('Events, Conferences & Experiences', 'Exhibition stands', 'exhibition-stands', 8),
  ('Events, Conferences & Experiences', 'Corporate events & team experiences', 'corporate-events-team-experiences', 9),
  ('Events, Conferences & Experiences', 'Weddings & social events', 'weddings-social-events', 10),
  ('Events, Conferences & Experiences', 'Event staffing & security', 'event-staffing-security', 11),
  ('Events, Conferences & Experiences', 'Speakers, hosts & facilitators', 'speakers-hosts-facilitators', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 21: Home, Repair & Personal Services
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('Home, Repair & Personal Services', 'Home cleaning & housekeeping', 'home-cleaning-housekeeping', 1),
  ('Home, Repair & Personal Services', 'Plumbing & electrical repairs', 'plumbing-electrical-repairs', 2),
  ('Home, Repair & Personal Services', 'Appliance repair', 'appliance-repair', 3),
  ('Home, Repair & Personal Services', 'Home improvement & handyman', 'home-improvement-handyman', 4),
  ('Home, Repair & Personal Services', 'Pest control', 'pest-control', 5),
  ('Home, Repair & Personal Services', 'Gardening & landscaping', 'gardening-landscaping', 6),
  ('Home, Repair & Personal Services', 'Security systems', 'security-systems', 7),
  ('Home, Repair & Personal Services', 'Laundry & domestic services', 'laundry-domestic-services', 8),
  ('Home, Repair & Personal Services', 'Personal care', 'personal-care', 9),
  ('Home, Repair & Personal Services', 'Pet care & veterinary', 'pet-care-veterinary', 10),
  ('Home, Repair & Personal Services', 'Personal photography', 'personal-photography', 11),
  ('Home, Repair & Personal Services', 'Repair, maintenance & installation', 'repair-maintenance-installation', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- Category 22: NGOs, Social Enterprises & Development
insert into public.subcategories (category_id, name, slug, sort_order)
select c.id, sc.name, sc.slug, sc.sort_order
from public.categories c
join (values
  ('NGOs, Social Enterprises & Development', 'NGOs', 'ngos', 1),
  ('NGOs, Social Enterprises & Development', 'Community-based organisations', 'community-based-organisations', 2),
  ('NGOs, Social Enterprises & Development', 'Social enterprises', 'social-enterprises', 3),
  ('NGOs, Social Enterprises & Development', 'Development & humanitarian organisations', 'development-humanitarian-organisations', 4),
  ('NGOs, Social Enterprises & Development', 'Foundations & philanthropy', 'foundations-philanthropy', 5),
  ('NGOs, Social Enterprises & Development', 'Youth development', 'youth-development', 6),
  ('NGOs, Social Enterprises & Development', 'Women''s economic empowerment', 'womens-economic-empowerment', 7),
  ('NGOs, Social Enterprises & Development', 'Livelihoods & enterprise development', 'livelihoods-enterprise-development', 8),
  ('NGOs, Social Enterprises & Development', 'Environmental & conservation organisations', 'environmental-conservation-organisations', 9),
  ('NGOs, Social Enterprises & Development', 'Research, advocacy & policy', 'research-advocacy-policy', 10),
  ('NGOs, Social Enterprises & Development', 'Cooperatives & member organisations', 'cooperatives-member-organisations', 11),
  ('NGOs, Social Enterprises & Development', 'Impact ventures', 'impact-ventures', 12)
) as sc(category_name, name, slug, sort_order)
  on c.name = sc.category_name
on conflict (category_id, slug) do nothing;

-- 14. SEED DATA: Global Business Type Vocabulary
-- ============================================================================
insert into public.business_type_vocabulary (name, slug, sort_order)
select v.name, v.slug, v.sort_order
from (values
  ('Manufacturer', 'manufacturer', 1),
  ('Distributor', 'distributor', 2),
  ('Wholesaler', 'wholesaler', 3),
  ('Retailer', 'retailer', 4),
  ('Importer', 'importer', 5),
  ('Exporter', 'exporter', 6),
  ('Service Provider', 'service-provider', 7),
  ('Consultant', 'consultant', 8),
  ('Professional Firm', 'professional-firm', 9),
  ('Agency', 'agency', 10),
  ('Technology Company', 'technology-company', 11),
  ('Platform/Marketplace', 'platform-marketplace', 12),
  ('School/Training Provider', 'school-training-provider', 13),
  ('Hospital/Clinic', 'hospital-clinic', 14),
  ('Hotel/Accommodation Provider', 'hotel-accommodation-provider', 15),
  ('Restaurant/Food Service', 'restaurant-food-service', 16),
  ('Logistics Provider', 'logistics-provider', 17),
  ('Transport Operator', 'transport-operator', 18),
  ('Contractor', 'contractor', 19),
  ('Property Developer', 'property-developer', 20),
  ('Property Agency', 'property-agency', 21),
  ('Financial Institution', 'financial-institution', 22),
  ('Insurer/Broker', 'insurer-broker', 23),
  ('Non-Profit/NGO', 'non-profit-ngo', 24),
  ('Social Enterprise', 'social-enterprise', 25),
  ('Cooperative', 'cooperative', 26),
  ('Government/Public Institution', 'government-public-institution', 27),
  ('Association/Chamber', 'association-chamber', 28),
  ('Freelancer/Sole Practitioner', 'freelancer-sole-practitioner', 29),
  ('Other', 'other', 30)
) as v(name, slug, sort_order)
on conflict (slug) do nothing;

-- 15. SEED DATA: Category Attributes (sample for key categories)
-- ============================================================================
-- Agriculture attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Agriculture, Agribusiness & Agricultural Technology', 'equipment_type', 'Equipment Type', 'MULTI_ENUM', '["Tractor", "Harvester", "Irrigation System", "Drone", "Planter", "Thresher"]'::jsonb, 1),
  ('Agriculture, Agribusiness & Agricultural Technology', 'crops_commodities', 'Crops / Commodities', 'MULTI_ENUM', '["Maize", "Rice", "Wheat", "Coffee", "Cocoa", "Tea", "Cotton", "Soybean", "Cassava", "Yam", "Millet", "Sorghum", "Groundnut", "Palm Oil", "Sugar Cane", "Tobacco", "Rubber", "Tea", "Spices"]'::jsonb, 2),
  ('Agriculture, Agribusiness & Agricultural Technology', 'production_capacity', 'Production Capacity', 'RANGE', null, 3),
  ('Agriculture, Agribusiness & Agricultural Technology', 'service_regions', 'Service Regions', 'STRING', null, 4),
  ('Agriculture, Agribusiness & Agricultural Technology', 'irrigation', 'Irrigation Available', 'BOOLEAN', null, 5),
  ('Agriculture, Agribusiness & Agricultural Technology', 'farm_technology', 'Farm Technology', 'MULTI_ENUM', '["Precision Farming", "Drones", "IoT Sensors", "GPS Mapping", "Automated Irrigation", "Greenhouse Technology"]'::jsonb, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Construction attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Construction, Engineering & Infrastructure', 'project_type', 'Project Type', 'MULTI_ENUM', '["Residential", "Commercial", "Industrial", "Infrastructure", "Renovation", "Interior Fit-Out"]'::jsonb, 1),
  ('Construction, Engineering & Infrastructure', 'service_region', 'Service Region', 'STRING', null, 2),
  ('Construction, Engineering & Infrastructure', 'project_sector', 'Sector', 'MULTI_ENUM', '["Residential", "Commercial", "Industrial", "Public Infrastructure"]'::jsonb, 3),
  ('Construction, Engineering & Infrastructure', 'capacity', 'Capacity', 'RANGE', null, 4),
  ('Construction, Engineering & Infrastructure', 'licences_verified', 'Licences Verified', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Technology attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Technology, Software & Digital Services', 'services_offered', 'Services Offered', 'MULTI_ENUM', '["Web Development", "Mobile Apps", "Software Development", "IT Support", "Cloud Services", "Cybersecurity", "Data Analytics", "AI/ML", "Digital Marketing", "UX/UI Design", "ERP Implementation", "IoT Solutions"]'::jsonb, 1),
  ('Technology, Software & Digital Services', 'technologies_platforms', 'Technologies & Platforms', 'MULTI_ENUM', '["JavaScript", "Python", "React", "Node.js", "AWS", "Azure", "Google Cloud", "Kubernetes", "Docker", "PostgreSQL", "MongoDB", "TensorFlow"]'::jsonb, 2),
  ('Technology, Software & Digital Services', 'deployment_model', 'Deployment Model', 'MULTI_ENUM', '["Cloud", "On-Premise", "Hybrid"]'::jsonb, 3),
  ('Technology, Software & Digital Services', 'industries_served', 'Industries Served', 'MULTI_ENUM', '["Finance", "Healthcare", "Retail", "Education", "Agriculture", "Manufacturing", "Logistics", "Government", "Hospitality"]'::jsonb, 4),
  ('Technology, Software & Digital Services', 'support_hours', 'Support Hours', 'STRING', null, 5),
  ('Technology, Software & Digital Services', 'delivery_mode', 'Delivery Mode', 'MULTI_ENUM', '["On-site", "Remote", "Hybrid"]'::jsonb, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Hospitality attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Hospitality, Tourism & Leisure', 'accommodation_type', 'Accommodation Type', 'MULTI_ENUM', '["Hotel", "Resort", "Guest House", "Serviced Apartment", "Lodge", "Eco-Lodge", "Holiday Rental", "Conference Hotel"]'::jsonb, 1),
  ('Hospitality, Tourism & Leisure', 'amenities', 'Amenities', 'MULTI_ENUM', '["WiFi", "Pool", "Spa", "Restaurant", "Bar", "Gym", "Conference Room", "Parking", "Airport Shuttle", "Room Service"]'::jsonb, 2),
  ('Hospitality, Tourism & Leisure', 'destination', 'Destination', 'STRING', null, 3),
  ('Hospitality, Tourism & Leisure', 'guest_capacity', 'Guest Capacity', 'RANGE', null, 4),
  ('Hospitality, Tourism & Leisure', 'booking_available', 'Booking Available', 'BOOLEAN', null, 5),
  ('Hospitality, Tourism & Leisure', 'price_range', 'Price Range', 'ENUM', '["$", "$$", "$$$", "$$$$"]'::jsonb, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Financial Services attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Financial Services, Payments & Insurance', 'service_type', 'Service Type', 'MULTI_ENUM', '["Commercial Banking", "Microfinance", "Payments", "Insurance", "Pensions", "Loans", "Investment Advisory", "FX/Remittance", "Credit Reporting"]'::jsonb, 1),
  ('Financial Services, Payments & Insurance', 'customer_segment', 'Customer Segment', 'MULTI_ENUM', '["Individual", "SME", "Corporate", "Government"]'::jsonb, 2),
  ('Financial Services, Payments & Insurance', 'country_jurisdiction', 'Country / Jurisdiction', 'STRING', null, 3),
  ('Financial Services, Payments & Insurance', 'online_branch', 'Online / Branch', 'MULTI_ENUM', '["Online", "Branch", "Both"]'::jsonb, 4),
  ('Financial Services, Payments & Insurance', 'regulatory_status_verified', 'Regulatory Status Verified', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Health attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Health, Medical & Wellness', 'service_type', 'Service Type', 'MULTI_ENUM', '["Hospital", "Clinic", "Diagnostic Lab", "Pharmacy", "Telemedicine", "Dental", "Optical", "Mental Health", "Physiotherapy", "Fitness", "Spa/Wellness"]'::jsonb, 1),
  ('Health, Medical & Wellness', 'appointment_available', 'Appointments Available', 'BOOLEAN', null, 2),
  ('Health, Medical & Wellness', 'telehealth_available', 'Telehealth Available', 'BOOLEAN', null, 3),
  ('Health, Medical & Wellness', 'hours', 'Opening Hours', 'STRING', null, 4),
  ('Health, Medical & Wellness', 'insurance_accepted', 'Insurance Accepted', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Food & Beverage attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Food, Beverage & Catering', 'cuisine_product', 'Cuisine / Product Type', 'MULTI_ENUM', '["African", "Continental", "Fast Food", "Beverages", "Bakery", "Packaged Foods", "Catering", "Meal Delivery", "Food Truck", "Specialty/Traditional"]'::jsonb, 1),
  ('Food, Beverage & Catering', 'order_type', 'Order Type', 'MULTI_ENUM', '["Delivery", "Pickup", "Dine-in", "Catering", "Bulk/Wholesale"]'::jsonb, 2),
  ('Food, Beverage & Catering', 'service_radius', 'Service Radius', 'RANGE', null, 3),
  ('Food, Beverage & Catering', 'minimum_order', 'Minimum Order', 'RANGE', null, 4),
  ('Food, Beverage & Catering', 'catering_capacity', 'Catering Capacity', 'RANGE', null, 5),
  ('Food, Beverage & Catering', 'delivery_available', 'Delivery Available', 'BOOLEAN', null, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Logistics attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Logistics, Courier & Supply Chain', 'areas_served', 'Areas Served', 'STRING', null, 1),
  ('Logistics, Courier & Supply Chain', 'domestic_international', 'Domestic / International', 'MULTI_ENUM', '["Domestic", "International", "Both"]'::jsonb, 2),
  ('Logistics, Courier & Supply Chain', 'transport_mode', 'Transport Mode', 'MULTI_ENUM', '["Road", "Air", "Sea", "Rail", "Multi-modal"]'::jsonb, 3),
  ('Logistics, Courier & Supply Chain', 'weight_volume_capacity', 'Weight/Volume Capacity', 'RANGE', null, 4),
  ('Logistics, Courier & Supply Chain', 'cold_chain', 'Cold Chain Available', 'BOOLEAN', null, 5),
  ('Logistics, Courier & Supply Chain', 'delivery_type', 'Delivery Type', 'MULTI_ENUM', '["Express", "Standard", "Economy", "Same Day", "Next Day"]'::jsonb, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Green Economy attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Green Economy, Energy & Environment', 'energy_source', 'Energy Source', 'MULTI_ENUM', '["Solar", "Wind", "Hydro", "Biomass", "Geothermal", "Battery Storage", "Hybrid"]'::jsonb, 1),
  ('Green Economy, Energy & Environment', 'system_size', 'System Size', 'RANGE', null, 2),
  ('Green Economy, Energy & Environment', 'service_area', 'Service Area', 'STRING', null, 3),
  ('Green Economy, Energy & Environment', 'waste_material_type', 'Waste/Material Type', 'MULTI_ENUM', '["Plastic", "Paper", "Metal", "Organic", "E-Waste", "Glass", "Hazardous"]'::jsonb, 4),
  ('Green Economy, Energy & Environment', 'customer_segment', 'Customer Segment', 'MULTI_ENUM', '["Residential", "Commercial", "Industrial", "Utility Scale"]'::jsonb, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Education attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Education, Schools & Training', 'institution_type', 'Institution Type', 'ENUM', '["Nursery", "Primary", "Secondary", "Vocational", "College", "University", "Professional Training", "Online Learning"]'::jsonb, 1),
  ('Education, Schools & Training', 'level', 'Level', 'MULTI_ENUM', '["Early Years", "Primary", "Secondary", "Tertiary", "Vocational", "Professional", "Corporate"]'::jsonb, 2),
  ('Education, Schools & Training', 'learning_mode', 'Learning Mode', 'MULTI_ENUM', '["In-person", "Online", "Hybrid"]'::jsonb, 3),
  ('Education, Schools & Training', 'programmes', 'Programmes Offered', 'MULTI_ENUM', '["STEM", "Arts", "Business", "Languages", "ICT", "Vocational Skills", "Exam Prep"]'::jsonb, 4),
  ('Education, Schools & Training', 'accreditation_verified', 'Accreditation Verified', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Professional Services attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Professional & Legal Services', 'service_type', 'Service Type', 'MULTI_ENUM', '["Legal", "Audit", "Management Consulting", "Engineering", "Architecture", "Research", "Translation", "Coaching", "Project Management", "Valuation", "Forensic"]'::jsonb, 1),
  ('Professional & Legal Services', 'jurisdiction', 'Jurisdiction', 'STRING', null, 2),
  ('Professional & Legal Services', 'languages', 'Languages', 'MULTI_ENUM', '["English", "French", "Portuguese", "Arabic", "Swahili", "Yoruba", "Igbo", "Hausa", "Zulu", "Amharic"]'::jsonb, 3),
  ('Professional & Legal Services', 'remote_onsite', 'Remote / Onsite', 'MULTI_ENUM', '["Remote", "Onsite", "Both"]'::jsonb, 4),
  ('Professional & Legal Services', 'registration_verified', 'Professional Registration Verified', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Commerce attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Commerce, Retail & E-commerce', 'product_categories', 'Product Categories', 'MULTI_ENUM', '["General Retail", "Electronics", "Fashion", "Home & Furniture", "Beauty", "Books & Stationery", "Building Materials", "FMCG"]'::jsonb, 1),
  ('Commerce, Retail & E-commerce', 'b2b_b2c', 'B2B / B2C', 'MULTI_ENUM', '["B2B", "B2C", "Both"]'::jsonb, 2),
  ('Commerce, Retail & E-commerce', 'channel', 'Channel', 'MULTI_ENUM', '["Online", "Physical", "Both"]'::jsonb, 3),
  ('Commerce, Retail & E-commerce', 'delivery_coverage', 'Delivery Coverage', 'STRING', null, 4),
  ('Commerce, Retail & E-commerce', 'wholesale_available', 'Wholesale Available', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Manufacturing attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Manufacturing & Industrial Production', 'manufacturing_model', 'Manufacturing Model', 'MULTI_ENUM', '["OEM", "Contract", "ODM", "In-house"]'::jsonb, 1),
  ('Manufacturing & Industrial Production', 'sector', 'Sector', 'MULTI_ENUM', '["Food & Beverage", "Textiles", "Electronics", "Automotive", "Pharmaceuticals", "Plastics", "Chemicals", "Metal", "Machinery", "Furniture", "Building Products", "Cosmetics"]'::jsonb, 2),
  ('Manufacturing & Industrial Production', 'capacity', 'Capacity', 'RANGE', null, 3),
  ('Manufacturing & Industrial Production', 'minimum_order_quantity', 'Minimum Order Quantity', 'RANGE', null, 4),
  ('Manufacturing & Industrial Production', 'export_markets', 'Export Markets', 'MULTI_ENUM', '["West Africa", "East Africa", "Southern Africa", "Central Africa", "North Africa", "International"]'::jsonb, 5),
  ('Manufacturing & Industrial Production', 'certifications_verified', 'Certifications Verified', 'BOOLEAN', null, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Real Estate attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Real Estate & Property Services', 'property_type', 'Property Type', 'MULTI_ENUM', '["Residential", "Commercial", "Industrial", "Land", "Mixed-Use"]'::jsonb, 1),
  ('Real Estate & Property Services', 'location', 'Location', 'STRING', null, 2),
  ('Real Estate & Property Services', 'transaction_type', 'Transaction Type', 'MULTI_ENUM', '["Buy", "Rent", "Lease", "Sell"]'::jsonb, 3),
  ('Real Estate & Property Services', 'service_areas', 'Service Areas', 'STRING', null, 4)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Transportation attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Transportation, Mobility & Aviation', 'service_type', 'Service Type', 'MULTI_ENUM', '["Bus/Coach", "Shuttle", "Airport Transfer", "Ride-hailing", "Car Rental", "Corporate Transport", "Haulage", "Aviation", "Air Charter"]'::jsonb, 1),
  ('Transportation, Mobility & Aviation', 'routes_coverage', 'Routes / Coverage', 'STRING', null, 2),
  ('Transportation, Mobility & Aviation', 'vehicle_type', 'Vehicle Type', 'MULTI_ENUM', '["Bus", "Van", "Car", "Truck", "Motorcycle", "Aircraft", "Ferry"]'::jsonb, 3),
  ('Transportation, Mobility & Aviation', 'passenger_cargo_capacity', 'Passenger/Cargo Capacity', 'RANGE', null, 4),
  ('Transportation, Mobility & Aviation', 'fleet_available', 'Fleet Available', 'BOOLEAN', null, 5),
  ('Transportation, Mobility & Aviation', 'booking_available', 'Booking Available', 'BOOLEAN', null, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Business & Corporate Services attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Business & Corporate Services', 'service_type', 'Service Type', 'MULTI_ENUM', '["Business Registration", "Consulting", "Training", "Market Research", "Coworking", "Virtual Office", "Compliance", "Accounting", "Tax", "HR", "Payroll", "Procurement", "BPO"]'::jsonb, 1),
  ('Business & Corporate Services', 'industries_served', 'Industries Served', 'MULTI_ENUM', '["All Industries", "Finance", "Healthcare", "Retail", "Education", "Agriculture", "Manufacturing", "Technology", "Construction"]'::jsonb, 2),
  ('Business & Corporate Services', 'delivery_mode', 'Delivery Mode', 'MULTI_ENUM', '["On-site", "Remote", "Hybrid"]'::jsonb, 3),
  ('Business & Corporate Services', 'countries_served', 'Countries Served', 'STRING', null, 4),
  ('Business & Corporate Services', 'client_size', 'Client/Company Size', 'MULTI_ENUM', '["Startup", "SME", "Mid-Market", "Enterprise"]'::jsonb, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Creative & Media attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Creative, Media & Entertainment', 'services', 'Services', 'MULTI_ENUM', '["Advertising", "Branding", "Photography", "Videography", "Film Production", "Music Production", "Publishing", "Content Creation", "Animation", "PR", "Gaming"]'::jsonb, 1),
  ('Creative, Media & Entertainment', 'portfolio_available', 'Portfolio Available', 'BOOLEAN', null, 2),
  ('Creative, Media & Entertainment', 'languages', 'Languages', 'MULTI_ENUM', '["English", "French", "Portuguese", "Arabic", "Swahili", "Yoruba", "Igbo", "Hausa", "Zulu", "Amharic"]'::jsonb, 3),
  ('Creative, Media & Entertainment', 'project_type', 'Project Type', 'MULTI_ENUM', '["Commercial", "Corporate", "Wedding", "Event", "Documentary", "Social Media"]'::jsonb, 4),
  ('Creative, Media & Entertainment', 'remote_onlocation', 'Remote / On-location', 'MULTI_ENUM', '["Remote", "On-location", "Both"]'::jsonb, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Fashion & Beauty attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Fashion, Beauty & Lifestyle', 'product_service', 'Product / Service', 'MULTI_ENUM', '["Fashion Design", "Tailoring", "Footwear", "Jewellery", "Beauty Salon", "Barbershop", "Make-up", "Skincare", "Styling", "Laundry"]'::jsonb, 1),
  ('Fashion, Beauty & Lifestyle', 'appointments_available', 'Appointments Available', 'BOOLEAN', null, 2),
  ('Fashion, Beauty & Lifestyle', 'custom_orders', 'Custom Orders', 'BOOLEAN', null, 3),
  ('Fashion, Beauty & Lifestyle', 'coverage_delivery', 'Coverage / Delivery', 'MULTI_ENUM', '["In-store", "Delivery", "Both"]'::jsonb, 4),
  ('Fashion, Beauty & Lifestyle', 'portfolio_available', 'Portfolio Available', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Mining attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Mining, Natural Resources & Commodities', 'commodity_material', 'Commodity / Material', 'MULTI_ENUM', '["Gold", "Diamond", "Copper", "Iron Ore", "Bauxite", "Lithium", "Cobalt", "Tin", "Zinc", "Manganese", "Chrome", "Platinum", "Uranium", "Coal", "Limestone", "Phosphate"]'::jsonb, 1),
  ('Mining, Natural Resources & Commodities', 'role', 'Role', 'MULTI_ENUM', '["Mining", "Processing", "Trading", "Export", "Exploration", "Equipment", "Consulting"]'::jsonb, 2),
  ('Mining, Natural Resources & Commodities', 'region', 'Region', 'STRING', null, 3),
  ('Mining, Natural Resources & Commodities', 'export_capability', 'Export Capability', 'BOOLEAN', null, 4),
  ('Mining, Natural Resources & Commodities', 'licences_verified', 'Licences/Permits Verified', 'BOOLEAN', null, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Events attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Events, Conferences & Experiences', 'event_type', 'Event Type', 'MULTI_ENUM', '["Corporate", "Wedding", "Conference", "Exhibition", "Concert", "Festival", "Team Building", "Product Launch"]'::jsonb, 1),
  ('Events, Conferences & Experiences', 'venue_capacity', 'Venue Capacity', 'RANGE', null, 2),
  ('Events, Conferences & Experiences', 'region', 'Region', 'STRING', null, 3),
  ('Events, Conferences & Experiences', 'indoor_outdoor', 'Indoor / Outdoor', 'MULTI_ENUM', '["Indoor", "Outdoor", "Both"]'::jsonb, 4),
  ('Events, Conferences & Experiences', 'equipment_available', 'Equipment Available', 'BOOLEAN', null, 5),
  ('Events, Conferences & Experiences', 'booking_available', 'Booking Available', 'BOOLEAN', null, 6)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- Home & Personal Services attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('Home, Repair & Personal Services', 'service_area', 'Service Area', 'STRING', null, 1),
  ('Home, Repair & Personal Services', 'appointment_available', 'Appointments Available', 'BOOLEAN', null, 2),
  ('Home, Repair & Personal Services', 'emergency_callout', 'Emergency Call-out', 'BOOLEAN', null, 3),
  ('Home, Repair & Personal Services', 'residential_commercial', 'Residential / Commercial', 'MULTI_ENUM', '["Residential", "Commercial", "Both"]'::jsonb, 4),
  ('Home, Repair & Personal Services', 'service_type', 'Service Type', 'MULTI_ENUM', '["Cleaning", "Plumbing", "Electrical", "Appliance Repair", "Handyman", "Pest Control", "Gardening", "Security", "Laundry", "Pet Care"]'::jsonb, 5)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;

-- NGOs attributes
insert into public.category_attributes (category_id, key, label, data_type, allowed_values, sort_order)
select c.id, a.key, a.label, a.data_type, a.allowed_values, a.sort_order
from public.categories c
join (values
  ('NGOs, Social Enterprises & Development', 'mission_area', 'Mission Area', 'MULTI_ENUM', '["Health", "Education", "Environment", "Poverty Alleviation", "Human Rights", "Women''s Empowerment", "Youth Development", "Disaster Relief", "Community Development"]'::jsonb, 1),
  ('NGOs, Social Enterprises & Development', 'geography', 'Geography', 'STRING', null, 2),
  ('NGOs, Social Enterprises & Development', 'programme_area', 'Programme Area', 'MULTI_ENUM', '["Advocacy", "Capacity Building", "Direct Service", "Research", "Policy", "Emergency Response"]'::jsonb, 3),
  ('NGOs, Social Enterprises & Development', 'partnership_interests', 'Partnership Interests', 'MULTI_ENUM', '["Funding", "Technical Assistance", "Volunteers", "Research Collaboration", "Corporate Partnerships"]'::jsonb, 4)
) as a(category_name, key, label, data_type, allowed_values, sort_order)
  on c.name = a.category_name
on conflict (category_id, key) do nothing;
