create extension if not exists pgcrypto;

create table if not exists public.countries (
  code text primary key check (char_length(code) = 2),
  name text not null unique,
  currency_code text,
  currency_symbol text,
  default_locale text,
  dial_code text,
  timezone text,
  is_active boolean not null default true
);

-- Upgrade an existing countries table: `create table if not exists` is a no-op
-- when the table already exists, so the locale/currency columns above would be
-- skipped on a database created before this feature. These ALTERs add them.
alter table public.countries
  add column if not exists currency_code text,
  add column if not exists currency_symbol text,
  add column if not exists default_locale text,
  add column if not exists dial_code text,
  add column if not exists timezone text;

create table if not exists public.country_languages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  language_code text not null,
  name text not null,
  native_name text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (country_code, language_code)
);

create unique index if not exists country_languages_one_primary_key
  on public.country_languages (country_code)
  where is_primary;
create index if not exists country_languages_country_idx
  on public.country_languages (country_code, sort_order);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  parent_id uuid references public.locations(id) on delete cascade,
  name text not null,
  location_type text not null default '',
  level integer not null default 1 check (level >= 1),
  path text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Upsert target for the per-country seeds (on conflict (country_code, path)).
-- Declared as a unique index rather than an inline constraint so its name matches
-- the one created by supabase/migrations/004_location_hierarchy.sql.
create unique index if not exists locations_country_path_key on public.locations (country_code, path);

create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.business_types (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete restrict,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (industry_id, name),
  unique (industry_id, slug)
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  business_name text not null,
  short_description text not null default '',
  country_code text not null references public.countries(code),
  city text not null default '',
  industry_id uuid not null references public.industries(id),
  business_type_id uuid not null references public.business_types(id),
  cover_image_url text,
  logo_url text,
  phone text,
  email text,
  website text,
  is_verified boolean not null default false,
  is_booking_enabled boolean not null default false,
  status text not null default 'APPLICATION_STARTED' check (status in (
    'APPLICATION_STARTED', 'VERIFICATION_PENDING', 'VERIFIED', 'VERIFICATION_FAILED',
    'PAYMENT_PENDING', 'PAID', 'INFORMATION_PENDING', 'INFORMATION_RECEIVED',
    'AI_PAGE_GENERATING', 'QUALITY_REVIEW', 'APPROVED', 'LIVE', 'RENEWAL_DUE',
    'EXPIRED', 'SUSPENDED'
  )),
  is_published boolean not null default false,
  search_text text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_before_publish check (not is_published or (is_verified and status = 'LIVE'))
);

create table if not exists public.business_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  registered_name text,
  trading_name text,
  registration_number text,
  region text,
  address text,
  whatsapp text,
  year_established integer,
  business_size text,
  description text not null default '',
  opening_hours jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  standard_price numeric(10, 2) not null check (standard_price >= 0),
  currency text not null,
  booking_enabled boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  discount_percent numeric(5, 2) not null check (discount_percent between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  reference text not null unique default ('BHA-' || upper(encode(gen_random_bytes(8), 'hex'))),
  status text not null default 'APPLICATION_STARTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'PREMBLY',
  provider_reference text unique,
  status text not null default 'VERIFICATION_STARTED' check (status in (
    'VERIFICATION_STARTED', 'VERIFICATION_PENDING', 'VERIFIED', 'VERIFICATION_FAILED', 'VERIFICATION_REVIEW'
  )),
  result jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'PAYMENT_PENDING' check (status in ('PAYMENT_PENDING', 'ACTIVE', 'RENEWAL_DUE', 'EXPIRED', 'CANCELLED')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'FLUTTERWAVE',
  reference text not null unique default ('BHA-PAY-' || upper(encode(gen_random_bytes(8), 'hex'))),
  provider_reference text unique,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  unique (provider, event_id)
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.business_socials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform text not null,
  url text not null,
  unique (business_id, platform)
);

create table if not exists public.business_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  media_type text not null default 'IMAGE',
  sort_order integer not null default 0
);

create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  seo_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, version)
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  message text not null,
  status text not null default 'NEW' check (status in ('NEW', 'READ', 'REPLIED', 'CLOSED')),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'REVIEWER', 'BUSINESS_OWNER')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Trigger to maintain search_text (replaces generated column for immutability)
create or replace function public.update_business_search_text()
returns trigger
language plpgsql
as $$
begin
  NEW.search_text := concat_ws(' ', NEW.business_name, NEW.short_description, NEW.city);
  return NEW;
end;
$$;

drop trigger if exists set_business_search_text on public.businesses;
create trigger set_business_search_text
  before insert or update of business_name, short_description, city on public.businesses
  for each row execute function public.update_business_search_text();

-- Slug helper used by the per-country location hierarchy seeds.
-- NFD-decompose, drop combining marks, then ASCII-fold (drops non-ASCII leftovers
-- such as the Khoisan click letters); matches the generators for the seed files.
create or replace function public.location_slug(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(
      regexp_replace(
        normalize(coalesce(input, ''), NFD),
        '[\u0300-\u036f]', '', 'g'
      )
    ),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;

-- Country-specific language/currency resolvers: walk a location up to its
-- country, or read a business's country directly.
create or replace function public.location_currency(p_location_id uuid)
returns text language sql stable as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l join chain c on l.id = c.parent_id
  )
  select c.currency_code from chain ch
  join public.countries c on c.code = ch.country_code limit 1
$$;

create or replace function public.location_locale(p_location_id uuid)
returns text language sql stable as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l join chain c on l.id = c.parent_id
  )
  select c.default_locale from chain ch
  join public.countries c on c.code = ch.country_code limit 1
$$;

create or replace function public.location_languages(p_location_id uuid)
returns table (language_code text, name text, native_name text, is_primary boolean)
language sql stable as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l join chain c on l.id = c.parent_id
  )
  select cl.language_code, cl.name, cl.native_name, cl.is_primary
  from chain ch
  join public.country_languages cl on cl.country_code = ch.country_code
  order by cl.is_primary desc, cl.sort_order, cl.name
$$;

create or replace function public.business_currency(p_business_id uuid)
returns text language sql stable as $$
  select c.currency_code from public.businesses b
  join public.countries c on c.code = b.country_code where b.id = p_business_id
$$;

create or replace function public.business_locale(p_business_id uuid)
returns text language sql stable as $$
  select c.default_locale from public.businesses b
  join public.countries c on c.code = b.country_code where b.id = p_business_id
$$;

create index if not exists businesses_public_search_idx on public.businesses using gin (to_tsvector('simple', search_text));
create index if not exists businesses_discovery_idx on public.businesses (country_code, industry_id, business_type_id, published_at desc) where is_published = true;
create index if not exists business_types_industry_idx on public.business_types (industry_id, sort_order);
create index if not exists payments_reference_idx on public.payments (reference, status);
create index if not exists verifications_provider_reference_idx on public.business_verifications (provider_reference);
-- Location hierarchy: sibling name uniqueness (roots use the zero uuid sentinel)
create unique index if not exists locations_sibling_name_key on public.locations (
  country_code,
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);
create index if not exists locations_parent_idx on public.locations (country_code, parent_id);
create index if not exists locations_name_idx on public.locations (lower(name));
create index if not exists locations_country_type_idx on public.locations (country_code, location_type);

alter table public.countries enable row level security;
alter table public.country_languages enable row level security;
alter table public.locations enable row level security;
alter table public.industries enable row level security;
alter table public.business_types enable row level security;
alter table public.businesses enable row level security;
alter table public.business_profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.promotions enable row level security;
alter table public.applications enable row level security;
alter table public.business_verifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.business_services enable row level security;
alter table public.business_socials enable row level security;
alter table public.business_media enable row level security;
alter table public.page_versions enable row level security;
alter table public.enquiries enable row level security;
alter table public.bookings enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Anyone can view active countries" on public.countries;
create policy "Anyone can view active countries" on public.countries for select using (is_active);
drop policy if exists "Anyone can view country languages" on public.country_languages;
create policy "Anyone can view country languages" on public.country_languages for select using (true);
drop policy if exists "Anyone can view active locations" on public.locations;
create policy "Anyone can view active locations" on public.locations for select using (is_active);
drop policy if exists "Anyone can view active industries" on public.industries;
create policy "Anyone can view active industries" on public.industries for select using (is_active);
drop policy if exists "Anyone can view active business types" on public.business_types;
create policy "Anyone can view active business types" on public.business_types for select using (is_active);
drop policy if exists "Anyone can view active plans" on public.subscription_plans;
create policy "Anyone can view active plans" on public.subscription_plans for select using (is_active);
drop policy if exists "Anyone can view active promotions" on public.promotions;
create policy "Anyone can view active promotions" on public.promotions for select using (is_active);
drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
drop policy if exists "Anyone can view published businesses" on public.businesses;
create policy "Anyone can view published businesses" on public.businesses for select using (is_published and status = 'LIVE');
drop policy if exists "Owners can view their own businesses" on public.businesses;
create policy "Owners can view their own businesses" on public.businesses for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Anyone can view services for published businesses" on public.business_services;
create policy "Anyone can view services for published businesses" on public.business_services for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.is_published and b.status = 'LIVE')
);
drop policy if exists "Anyone can view socials for published businesses" on public.business_socials;
create policy "Anyone can view socials for published businesses" on public.business_socials for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.is_published and b.status = 'LIVE')
);
drop policy if exists "Anyone can view media for published businesses" on public.business_media;
create policy "Anyone can view media for published businesses" on public.business_media for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.is_published and b.status = 'LIVE')
);

insert into public.countries (code, name, currency_code, currency_symbol, default_locale, dial_code, timezone) values
  ('DZ', 'Algeria', 'DZD', 'DA', 'ar-DZ', '+213', 'Africa/Algiers'),
  ('AO', 'Angola', 'AOA', 'Kz', 'pt-AO', '+244', 'Africa/Luanda'),
  ('BJ', 'Benin', 'XOF', 'CFA', 'fr-BJ', '+229', 'Africa/Porto-Novo'),
  ('BW', 'Botswana', 'BWP', 'P', 'en-BW', '+267', 'Africa/Gaborone'),
  ('BF', 'Burkina Faso', 'XOF', 'CFA', 'fr-BF', '+226', 'Africa/Ouagadougou'),
  ('BI', 'Burundi', 'BIF', 'FBu', 'fr-BI', '+257', 'Africa/Bujumbura'),
  ('CV', 'Cabo Verde', 'CVE', '$', 'pt-CV', '+238', 'Atlantic/Cape_Verde'),
  ('CM', 'Cameroon', 'XAF', 'FCFA', 'fr-CM', '+237', 'Africa/Douala'),
  ('CF', 'Central African Republic', 'XAF', 'FCFA', 'fr-CF', '+236', 'Africa/Bangui'),
  ('TD', 'Chad', 'XAF', 'FCFA', 'fr-TD', '+235', 'Africa/Ndjamena'),
  ('KM', 'Comoros', 'KMF', 'CF', 'fr-KM', '+269', 'Indian/Comoro'),
  ('CG', 'Congo', 'XAF', 'FCFA', 'fr-CG', '+242', 'Africa/Brazzaville'),
  ('CD', 'Democratic Republic of the Congo', 'CDF', 'FC', 'fr-CD', '+243', 'Africa/Kinshasa'),
  ('CI', 'Cote d''Ivoire', 'XOF', 'CFA', 'fr-CI', '+225', 'Africa/Abidjan'),
  ('DJ', 'Djibouti', 'DJF', 'Fdj', 'fr-DJ', '+253', 'Africa/Djibouti'),
  ('EG', 'Egypt', 'EGP', 'E£', 'ar-EG', '+20', 'Africa/Cairo'),
  ('GQ', 'Equatorial Guinea', 'XAF', 'FCFA', 'es-GQ', '+240', 'Africa/Malabo'),
  ('ER', 'Eritrea', 'ERN', 'Nfk', 'ti-ER', '+291', 'Africa/Asmara'),
  ('SZ', 'Eswatini', 'SZL', 'E', 'en-SZ', '+268', 'Africa/Mbabane'),
  ('ET', 'Ethiopia', 'ETB', 'Br', 'am-ET', '+251', 'Africa/Addis_Ababa'),
  ('GA', 'Gabon', 'XAF', 'FCFA', 'fr-GA', '+241', 'Africa/Libreville'),
  ('GM', 'Gambia', 'GMD', 'D', 'en-GM', '+220', 'Africa/Banjul'),
  ('GH', 'Ghana', 'GHS', 'GH₵', 'en-GH', '+233', 'Africa/Accra'),
  ('GN', 'Guinea', 'GNF', 'FG', 'fr-GN', '+224', 'Africa/Conakry'),
  ('GW', 'Guinea-Bissau', 'XOF', 'CFA', 'pt-GW', '+245', 'Africa/Bissau'),
  ('KE', 'Kenya', 'KES', 'KSh', 'en-KE', '+254', 'Africa/Nairobi'),
  ('LS', 'Lesotho', 'LSL', 'L', 'en-LS', '+266', 'Africa/Maseru'),
  ('LR', 'Liberia', 'LRD', '$', 'en-LR', '+231', 'Africa/Monrovia'),
  ('LY', 'Libya', 'LYD', 'LD', 'ar-LY', '+218', 'Africa/Tripoli'),
  ('MG', 'Madagascar', 'MGA', 'Ar', 'mg-MG', '+261', 'Indian/Antananarivo'),
  ('MW', 'Malawi', 'MWK', 'MK', 'en-MW', '+265', 'Africa/Blantyre'),
  ('ML', 'Mali', 'XOF', 'CFA', 'fr-ML', '+223', 'Africa/Bamako'),
  ('MR', 'Mauritania', 'MRU', 'UM', 'ar-MR', '+222', 'Africa/Nouakchott'),
  ('MU', 'Mauritius', 'MUR', '₨', 'en-MU', '+230', 'Indian/Mauritius'),
  ('MA', 'Morocco', 'MAD', 'DH', 'ar-MA', '+212', 'Africa/Casablanca'),
  ('MZ', 'Mozambique', 'MZN', 'MT', 'pt-MZ', '+258', 'Africa/Maputo'),
  ('NA', 'Namibia', 'NAD', '$', 'en-NA', '+264', 'Africa/Windhoek'),
  ('NE', 'Niger', 'XOF', 'CFA', 'fr-NE', '+227', 'Africa/Niamey'),
  ('NG', 'Nigeria', 'NGN', '₦', 'en-NG', '+234', 'Africa/Lagos'),
  ('RW', 'Rwanda', 'RWF', 'FRw', 'rw-RW', '+250', 'Africa/Kigali'),
  ('ST', 'Sao Tome and Principe', 'STN', 'Db', 'pt-ST', '+239', 'Africa/Sao_Tome'),
  ('SN', 'Senegal', 'XOF', 'CFA', 'fr-SN', '+221', 'Africa/Dakar'),
  ('SC', 'Seychelles', 'SCR', '₨', 'en-SC', '+248', 'Indian/Mahe'),
  ('SL', 'Sierra Leone', 'SLE', 'Le', 'en-SL', '+232', 'Africa/Freetown'),
  ('SO', 'Somalia', 'SOS', 'Sh', 'so-SO', '+252', 'Africa/Mogadishu'),
  ('ZA', 'South Africa', 'ZAR', 'R', 'en-ZA', '+27', 'Africa/Johannesburg'),
  ('SS', 'South Sudan', 'SSP', '£', 'en-SS', '+211', 'Africa/Juba'),
  ('SD', 'Sudan', 'SDG', 'ج.س', 'ar-SD', '+249', 'Africa/Khartoum'),
  ('TZ', 'Tanzania', 'TZS', 'TSh', 'sw-TZ', '+255', 'Africa/Dar_es_Salaam'),
  ('TG', 'Togo', 'XOF', 'CFA', 'fr-TG', '+228', 'Africa/Lome'),
  ('TN', 'Tunisia', 'TND', 'DT', 'ar-TN', '+216', 'Africa/Tunis'),
  ('UG', 'Uganda', 'UGX', 'USh', 'en-UG', '+256', 'Africa/Kampala'),
  ('ZM', 'Zambia', 'ZMW', 'ZK', 'en-ZM', '+260', 'Africa/Lusaka'),
  ('ZW', 'Zimbabwe', 'ZWL', 'Z$', 'en-ZW', '+263', 'Africa/Harare'),
  ('YT', 'Mayotte', 'EUR', '€', 'fr-YT', '+262', 'Indian/Mayotte'),
  ('RE', 'Reunion', 'EUR', '€', 'fr-RE', '+262', 'Indian/Reunion'),
  ('SH', 'Saint Helena', 'SHP', '£', 'en-SH', '+290', 'Atlantic/St_Helena'),
  ('EH', 'Western Sahara', 'MAD', 'DH', 'ar-EH', '+212', 'Africa/El_Aaiun')
on conflict (code) do nothing;

-- Country languages (many per country; exactly one primary each)
insert into public.country_languages (country_code, language_code, name, native_name, is_primary, sort_order) values
  -- Algeria
  ('DZ', 'ar', 'Arabic', 'العربية', true, 0),
  ('DZ', 'fr', 'French', 'Français', false, 1),
  ('DZ', 'ber', 'Berber', 'Tamaziɣt', false, 2),
  -- Angola
  ('AO', 'pt', 'Portuguese', 'Português', true, 0),
  ('AO', 'umb', 'Umbundu', 'Úmbúndú', false, 1),
  ('AO', 'kmb', 'Kimbundu', 'Kimbundu', false, 2),
  ('AO', 'kon', 'Kikongo', 'Kikongo', false, 3),
  -- Benin
  ('BJ', 'fr', 'French', 'Français', true, 0),
  ('BJ', 'fon', 'Fon', 'Fɔngbè', false, 1),
  ('BJ', 'yo', 'Yoruba', 'Yorùbá', false, 2),
  ('BJ', 'bar', 'Bariba', 'Baatɔnum', false, 3),
  -- Botswana
  ('BW', 'en', 'English', 'English', true, 0),
  ('BW', 'tn', 'Tswana', 'Setswana', false, 1),
  -- Burkina Faso
  ('BF', 'fr', 'French', 'Français', true, 0),
  ('BF', 'mos', 'Mossi', 'Mooré', false, 1),
  ('BF', 'dyu', 'Dyula', 'Julakan', false, 2),
  ('BF', 'fuf', 'Fula', 'Fulfulde', false, 3),
  -- Burundi
  ('BI', 'fr', 'French', 'Français', true, 0),
  ('BI', 'rn', 'Kirundi', 'Ikirundi', false, 1),
  ('BI', 'en', 'English', 'English', false, 2),
  -- Cabo Verde
  ('CV', 'pt', 'Portuguese', 'Português', true, 0),
  ('CV', 'kea', 'Cape Verdean Creole', 'Kriolu', false, 1),
  -- Cameroon
  ('CM', 'fr', 'French', 'Français', true, 0),
  ('CM', 'en', 'English', 'English', false, 1),
  ('CM', 'fuf', 'Fula', 'Fulfulde', false, 2),
  ('CM', 'ewo', 'Ewondo', 'Ewondo', false, 3),
  -- Central African Republic
  ('CF', 'fr', 'French', 'Français', true, 0),
  ('CF', 'sg', 'Sango', 'Sängö', false, 1),
  -- Chad
  ('TD', 'fr', 'French', 'Français', true, 0),
  ('TD', 'ar', 'Arabic', 'العربية', false, 1),
  ('TD', 'sre', 'Sara', 'Sara', false, 2),
  -- Comoros
  ('KM', 'fr', 'French', 'Français', true, 0),
  ('KM', 'ar', 'Arabic', 'العربية', false, 1),
  ('KM', 'zdj', 'Comorian', 'Shikomori', false, 2),
  -- Congo (Brazzaville)
  ('CG', 'fr', 'French', 'Français', true, 0),
  ('CG', 'kon', 'Kikongo', 'Kikongo', false, 1),
  ('CG', 'lin', 'Lingala', 'Lingála', false, 2),
  ('CG', 'kit', 'Kituba', 'Kituba', false, 3),
  -- DR Congo
  ('CD', 'fr', 'French', 'Français', true, 0),
  ('CD', 'lin', 'Lingala', 'Lingála', false, 1),
  ('CD', 'sw', 'Swahili', 'Kiswahili', false, 2),
  ('CD', 'lua', 'Tshiluba', 'Tshiluba', false, 3),
  ('CD', 'kon', 'Kikongo', 'Kikongo', false, 4),
  -- Cote d'Ivoire
  ('CI', 'fr', 'French', 'Français', true, 0),
  ('CI', 'bci', 'Baoulé', 'Baule', false, 1),
  ('CI', 'dyu', 'Dyula', 'Julakan', false, 2),
  ('CI', 'yo', 'Yoruba', 'Yorùbá', false, 3),
  -- Djibouti
  ('DJ', 'fr', 'French', 'Français', true, 0),
  ('DJ', 'ar', 'Arabic', 'العربية', false, 1),
  ('DJ', 'so', 'Somali', 'Soomaali', false, 2),
  ('DJ', 'aa', 'Afar', 'Qafar af', false, 3),
  -- Egypt
  ('EG', 'ar', 'Arabic', 'العربية', true, 0),
  ('EG', 'en', 'English', 'English', false, 1),
  -- Equatorial Guinea
  ('GQ', 'es', 'Spanish', 'Español', true, 0),
  ('GQ', 'fr', 'French', 'Français', false, 1),
  ('GQ', 'pt', 'Portuguese', 'Português', false, 2),
  ('GQ', 'fan', 'Fang', 'Fang', false, 3),
  -- Eritrea
  ('ER', 'ti', 'Tigrinya', 'ትግርኛ', true, 0),
  ('ER', 'ar', 'Arabic', 'العربية', false, 1),
  ('ER', 'en', 'English', 'English', false, 2),
  ('ER', 'tig', 'Tigre', 'ትግረ', false, 3),
  -- Eswatini
  ('SZ', 'en', 'English', 'English', true, 0),
  ('SZ', 'ss', 'Swazi', 'siSwati', false, 1),
  -- Ethiopia
  ('ET', 'am', 'Amharic', 'አማርኛ', true, 0),
  ('ET', 'om', 'Oromo', 'Afaan Oromoo', false, 1),
  ('ET', 'so', 'Somali', 'Soomaali', false, 2),
  ('ET', 'ti', 'Tigrinya', 'ትግርኛ', false, 3),
  -- Gabon
  ('GA', 'fr', 'French', 'Français', true, 0),
  ('GA', 'fan', 'Fang', 'Fang', false, 1),
  ('GA', 'mye', 'Myene', 'Myene', false, 2),
  -- Gambia
  ('GM', 'en', 'English', 'English', true, 0),
  ('GM', 'mnk', 'Mandinka', 'Mandinka', false, 1),
  ('GM', 'fuf', 'Fula', 'Fulfulde', false, 2),
  ('GM', 'wo', 'Wolof', 'Wolof', false, 3),
  -- Ghana
  ('GH', 'en', 'English', 'English', true, 0),
  ('GH', 'ak', 'Akan', 'Akan', false, 1),
  ('GH', 'ee', 'Ewe', 'Eʋegbe', false, 2),
  ('GH', 'gaa', 'Ga', 'Gã', false, 3),
  ('GH', 'dag', 'Dagbani', 'Dagbanli', false, 4),
  -- Guinea
  ('GN', 'fr', 'French', 'Français', true, 0),
  ('GN', 'fuf', 'Fula', 'Fulfulde', false, 1),
  ('GN', 'mnk', 'Mandinka', 'Mandinka', false, 2),
  ('GN', 'sus', 'Susu', 'Sosoxui', false, 3),
  -- Guinea-Bissau
  ('GW', 'pt', 'Portuguese', 'Português', true, 0),
  ('GW', 'pov', 'Guinea-Bissau Creole', 'Kriol', false, 1),
  ('GW', 'fuf', 'Fula', 'Fulfulde', false, 2),
  ('GW', 'mnk', 'Mandinka', 'Mandinka', false, 3),
  -- Kenya
  ('KE', 'en', 'English', 'English', true, 0),
  ('KE', 'sw', 'Swahili', 'Kiswahili', false, 1),
  ('KE', 'ki', 'Kikuyu', 'Gĩkũyũ', false, 2),
  ('KE', 'luo', 'Dholuo', 'Dholuo', false, 3),
  ('KE', 'kam', 'Kamba', 'Kikamba', false, 4),
  -- Lesotho
  ('LS', 'en', 'English', 'English', true, 0),
  ('LS', 'st', 'Sesotho', 'Sesotho', false, 1),
  -- Liberia
  ('LR', 'en', 'English', 'English', true, 0),
  ('LR', 'kpe', 'Kpelle', 'Kpɛllɛ', false, 1),
  ('LR', 'bsq', 'Bassa', 'Bassa', false, 2),
  -- Libya
  ('LY', 'ar', 'Arabic', 'العربية', true, 0),
  ('LY', 'ber', 'Berber', 'Tamaziɣt', false, 1),
  -- Madagascar
  ('MG', 'mg', 'Malagasy', 'Malagasy', true, 0),
  ('MG', 'fr', 'French', 'Français', false, 1),
  -- Malawi
  ('MW', 'en', 'English', 'English', true, 0),
  ('MW', 'ny', 'Chichewa', 'Chichewa', false, 1),
  ('MW', 'tum', 'Tumbuka', 'ChiTumbuka', false, 2),
  -- Mali
  ('ML', 'fr', 'French', 'Français', true, 0),
  ('ML', 'bm', 'Bambara', 'Bamanankan', false, 1),
  ('ML', 'fuf', 'Fula', 'Fulfulde', false, 2),
  ('ML', 'snk', 'Soninke', 'Sooninkanxanne', false, 3),
  -- Mauritania
  ('MR', 'ar', 'Arabic', 'العربية', true, 0),
  ('MR', 'fuc', 'Pulaar', 'Pulaar', false, 1),
  ('MR', 'wo', 'Wolof', 'Wolof', false, 2),
  ('MR', 'snk', 'Soninke', 'Sooninkanxanne', false, 3),
  -- Mauritius
  ('MU', 'en', 'English', 'English', true, 0),
  ('MU', 'fr', 'French', 'Français', false, 1),
  ('MU', 'mfe', 'Mauritian Creole', 'Kreol Morisien', false, 2),
  ('MU', 'hi', 'Hindi', 'हिन्दी', false, 3),
  -- Morocco
  ('MA', 'ar', 'Arabic', 'العربية', true, 0),
  ('MA', 'ber', 'Berber', 'Tamaziɣt', false, 1),
  ('MA', 'fr', 'French', 'Français', false, 2),
  -- Mozambique
  ('MZ', 'pt', 'Portuguese', 'Português', true, 0),
  ('MZ', 'mgh', 'Makhuwa', 'Makhuwa', false, 1),
  ('MZ', 'sna', 'Shona', 'chiShona', false, 2),
  ('MZ', 'ts', 'Tsonga', 'xiTsonga', false, 3),
  -- Namibia
  ('NA', 'en', 'English', 'English', true, 0),
  ('NA', 'af', 'Afrikaans', 'Afrikaans', false, 1),
  ('NA', 'naq', 'Khoekhoe', 'Khoekhoegowab', false, 2),
  ('NA', 'hz', 'Otjiherero', 'Otjiherero', false, 3),
  ('NA', 'kj', 'Oshiwambo', 'Oshiwambo', false, 4),
  -- Niger
  ('NE', 'fr', 'French', 'Français', true, 0),
  ('NE', 'ha', 'Hausa', 'Hausa', false, 1),
  ('NE', 'kr', 'Kanuri', 'Kanuri', false, 2),
  ('NE', 'twq', 'Songhai', 'Songhay', false, 3),
  -- Nigeria
  ('NG', 'en', 'English', 'English', true, 0),
  ('NG', 'ha', 'Hausa', 'Hausa', false, 1),
  ('NG', 'ig', 'Igbo', 'Igbo', false, 2),
  ('NG', 'yo', 'Yoruba', 'Yorùbá', false, 3),
  ('NG', 'pcm', 'Nigerian Pidgin', 'Naijá', false, 4),
  -- Rwanda
  ('RW', 'rw', 'Kinyarwanda', 'Ikinyarwanda', true, 0),
  ('RW', 'fr', 'French', 'Français', false, 1),
  ('RW', 'en', 'English', 'English', false, 2),
  ('RW', 'sw', 'Swahili', 'Kiswahili', false, 3),
  -- Sao Tome and Principe
  ('ST', 'pt', 'Portuguese', 'Português', true, 0),
  ('ST', 'cri', 'Forro Creole', 'Forro', false, 1),
  -- Senegal
  ('SN', 'fr', 'French', 'Français', true, 0),
  ('SN', 'wo', 'Wolof', 'Wolof', false, 1),
  ('SN', 'fuf', 'Fula', 'Fulfulde', false, 2),
  ('SN', 'srr', 'Serer', 'Seereer', false, 3),
  -- Seychelles
  ('SC', 'en', 'English', 'English', true, 0),
  ('SC', 'fr', 'French', 'Français', false, 1),
  ('SC', 'crs', 'Seychellois Creole', 'Kreol Seselwa', false, 2),
  -- Sierra Leone
  ('SL', 'en', 'English', 'English', true, 0),
  ('SL', 'kri', 'Krio', 'Krio', false, 1),
  ('SL', 'tem', 'Temne', 'Temne', false, 2),
  ('SL', 'men', 'Mende', 'Mende', false, 3),
  -- Somalia
  ('SO', 'so', 'Somali', 'Soomaali', true, 0),
  ('SO', 'ar', 'Arabic', 'العربية', false, 1),
  -- South Africa (12 official languages incl. SA sign language)
  ('ZA', 'en', 'English', 'English', true, 0),
  ('ZA', 'af', 'Afrikaans', 'Afrikaans', false, 1),
  ('ZA', 'zu', 'Zulu', 'isiZulu', false, 2),
  ('ZA', 'xh', 'Xhosa', 'isiXhosa', false, 3),
  ('ZA', 'st', 'Southern Sotho', 'Sesotho', false, 4),
  ('ZA', 'tn', 'Tswana', 'Setswana', false, 5),
  ('ZA', 'ts', 'Tsonga', 'xiTsonga', false, 6),
  ('ZA', 'ss', 'Swazi', 'siSwati', false, 7),
  ('ZA', 've', 'Venda', 'Tshivenḓa', false, 8),
  ('ZA', 'nr', 'Ndebele', 'isiNdebele', false, 9),
  ('ZA', 'nso', 'Northern Sotho', 'Sesotho sa Leboa', false, 10),
  ('ZA', 'sfs', 'South African Sign Language', 'South African Sign Language', false, 11),
  -- South Sudan
  ('SS', 'en', 'English', 'English', true, 0),
  ('SS', 'ar', 'Arabic', 'العربية', false, 1),
  ('SS', 'din', 'Dinka', 'Thuɔŋjäŋ', false, 2),
  ('SS', 'nus', 'Nuer', 'Thok Naath', false, 3),
  -- Sudan
  ('SD', 'ar', 'Arabic', 'العربية', true, 0),
  ('SD', 'en', 'English', 'English', false, 1),
  ('SD', 'nus', 'Nuer', 'Thok Naath', false, 2),
  -- Tanzania
  ('TZ', 'sw', 'Swahili', 'Kiswahili', true, 0),
  ('TZ', 'en', 'English', 'English', false, 1),
  -- Togo
  ('TG', 'fr', 'French', 'Français', true, 0),
  ('TG', 'ee', 'Ewe', 'Eʋegbe', false, 1),
  ('TG', 'kbp', 'Kabiyè', 'Kabɩyɛ', false, 2),
  -- Tunisia
  ('TN', 'ar', 'Arabic', 'العربية', true, 0),
  ('TN', 'fr', 'French', 'Français', false, 1),
  -- Uganda
  ('UG', 'en', 'English', 'English', true, 0),
  ('UG', 'sw', 'Swahili', 'Kiswahili', false, 1),
  ('UG', 'lg', 'Luganda', 'Luganda', false, 2),
  ('UG', 'nyn', 'Runyankole', 'Runyankore', false, 3),
  -- Zambia
  ('ZM', 'en', 'English', 'English', true, 0),
  ('ZM', 'bem', 'Bemba', 'Ichibemba', false, 1),
  ('ZM', 'ny', 'Nyanja', 'Chinyanja', false, 2),
  ('ZM', 'toi', 'Tonga', 'Chitonga', false, 3),
  ('ZM', 'loz', 'Lozi', 'Silozi', false, 4),
  -- Zimbabwe
  ('ZW', 'en', 'English', 'English', true, 0),
  ('ZW', 'sn', 'Shona', 'chiShona', false, 1),
  ('ZW', 'nd', 'Northern Ndebele', 'isiNdebele', false, 2),
  -- Territories
  ('YT', 'fr', 'French', 'Français', true, 0),
  ('YT', 'sw', 'Swahili', 'Kiswahili', false, 1),
  ('RE', 'fr', 'French', 'Français', true, 0),
  ('RE', 'rcf', 'Réunion Creole', 'Kréol Rényoné', false, 1),
  ('SH', 'en', 'English', 'English', true, 0),
  ('EH', 'ar', 'Arabic', 'العربية', true, 0),
  ('EH', 'es', 'Spanish', 'Español', false, 1)
on conflict (country_code, language_code) do update set
  name = excluded.name,
  native_name = excluded.native_name,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order;

insert into public.industries (name, slug, sort_order) values
  ('Agriculture & Food', 'agriculture-food', 1), ('Business Services', 'business-services', 2),
  ('Commerce & Retail', 'commerce-retail', 3), ('Construction', 'construction-infrastructure', 4),
  ('Creative & Media', 'creative-media', 5), ('Green Economy', 'green-economy', 6),
  ('Health & Wellness', 'health-wellness', 7), ('Hospitality & Tourism', 'hospitality-tourism', 8),
  ('Logistics', 'logistics-courier', 9), ('Manufacturing', 'manufacturing', 10),
  ('Professional Services', 'professional-services', 11), ('Real Estate', 'real-estate', 12),
  ('Education', 'schools-education', 13), ('Technology', 'technology-digital-services', 14),
  ('Transportation', 'transportation', 15)
on conflict (slug) do nothing;

insert into public.business_types (industry_id, name, slug, sort_order)
select i.id, item.name, item.slug, item.sort_order
from (values
  ('Hospitality & Tourism', 'Hotel', 'hotel', 1),
  ('Hospitality & Tourism', 'Resort', 'resort', 2),
  ('Hospitality & Tourism', 'Guest House', 'guest-house', 3),
  ('Hospitality & Tourism', 'Restaurant', 'restaurant', 4),
  ('Hospitality & Tourism', 'Event Centre', 'event-centre', 5),
  ('Hospitality & Tourism', 'Tour Operator', 'tour-operator', 6),
  ('Hospitality & Tourism', 'Travel Agency', 'travel-agency', 7),
  ('Technology', 'Software Company', 'software-company', 1),
  ('Technology', 'IT Services', 'it-services', 2),
  ('Technology', 'Digital Agency', 'digital-agency', 3),
  ('Technology', 'SaaS', 'saas', 4),
  ('Technology', 'Cybersecurity', 'cybersecurity', 5),
  ('Technology', 'Telecommunications', 'telecommunications', 6),
  ('Technology', 'Cloud Services', 'cloud-services', 7),
  ('Technology', 'FinTech', 'fintech', 8)
) as item(industry_name, name, slug, sort_order)
join public.industries i on i.name = item.industry_name
on conflict (industry_id, slug) do nothing;

insert into public.subscription_plans (name, slug, standard_price, currency, booking_enabled, features) values
  ('Basic', 'basic', 45.00, 'USD', false, '["Professional business page", "Verified business presence", "Products and services", "Contact and location", "Gallery and social links", "Search visibility"]'::jsonb),
  ('Business Visibility + Booking', 'business-visibility-booking', 65.00, 'USD', true, '["Everything in Basic", "Business booking functionality"]'::jsonb)
on conflict (slug) do nothing;

insert into public.promotions (name, code, discount_percent, is_active) values
  ('Launch offer', 'LAUNCH80', 80.00, true)
on conflict (code) do nothing;
