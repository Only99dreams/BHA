-- ============================================================================
-- BHA location hierarchy seed: Saint Helena (SH)
-- Source: "Africa Location Hierarchies - Universal Review" - Saint Helena
-- 117 locations beyond the country root. Idempotent: re-running refreshes.
-- Prerequisite: supabase/migrations/004_location_hierarchy.sql
-- ============================================================================

-- 0. Country row (adds any territory missing from the base schema seed)
insert into public.countries (code, name) values
  ('SH', 'Saint Helena')
on conflict (code) do update set name = excluded.name;

-- 1. Country root (level 1)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'SH', null, 'Saint Helena', 'Country', 1, 'saint-helena', 0
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level;

-- 2. Level 2 (3 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'SH', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('saint-helena', 'Saint Helena Island', 'Administrative Area / Island', 2, 'saint-helena/saint-helena-island', 0),
    ('saint-helena', 'Ascension Island', 'Administrative Area / Island', 2, 'saint-helena/ascension-island', 1),
    ('saint-helena', 'Tristan da Cunha Island Group', 'Administrative Area / Island Group', 2, 'saint-helena/tristan-da-cunha-island-group', 2)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'SH' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- 3. Level 3 (19 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'SH', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('saint-helena/saint-helena-island', 'Alarm Forest District', 'District', 3, 'saint-helena/saint-helena-island/alarm-forest-district', 0),
    ('saint-helena/saint-helena-island', 'Blue Hill District', 'District', 3, 'saint-helena/saint-helena-island/blue-hill-district', 1),
    ('saint-helena/saint-helena-island', 'Half Tree Hollow District', 'District', 3, 'saint-helena/saint-helena-island/half-tree-hollow-district', 2),
    ('saint-helena/saint-helena-island', 'Jamestown District', 'District', 3, 'saint-helena/saint-helena-island/jamestown-district', 3),
    ('saint-helena/saint-helena-island', 'Levelwood District', 'District', 3, 'saint-helena/saint-helena-island/levelwood-district', 4),
    ('saint-helena/saint-helena-island', 'Longwood District', 'District', 3, 'saint-helena/saint-helena-island/longwood-district', 5),
    ('saint-helena/saint-helena-island', 'Sandy Bay District', 'District', 3, 'saint-helena/saint-helena-island/sandy-bay-district', 6),
    ('saint-helena/saint-helena-island', 'Saint Paul''s District', 'District', 3, 'saint-helena/saint-helena-island/saint-paul-s-district', 7),
    ('saint-helena/ascension-island', 'Georgetown Settlement', 'Settlement/Facility', 3, 'saint-helena/ascension-island/georgetown-settlement', 8),
    ('saint-helena/ascension-island', 'Two Boats Village', 'Settlement/Facility', 3, 'saint-helena/ascension-island/two-boats-village', 9),
    ('saint-helena/ascension-island', 'Cat Hill Base Area', 'Settlement/Facility', 3, 'saint-helena/ascension-island/cat-hill-base-area', 10),
    ('saint-helena/ascension-island', 'Traveller''s Hill Base Area', 'Settlement/Facility', 3, 'saint-helena/ascension-island/traveller-s-hill-base-area', 11),
    ('saint-helena/ascension-island', 'Green Mountain Area', 'Settlement/Facility', 3, 'saint-helena/ascension-island/green-mountain-area', 12),
    ('saint-helena/ascension-island', 'The Residency Area', 'Settlement/Facility', 3, 'saint-helena/ascension-island/the-residency-area', 13),
    ('saint-helena/ascension-island', 'BBC Relay Station Area', 'Settlement/Facility', 3, 'saint-helena/ascension-island/bbc-relay-station-area', 14),
    ('saint-helena/tristan-da-cunha-island-group', 'Tristan da Cunha Island', 'Island/Settlement', 3, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 15),
    ('saint-helena/tristan-da-cunha-island-group', 'Inaccessible Island', 'Island/Settlement', 3, 'saint-helena/tristan-da-cunha-island-group/inaccessible-island', 16),
    ('saint-helena/tristan-da-cunha-island-group', 'Nightingale Islands', 'Island/Settlement', 3, 'saint-helena/tristan-da-cunha-island-group/nightingale-islands', 17),
    ('saint-helena/tristan-da-cunha-island-group', 'Gough Island', 'Island/Settlement', 3, 'saint-helena/tristan-da-cunha-island-group/gough-island', 18)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'SH' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- 4. Level 4 (95 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'SH', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('saint-helena/saint-helena-island/alarm-forest-district', 'Alarm Forest', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/alarm-forest', 0),
    ('saint-helena/saint-helena-island/alarm-forest-district', 'The Briars', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/the-briars', 1),
    ('saint-helena/saint-helena-island/alarm-forest-district', 'Rupert''s Valley', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/rupert-s-valley', 2),
    ('saint-helena/saint-helena-island/alarm-forest-district', 'Rupert''s Bay', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/rupert-s-bay', 3),
    ('saint-helena/saint-helena-island/alarm-forest-district', 'Hutt''s Gate', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/hutt-s-gate', 4),
    ('saint-helena/saint-helena-island/alarm-forest-district', 'Alarm House Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/alarm-forest-district/alarm-house-area', 5),
    ('saint-helena/saint-helena-island/blue-hill-district', 'Blue Hill', 'Town/Area', 4, 'saint-helena/saint-helena-island/blue-hill-district/blue-hill', 6),
    ('saint-helena/saint-helena-island/blue-hill-district', 'Blue Hill Village', 'Town/Area', 4, 'saint-helena/saint-helena-island/blue-hill-district/blue-hill-village', 7),
    ('saint-helena/saint-helena-island/blue-hill-district', 'Head O''Wain', 'Town/Area', 4, 'saint-helena/saint-helena-island/blue-hill-district/head-o-wain', 8),
    ('saint-helena/saint-helena-island/blue-hill-district', 'Thompson''s Valley', 'Town/Area', 4, 'saint-helena/saint-helena-island/blue-hill-district/thompson-s-valley', 9),
    ('saint-helena/saint-helena-island/blue-hill-district', 'High Peak Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/blue-hill-district/high-peak-area', 10),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'Half Tree Hollow', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/half-tree-hollow', 11),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'Ladder Hill', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/ladder-hill', 12),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'New Ground', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/new-ground', 13),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'Cleugh''s Plain', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/cleugh-s-plain', 14),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'Sapper Way', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/sapper-way', 15),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'High Knoll Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/high-knoll-area', 16),
    ('saint-helena/saint-helena-island/half-tree-hollow-district', 'Red Hill', 'Town/Area', 4, 'saint-helena/saint-helena-island/half-tree-hollow-district/red-hill', 17),
    ('saint-helena/saint-helena-island/jamestown-district', 'Jamestown', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/jamestown', 18),
    ('saint-helena/saint-helena-island/jamestown-district', 'Main Street', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/main-street', 19),
    ('saint-helena/saint-helena-island/jamestown-district', 'The Castle Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/the-castle-area', 20),
    ('saint-helena/saint-helena-island/jamestown-district', 'Grand Parade', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/grand-parade', 21),
    ('saint-helena/saint-helena-island/jamestown-district', 'James Bay', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/james-bay', 22),
    ('saint-helena/saint-helena-island/jamestown-district', 'Seafront Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/seafront-area', 23),
    ('saint-helena/saint-helena-island/jamestown-district', 'Jacob''s Ladder', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/jacob-s-ladder', 24),
    ('saint-helena/saint-helena-island/jamestown-district', 'Upper Jamestown', 'Town/Area', 4, 'saint-helena/saint-helena-island/jamestown-district/upper-jamestown', 25),
    ('saint-helena/saint-helena-island/levelwood-district', 'Levelwood', 'Town/Area', 4, 'saint-helena/saint-helena-island/levelwood-district/levelwood', 26),
    ('saint-helena/saint-helena-island/levelwood-district', 'Woody Ridge', 'Town/Area', 4, 'saint-helena/saint-helena-island/levelwood-district/woody-ridge', 27),
    ('saint-helena/saint-helena-island/levelwood-district', 'Silver Hill', 'Town/Area', 4, 'saint-helena/saint-helena-island/levelwood-district/silver-hill', 28),
    ('saint-helena/saint-helena-island/levelwood-district', 'Taglate', 'Town/Area', 4, 'saint-helena/saint-helena-island/levelwood-district/taglate', 29),
    ('saint-helena/saint-helena-island/levelwood-district', 'Levelwood Village Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/levelwood-district/levelwood-village-area', 30),
    ('saint-helena/saint-helena-island/longwood-district', 'Longwood', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/longwood', 31),
    ('saint-helena/saint-helena-island/longwood-district', 'Longwood Village', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/longwood-village', 32),
    ('saint-helena/saint-helena-island/longwood-district', 'Longwood New House Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/longwood-new-house-area', 33),
    ('saint-helena/saint-helena-island/longwood-district', 'Deadwood', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/deadwood', 34),
    ('saint-helena/saint-helena-island/longwood-district', 'Bottom Woods', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/bottom-woods', 35),
    ('saint-helena/saint-helena-island/longwood-district', 'Fisher''s Valley', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/fisher-s-valley', 36),
    ('saint-helena/saint-helena-island/longwood-district', 'Horse Point', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/horse-point', 37),
    ('saint-helena/saint-helena-island/longwood-district', 'Prosperous Bay Plain', 'Town/Area', 4, 'saint-helena/saint-helena-island/longwood-district/prosperous-bay-plain', 38),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Sandy Bay', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay', 39),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Sandy Bay Valley', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay-valley', 40),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Sandy Bay Ridge', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay-ridge', 41),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Lot', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/lot', 42),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Mount Pleasant Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/mount-pleasant-area', 43),
    ('saint-helena/saint-helena-island/sandy-bay-district', 'Broad Bottom', 'Town/Area', 4, 'saint-helena/saint-helena-island/sandy-bay-district/broad-bottom', 44),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Saint Paul''s', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/saint-paul-s', 45),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Plantation House Area', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/plantation-house-area', 46),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Francis Plain', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/francis-plain', 47),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Scotland', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/scotland', 48),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'White Gate', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/white-gate', 49),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Rosemary Plain', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/rosemary-plain', 50),
    ('saint-helena/saint-helena-island/saint-paul-s-district', 'Thompson''s Wood', 'Town/Area', 4, 'saint-helena/saint-helena-island/saint-paul-s-district/thompson-s-wood', 51),
    ('saint-helena/ascension-island/georgetown-settlement', 'Georgetown', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/georgetown', 52),
    ('saint-helena/ascension-island/georgetown-settlement', 'Georgetown Harbour', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/georgetown-harbour', 53),
    ('saint-helena/ascension-island/georgetown-settlement', 'Georgetown Pier', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/georgetown-pier', 54),
    ('saint-helena/ascension-island/georgetown-settlement', 'Administrative Centre', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/administrative-centre', 55),
    ('saint-helena/ascension-island/georgetown-settlement', 'Long Beach Area', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/long-beach-area', 56),
    ('saint-helena/ascension-island/georgetown-settlement', 'English Bay', 'Town/Area', 4, 'saint-helena/ascension-island/georgetown-settlement/english-bay', 57),
    ('saint-helena/ascension-island/two-boats-village', 'Two Boats', 'Town/Area', 4, 'saint-helena/ascension-island/two-boats-village/two-boats', 58),
    ('saint-helena/ascension-island/two-boats-village', 'Two Boats School Area', 'Town/Area', 4, 'saint-helena/ascension-island/two-boats-village/two-boats-school-area', 59),
    ('saint-helena/ascension-island/two-boats-village', 'Two Boats Club Area', 'Town/Area', 4, 'saint-helena/ascension-island/two-boats-village/two-boats-club-area', 60),
    ('saint-helena/ascension-island/two-boats-village', 'Green Mountain Road Area', 'Town/Area', 4, 'saint-helena/ascension-island/two-boats-village/green-mountain-road-area', 61),
    ('saint-helena/ascension-island/cat-hill-base-area', 'Cat Hill', 'Town/Area', 4, 'saint-helena/ascension-island/cat-hill-base-area/cat-hill', 62),
    ('saint-helena/ascension-island/cat-hill-base-area', 'US Base Area', 'Town/Area', 4, 'saint-helena/ascension-island/cat-hill-base-area/us-base-area', 63),
    ('saint-helena/ascension-island/cat-hill-base-area', 'Volcano Club Area', 'Town/Area', 4, 'saint-helena/ascension-island/cat-hill-base-area/volcano-club-area', 64),
    ('saint-helena/ascension-island/traveller-s-hill-base-area', 'Traveller''s Hill', 'Town/Area', 4, 'saint-helena/ascension-island/traveller-s-hill-base-area/traveller-s-hill', 65),
    ('saint-helena/ascension-island/traveller-s-hill-base-area', 'RAF Ascension Island', 'Town/Area', 4, 'saint-helena/ascension-island/traveller-s-hill-base-area/raf-ascension-island', 66),
    ('saint-helena/ascension-island/traveller-s-hill-base-area', 'Wideawake Airfield', 'Town/Area', 4, 'saint-helena/ascension-island/traveller-s-hill-base-area/wideawake-airfield', 67),
    ('saint-helena/ascension-island/traveller-s-hill-base-area', 'Airhead Area', 'Town/Area', 4, 'saint-helena/ascension-island/traveller-s-hill-base-area/airhead-area', 68),
    ('saint-helena/ascension-island/green-mountain-area', 'Green Mountain', 'Town/Area', 4, 'saint-helena/ascension-island/green-mountain-area/green-mountain', 69),
    ('saint-helena/ascension-island/green-mountain-area', 'Bamboo Hedge', 'Town/Area', 4, 'saint-helena/ascension-island/green-mountain-area/bamboo-hedge', 70),
    ('saint-helena/ascension-island/green-mountain-area', 'Dew Pond Area', 'Town/Area', 4, 'saint-helena/ascension-island/green-mountain-area/dew-pond-area', 71),
    ('saint-helena/ascension-island/green-mountain-area', 'Weather Post Area', 'Town/Area', 4, 'saint-helena/ascension-island/green-mountain-area/weather-post-area', 72),
    ('saint-helena/ascension-island/the-residency-area', 'The Residency', 'Town/Area', 4, 'saint-helena/ascension-island/the-residency-area/the-residency', 73),
    ('saint-helena/ascension-island/the-residency-area', 'Administrator''s Residence Area', 'Town/Area', 4, 'saint-helena/ascension-island/the-residency-area/administrator-s-residence-area', 74),
    ('saint-helena/ascension-island/bbc-relay-station-area', 'BBC Atlantic Relay Station', 'Town/Area', 4, 'saint-helena/ascension-island/bbc-relay-station-area/bbc-atlantic-relay-station', 75),
    ('saint-helena/ascension-island/bbc-relay-station-area', 'English Bay Road Area', 'Town/Area', 4, 'saint-helena/ascension-island/bbc-relay-station-area/english-bay-road-area', 76),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Edinburgh of the Seven Seas', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/edinburgh-of-the-seven-seas', 77),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'The Settlement', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/the-settlement', 78),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Calshot Harbour', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/calshot-harbour', 79),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Big Beach', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/big-beach', 80),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Little Beach', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/little-beach', 81),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'The Patches', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/the-patches', 82),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Potato Patches', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/potato-patches', 83),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Queen Mary''s Peak Area', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/queen-mary-s-peak-area', 84),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'Sandy Point', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/sandy-point', 85),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'St Mary''s School Area', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/st-mary-s-school-area', 86),
    ('saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island', 'St Joseph''s Church Area', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/st-joseph-s-church-area', 87),
    ('saint-helena/tristan-da-cunha-island-group/inaccessible-island', 'Inaccessible Island', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/inaccessible-island/inaccessible-island', 88),
    ('saint-helena/tristan-da-cunha-island-group/inaccessible-island', 'Inaccessible Island Nature Reserve', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/inaccessible-island/inaccessible-island-nature-reserve', 89),
    ('saint-helena/tristan-da-cunha-island-group/nightingale-islands', 'Nightingale Island', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/nightingale-islands/nightingale-island', 90),
    ('saint-helena/tristan-da-cunha-island-group/nightingale-islands', 'Middle Island', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/nightingale-islands/middle-island', 91),
    ('saint-helena/tristan-da-cunha-island-group/nightingale-islands', 'Stoltenhoff Island', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/nightingale-islands/stoltenhoff-island', 92),
    ('saint-helena/tristan-da-cunha-island-group/gough-island', 'Gough Island', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/gough-island/gough-island', 93),
    ('saint-helena/tristan-da-cunha-island-group/gough-island', 'Gough Island Research Station Area', 'Town/Area', 4, 'saint-helena/tristan-da-cunha-island-group/gough-island/gough-island-research-station-area', 94)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'SH' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- Verify: this file owns exactly 118 rows for SH. The assertion counts only
-- rows whose path is declared in this file, so a correct re-run still passes even when
-- other rows exist for SH.
do $$
declare cnt integer;
begin
  select count(*) into cnt
  from public.locations
  where country_code = 'SH'
    and path = any (array[
      'saint-helena',
      'saint-helena/ascension-island',
      'saint-helena/ascension-island/bbc-relay-station-area',
      'saint-helena/ascension-island/bbc-relay-station-area/bbc-atlantic-relay-station',
      'saint-helena/ascension-island/bbc-relay-station-area/english-bay-road-area',
      'saint-helena/ascension-island/cat-hill-base-area',
      'saint-helena/ascension-island/cat-hill-base-area/cat-hill',
      'saint-helena/ascension-island/cat-hill-base-area/us-base-area',
      'saint-helena/ascension-island/cat-hill-base-area/volcano-club-area',
      'saint-helena/ascension-island/georgetown-settlement',
      'saint-helena/ascension-island/georgetown-settlement/administrative-centre',
      'saint-helena/ascension-island/georgetown-settlement/english-bay',
      'saint-helena/ascension-island/georgetown-settlement/georgetown',
      'saint-helena/ascension-island/georgetown-settlement/georgetown-harbour',
      'saint-helena/ascension-island/georgetown-settlement/georgetown-pier',
      'saint-helena/ascension-island/georgetown-settlement/long-beach-area',
      'saint-helena/ascension-island/green-mountain-area',
      'saint-helena/ascension-island/green-mountain-area/bamboo-hedge',
      'saint-helena/ascension-island/green-mountain-area/dew-pond-area',
      'saint-helena/ascension-island/green-mountain-area/green-mountain',
      'saint-helena/ascension-island/green-mountain-area/weather-post-area',
      'saint-helena/ascension-island/the-residency-area',
      'saint-helena/ascension-island/the-residency-area/administrator-s-residence-area',
      'saint-helena/ascension-island/the-residency-area/the-residency',
      'saint-helena/ascension-island/traveller-s-hill-base-area',
      'saint-helena/ascension-island/traveller-s-hill-base-area/airhead-area',
      'saint-helena/ascension-island/traveller-s-hill-base-area/raf-ascension-island',
      'saint-helena/ascension-island/traveller-s-hill-base-area/traveller-s-hill',
      'saint-helena/ascension-island/traveller-s-hill-base-area/wideawake-airfield',
      'saint-helena/ascension-island/two-boats-village',
      'saint-helena/ascension-island/two-boats-village/green-mountain-road-area',
      'saint-helena/ascension-island/two-boats-village/two-boats',
      'saint-helena/ascension-island/two-boats-village/two-boats-club-area',
      'saint-helena/ascension-island/two-boats-village/two-boats-school-area',
      'saint-helena/saint-helena-island',
      'saint-helena/saint-helena-island/alarm-forest-district',
      'saint-helena/saint-helena-island/alarm-forest-district/alarm-forest',
      'saint-helena/saint-helena-island/alarm-forest-district/alarm-house-area',
      'saint-helena/saint-helena-island/alarm-forest-district/hutt-s-gate',
      'saint-helena/saint-helena-island/alarm-forest-district/rupert-s-bay',
      'saint-helena/saint-helena-island/alarm-forest-district/rupert-s-valley',
      'saint-helena/saint-helena-island/alarm-forest-district/the-briars',
      'saint-helena/saint-helena-island/blue-hill-district',
      'saint-helena/saint-helena-island/blue-hill-district/blue-hill',
      'saint-helena/saint-helena-island/blue-hill-district/blue-hill-village',
      'saint-helena/saint-helena-island/blue-hill-district/head-o-wain',
      'saint-helena/saint-helena-island/blue-hill-district/high-peak-area',
      'saint-helena/saint-helena-island/blue-hill-district/thompson-s-valley',
      'saint-helena/saint-helena-island/half-tree-hollow-district',
      'saint-helena/saint-helena-island/half-tree-hollow-district/cleugh-s-plain',
      'saint-helena/saint-helena-island/half-tree-hollow-district/half-tree-hollow',
      'saint-helena/saint-helena-island/half-tree-hollow-district/high-knoll-area',
      'saint-helena/saint-helena-island/half-tree-hollow-district/ladder-hill',
      'saint-helena/saint-helena-island/half-tree-hollow-district/new-ground',
      'saint-helena/saint-helena-island/half-tree-hollow-district/red-hill',
      'saint-helena/saint-helena-island/half-tree-hollow-district/sapper-way',
      'saint-helena/saint-helena-island/jamestown-district',
      'saint-helena/saint-helena-island/jamestown-district/grand-parade',
      'saint-helena/saint-helena-island/jamestown-district/jacob-s-ladder',
      'saint-helena/saint-helena-island/jamestown-district/james-bay',
      'saint-helena/saint-helena-island/jamestown-district/jamestown',
      'saint-helena/saint-helena-island/jamestown-district/main-street',
      'saint-helena/saint-helena-island/jamestown-district/seafront-area',
      'saint-helena/saint-helena-island/jamestown-district/the-castle-area',
      'saint-helena/saint-helena-island/jamestown-district/upper-jamestown',
      'saint-helena/saint-helena-island/levelwood-district',
      'saint-helena/saint-helena-island/levelwood-district/levelwood',
      'saint-helena/saint-helena-island/levelwood-district/levelwood-village-area',
      'saint-helena/saint-helena-island/levelwood-district/silver-hill',
      'saint-helena/saint-helena-island/levelwood-district/taglate',
      'saint-helena/saint-helena-island/levelwood-district/woody-ridge',
      'saint-helena/saint-helena-island/longwood-district',
      'saint-helena/saint-helena-island/longwood-district/bottom-woods',
      'saint-helena/saint-helena-island/longwood-district/deadwood',
      'saint-helena/saint-helena-island/longwood-district/fisher-s-valley',
      'saint-helena/saint-helena-island/longwood-district/horse-point',
      'saint-helena/saint-helena-island/longwood-district/longwood',
      'saint-helena/saint-helena-island/longwood-district/longwood-new-house-area',
      'saint-helena/saint-helena-island/longwood-district/longwood-village',
      'saint-helena/saint-helena-island/longwood-district/prosperous-bay-plain',
      'saint-helena/saint-helena-island/saint-paul-s-district',
      'saint-helena/saint-helena-island/saint-paul-s-district/francis-plain',
      'saint-helena/saint-helena-island/saint-paul-s-district/plantation-house-area',
      'saint-helena/saint-helena-island/saint-paul-s-district/rosemary-plain',
      'saint-helena/saint-helena-island/saint-paul-s-district/saint-paul-s',
      'saint-helena/saint-helena-island/saint-paul-s-district/scotland',
      'saint-helena/saint-helena-island/saint-paul-s-district/thompson-s-wood',
      'saint-helena/saint-helena-island/saint-paul-s-district/white-gate',
      'saint-helena/saint-helena-island/sandy-bay-district',
      'saint-helena/saint-helena-island/sandy-bay-district/broad-bottom',
      'saint-helena/saint-helena-island/sandy-bay-district/lot',
      'saint-helena/saint-helena-island/sandy-bay-district/mount-pleasant-area',
      'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay',
      'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay-ridge',
      'saint-helena/saint-helena-island/sandy-bay-district/sandy-bay-valley',
      'saint-helena/tristan-da-cunha-island-group',
      'saint-helena/tristan-da-cunha-island-group/gough-island',
      'saint-helena/tristan-da-cunha-island-group/gough-island/gough-island',
      'saint-helena/tristan-da-cunha-island-group/gough-island/gough-island-research-station-area',
      'saint-helena/tristan-da-cunha-island-group/inaccessible-island',
      'saint-helena/tristan-da-cunha-island-group/inaccessible-island/inaccessible-island',
      'saint-helena/tristan-da-cunha-island-group/inaccessible-island/inaccessible-island-nature-reserve',
      'saint-helena/tristan-da-cunha-island-group/nightingale-islands',
      'saint-helena/tristan-da-cunha-island-group/nightingale-islands/middle-island',
      'saint-helena/tristan-da-cunha-island-group/nightingale-islands/nightingale-island',
      'saint-helena/tristan-da-cunha-island-group/nightingale-islands/stoltenhoff-island',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/big-beach',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/calshot-harbour',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/edinburgh-of-the-seven-seas',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/little-beach',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/potato-patches',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/queen-mary-s-peak-area',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/sandy-point',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/st-joseph-s-church-area',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/st-mary-s-school-area',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/the-patches',
      'saint-helena/tristan-da-cunha-island-group/tristan-da-cunha-island/the-settlement'
    ]);
  if cnt <> 118 then
    raise exception 'SH: expected 118 locations, found %', cnt;
  end if;
end $$;

