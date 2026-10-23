-- ============================================================================
-- BHA Phase 2: Location Hierarchy Foundation
-- Universal parent-child location tree for 57 African countries/territories
-- from the "Africa Location Hierarchies - Universal Review", plus Burundi
-- (official administrative divisions; the review does not cover it).
-- Depth and location_type labels vary per country, e.g.
--   Algeria   : Wilaya -> Daïra -> Commune
--   Ghana     : Region -> District -> Town
--   Kenya     : County -> Constituency -> Ward
--   Somalia   : State -> Region -> District -> City/Town/Area
-- Country data is loaded by the idempotent seeds in
-- supabase/migrations/locations/NNN_<country>.sql (run one after the other).
-- ============================================================================

-- 1. LOCATIONS (hierarchy nodes)
-- ============================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete cascade,
  parent_id uuid references public.locations(id) on delete cascade,
  name text not null,
  location_type text not null default '', -- e.g. 'Wilaya', 'Region', 'County', 'Ward', 'City'
  level integer not null default 1 check (level >= 1),
  path text not null, -- slug path within the country, e.g. 'chlef/el-atabia'
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deterministic upsert target for the seeds (on conflict country_code, path)
create unique index if not exists locations_country_path_key
  on public.locations (country_code, path);

-- Sibling names must be unique; root rows use the zero uuid as parent sentinel
create unique index if not exists locations_sibling_name_key
  on public.locations (
    country_code,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create index if not exists locations_parent_idx on public.locations (country_code, parent_id);
create index if not exists locations_name_idx on public.locations (lower(name));
create index if not exists locations_country_type_idx on public.locations (country_code, location_type);

-- 2. SLUG HELPER (deterministic slug paths for idempotent seeds)
--    NFD-decompose, drop combining marks, then ASCII-fold. Matches the generator
--    used to build supabase/migrations/locations/*.sql (which applies the same rule).
-- ============================================================================
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

-- 3. ROW LEVEL SECURITY
-- ============================================================================
alter table public.locations enable row level security;

drop policy if exists "Anyone can view active locations" on public.locations;
create policy "Anyone can view active locations" on public.locations for select using (is_active);
-- No client write policies: seeds and updates run in the SQL editor / service role only.
