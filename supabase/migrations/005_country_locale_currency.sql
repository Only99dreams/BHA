-- ============================================================================
-- BHA Phase 3: Location-specific language & currency
-- Makes locale (language) and currency country-specific, and exposes resolvers
-- that walk any location up to its country so a business resolves the right
-- language and currency at any hierarchy depth.
--
-- Design:
--   countries.currency_code / currency_symbol / default_locale / dial_code / timezone
--     -> one row per country, backfilled below.
--   country_languages (country_code, language_code, name, is_primary, sort_order)
--     -> many languages per country (South Africa has 11 official languages).
--   location_currency(location_id)  -> resolves the country currency from any node
--   location_languages(location_id) -> resolves the country's languages from any node
--   business_currency(business_id)  -> convenience wrapper for a business row
--
-- Everything is idempotent: columns use `add column if not exists`, tables use
-- `create table if not exists`, seeds use `on conflict ... do update`.
-- ============================================================================

-- 1. COUNTRIES: locale + currency + telephony columns
-- ============================================================================
alter table public.countries
  add column if not exists currency_code text,
  add column if not exists currency_symbol text,
  add column if not exists default_locale text,
  add column if not exists dial_code text,
  add column if not exists timezone text;

comment on column public.countries.currency_code is
  'ISO 4217 code of the country''s primary currency, e.g. GHS.';
comment on column public.countries.currency_symbol is
  'Display symbol for currency_code, e.g. GH₵.';
comment on column public.countries.default_locale is
  'BCP-47 locale used for the country by default, e.g. en-GH.';
comment on column public.countries.dial_code is
  'International dialling prefix, e.g. +233.';
comment on column public.countries.timezone is
  'Primary IANA timezone, e.g. Africa/Accra (a country may span several; this is the reference one).';

-- 2. COUNTRY LANGUAGES (many per country)
-- ============================================================================
create table if not exists public.country_languages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  language_code text not null,          -- BCP-47 primary subtag, e.g. 'en', 'fr', 'sw'
  name text not null,                   -- English name, e.g. 'English'
  native_name text,                     -- endonym, e.g. 'Kiswahili'
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (country_code, language_code)
);

comment on table public.country_languages is
  'Languages associated with a country; exactly one row per country should set is_primary.';

-- At most one primary language per country.
create unique index if not exists country_languages_one_primary_key
  on public.country_languages (country_code)
  where is_primary;

create index if not exists country_languages_country_idx
  on public.country_languages (country_code, sort_order);

-- 3. RESOLVERS
-- ============================================================================

-- Currency of the country that owns a given location (walks the parent chain).
create or replace function public.location_currency(p_location_id uuid)
returns text
language sql
stable
as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l
    join chain c on l.id = c.parent_id
  )
  select c.currency_code
  from chain ch
  join public.countries c on c.code = ch.country_code
  limit 1
$$;

-- Default locale of the country that owns a given location.
create or replace function public.location_locale(p_location_id uuid)
returns text
language sql
stable
as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l
    join chain c on l.id = c.parent_id
  )
  select c.default_locale
  from chain ch
  join public.countries c on c.code = ch.country_code
  limit 1
$$;

-- Languages of the country that owns a given location, primary first.
create or replace function public.location_languages(p_location_id uuid)
returns table (language_code text, name text, native_name text, is_primary boolean)
language sql
stable
as $$
  with recursive chain as (
    select id, parent_id, country_code from public.locations where id = p_location_id
    union all
    select l.id, l.parent_id, l.country_code
    from public.locations l
    join chain c on l.id = c.parent_id
  )
  select cl.language_code, cl.name, cl.native_name, cl.is_primary
  from chain ch
  join public.country_languages cl on cl.country_code = ch.country_code
  order by cl.is_primary desc, cl.sort_order, cl.name
$$;

-- Convenience wrappers keyed by a business row (businesses.country_code exists,
-- but these keep the API symmetric with the location resolvers).
create or replace function public.business_currency(p_business_id uuid)
returns text
language sql
stable
as $$
  select c.currency_code
  from public.businesses b
  join public.countries c on c.code = b.country_code
  where b.id = p_business_id
$$;

create or replace function public.business_locale(p_business_id uuid)
returns text
language sql
stable
as $$
  select c.default_locale
  from public.businesses b
  join public.countries c on c.code = b.country_code
  where b.id = p_business_id
$$;

-- 4. ROW LEVEL SECURITY
-- ============================================================================
alter table public.country_languages enable row level security;

drop policy if exists "Anyone can view country languages" on public.country_languages;
create policy "Anyone can view country languages" on public.country_languages for select using (true);
-- No client write policies: this reference data is loaded by seeds / service role.

-- 5. BACKFILL COUNTRIES (locale, currency, dial code, timezone)
-- ============================================================================
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
  -- Territories added by the location seeds (not in the base schema list)
  ('YT', 'Mayotte', 'EUR', '€', 'fr-YT', '+262', 'Indian/Mayotte'),
  ('RE', 'Reunion', 'EUR', '€', 'fr-RE', '+262', 'Indian/Reunion'),
  ('SH', 'Saint Helena', 'SHP', '£', 'en-SH', '+290', 'Atlantic/St_Helena'),
  ('EH', 'Western Sahara', 'MAD', 'DH', 'ar-EH', '+212', 'Africa/El_Aaiun')
on conflict (code) do update set
  currency_code   = excluded.currency_code,
  currency_symbol = excluded.currency_symbol,
  default_locale  = excluded.default_locale,
  dial_code       = excluded.dial_code,
  timezone        = excluded.timezone;

-- 6. BACKFILL COUNTRY LANGUAGES
--    is_primary = the language used for the country's default_locale.
-- ============================================================================
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

-- 7. SAFETY NETS
-- ============================================================================
do $$
declare missing_currency integer;
declare missing_lang integer;
begin
  select count(*) into missing_currency
  from public.countries
  where currency_code is null or default_locale is null;

  if missing_currency <> 0 then
    raise exception 'country locale/currency backfill: % countries still have no currency or locale', missing_currency;
  end if;

  select count(*) into missing_lang
  from public.countries c
  where not exists (select 1 from public.country_languages cl where cl.country_code = c.code);

  if missing_lang <> 0 then
    raise exception 'country_languages backfill: % countries have no languages', missing_lang;
  end if;

  if exists (
    select country_code from public.country_languages
    group by country_code having count(*) filter (where is_primary) <> 1
  ) then
    raise exception 'country_languages backfill: a country does not have exactly one primary language';
  end if;
end $$;
