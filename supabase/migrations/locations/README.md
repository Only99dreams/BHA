# Location hierarchy seeds

One idempotent SQL seed per country/territory from the **Africa Location Hierarchies - Universal Review** (57 countries/territories, 33,886 locations), plus one extra seed for Burundi, which the review does not cover.

## How to run

1. Run `supabase/migrations/004_location_hierarchy.sql` once (a fresh `supabase/schema.sql` already includes it).
2. Run `supabase/migrations/005_country_locale_currency.sql` once to make language and currency country-specific (also already in `supabase/schema.sql`).
3. Run the seed files in numeric order in the Supabase SQL editor: `001_algeria.sql`, `002_angola.sql`, ... `058_burundi.sql` (one country after the other). The numeric prefix is only a stable run order; `058_burundi.sql` is not from the review.

Every file is safe to re-run:

- Inserts target `on conflict (country_code, path) do update`, so re-running refreshes rows instead of duplicating them.
- Each file upserts its `public.countries` row first (adds territories missing from the base list, e.g. Mayotte, Réunion, Saint Helena, Western Sahara).
- Each file ends with a `do $$ ... $$` assertion that raises an exception if the row count is not exactly as expected. The assertion counts only the paths that file declares, so it stays correct even if other rows exist for the same country (an admin tool, a partial run, etc.).

## Counts

| | |
|---|---|
| Seed files | 58 |
| Locations seeded from the review | **33,812** |
| Locations seeded for Burundi (official divisions) | 138 |
| Locations seeded, total | **33,950** |
| Source name pairs collapsed into one row | 16 |
| Source rows dropped as errors | 1 |
| Seedable review total (33,812 + 16 + 1) | 33,829 |
| Document total (33,886) minus the single shared `Africa` row | 33,829 |

The document's 33,886 counts, per country, the `Africa` root plus the country root plus that country's entries. The `Africa` row is shared by all countries, so it is **not** re-created in each file: 33,886 − 57 duplicated `Africa` rows = 33,829 seedable rows, of which 16 collapse (below) leaving 33,813.

### Collapsed rows

`public.location_slug()` strips accents, so a handful of sibling pairs that differ only by accent fold onto the same path. The first wins; the duplicate is documented in the file header and **not** stored as a second row:

| File | Collapsed | Detail |
|---|---|---|
| `021_ghana.sql` | 8 | Odumase, Hwidiem, Effiduase, Baatsona, Bekwai, Salaga, Kete Krachi, Bibiani (town block repeats district names) |
| `019_gabon.sql` | 3 | Léconi/Leconi, Moulengui-Binza/Mouléngui-Binza, Medouneu/Médouneu |
| `028_madagascar.sql` | 3 | Vohémar/Vohemar, Fénérive Est/Fenerive Est, Mananara Nord/Mananara-Nord |
| `002_angola.sql` | 1 | Tômbwa/Tombwa |
| `015_equatorial_guinea.sql` | 1 | Añisok/Anisok |

## Source corrections

| File | Dropped | Detail |
|---|---|---|
| `011_cote-d-ivoire-ivory-coast.sql` | 1 | `Libreville` — the review lists this Gabonese city under Côte d'Ivoire → Montagnes District → Tonkpi Region → Man Department. A source error; the row is not seeded. |

## Source note: Burundi

Burundi is **not** in the review document, but it is in the base `public.countries` seed. `058_burundi.sql` fills that gap from Burundi's official administrative divisions: the 18 provinces and their 119 communes in force from 2015 to 2025 (the last full set with published communes). It is `Province -> Commune`, no deeper. This data does **not** come from the review and is labelled as such in the file header, so it is never mistaken for review content.

## Source note: Ghana

The review's Ghana entry prints its 16 regions and 261 districts correctly, then appends a flat block of 451 towns **without** their district headers. The seeds keep that shape: the 451 towns are stored as level-2 `Town` nodes under Ghana rather than being guessed into districts. This is faithful to the source; the source simply does not state the district for those towns.

## Structure

- Depth and `location_type` labels vary per country: Wilaya/Daïra/Commune (Algeria), Region/District/Town (Ghana), County/Constituency/Ward (Kenya), State/Region/District/City (Somalia), up to six levels (Sierra Leone).
- `path` is a slug path built with `public.location_slug()`: `NFD` → drop combining marks → lowercase → non-alphanumerics to `-`.
- Children join their parent on `(country_code, path)`, which is unique, so a join cannot fan out; each file's closing assertion catches a missing parent.

## Verify any country

```sql
select level, location_type, count(*)
from public.locations
where country_code = 'DZ'
group by 1, 2
order by 1, 2;

-- Grand total across all seeded countries (33950 with the review plus Burundi; 33812 for the review alone)
select count(*) from public.locations;

-- Every country's row count
select country_code, count(*)
from public.locations
group by 1
order by 1;

-- Orphan check: must return 0 rows
select * from public.locations l
where l.parent_id is null
  and l.level > 1;
```

## Rebuilding the seeds

The per-country seed content comes from the review document that produced the original per-country CSVs (`*_universal_review_with_parent_path.csv`) plus the Ghana section of the PDF. Names, types and hierarchy are taken verbatim; only the slug `path` values are normalised, and the one clear source error listed under **Source corrections** is dropped. `058_burundi.sql` is the exception: its content comes from Burundi's official administrative divisions, not the review.
