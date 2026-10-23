-- ============================================================================
-- BHA location hierarchy seed: São Tomé and Príncipe (ST)
-- Source: "Africa Location Hierarchies - Universal Review" - São Tomé and Príncipe
-- 129 locations beyond the country root. Idempotent: re-running refreshes.
-- Prerequisite: supabase/migrations/004_location_hierarchy.sql
-- ============================================================================

-- 0. Country row (adds any territory missing from the base schema seed)
insert into public.countries (code, name) values
  ('ST', 'São Tomé and Príncipe')
on conflict (code) do update set name = excluded.name;

-- 1. Country root (level 1)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'ST', null, 'São Tomé and Príncipe', 'Country', 1, 'sao-tome-and-principe', 0
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level;

-- 2. Level 2 (2 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'ST', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('sao-tome-and-principe', 'São Tomé Island', 'Island', 2, 'sao-tome-and-principe/sao-tome-island', 0),
    ('sao-tome-and-principe', 'Príncipe Autonomous Region', 'Autonomous Region / Island', 2, 'sao-tome-and-principe/principe-autonomous-region', 1)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'ST' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- 3. Level 3 (7 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'ST', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('sao-tome-and-principe/sao-tome-island', 'Água Grande District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/agua-grande-district', 0),
    ('sao-tome-and-principe/sao-tome-island', 'Cantagalo District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/cantagalo-district', 1),
    ('sao-tome-and-principe/sao-tome-island', 'Caué District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/caue-district', 2),
    ('sao-tome-and-principe/sao-tome-island', 'Lembá District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/lemba-district', 3),
    ('sao-tome-and-principe/sao-tome-island', 'Lobata District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/lobata-district', 4),
    ('sao-tome-and-principe/sao-tome-island', 'Mé-Zóchi District', 'District', 3, 'sao-tome-and-principe/sao-tome-island/me-zochi-district', 5),
    ('sao-tome-and-principe/principe-autonomous-region', 'Pagué District', 'District', 3, 'sao-tome-and-principe/principe-autonomous-region/pague-district', 6)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'ST' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- 4. Level 4 (120 rows)
insert into public.locations (country_code, parent_id, name, location_type, level, path, sort_order)
select 'ST', p.id, v.name, v.location_type, v.level, v.path, v.sort_order
from (values
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'São Tomé', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-tome', 0),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'São Tomé City Centre', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-tome-city-centre', 1),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Bairro Boa Vista', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-boa-vista', 2),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Bairro dos Casados', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-dos-casados', 3),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Bairro do Hospital', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-do-hospital', 4),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Bairro Militar', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-militar', 5),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Chácara', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/chacara', 6),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Pantufo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/pantufo', 7),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Água Grande', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/agua-grande', 8),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Riboque', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/riboque', 9),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Riboque Santana', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/riboque-santana', 10),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Quinta de Santo António', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/quinta-de-santo-antonio', 11),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Uba Budo Praia', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/uba-budo-praia', 12),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Praia Lagarto', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/praia-lagarto', 13),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Ana Chaves Bay', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/ana-chaves-bay', 14),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'São Sebastião Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-sebastiao-area', 15),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Mercado Municipal Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/mercado-municipal-area', 16),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Porto de São Tomé', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/porto-de-sao-tome', 17),
    ('sao-tome-and-principe/sao-tome-island/agua-grande-district', 'Airport Road Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/agua-grande-district/airport-road-area', 18),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Santana', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/santana', 19),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Ribeira Afonso', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/ribeira-afonso', 20),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Agua Izé', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/agua-ize', 21),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Bela Vista', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/bela-vista', 22),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Claudino Faro', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/claudino-faro', 23),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Micondó', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/micondo', 24),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Porto Alegre Cantagalo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/porto-alegre-cantagalo', 25),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Praia Melão', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/praia-melao', 26),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Praia Messias Alves', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/praia-messias-alves', 27),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Ribeira Peixe', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/ribeira-peixe', 28),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Trindade Cantagalo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/trindade-cantagalo', 29),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Uba Budo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/uba-budo', 30),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Nova Olinda', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/nova-olinda', 31),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Café São João', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/cafe-sao-joao', 32),
    ('sao-tome-and-principe/sao-tome-island/cantagalo-district', 'Caué Road Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/cantagalo-district/caue-road-area', 33),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'São João dos Angolares', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/sao-joao-dos-angolares', 34),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Porto Alegre', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/porto-alegre', 35),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Ribeira Peixe', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/ribeira-peixe', 36),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Ilhéu das Rolas', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/ilheu-das-rolas', 37),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Monte Mário', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/monte-mario', 38),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Dona Augusta', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/dona-augusta', 39),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Angra Toldo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/angra-toldo', 40),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'São Miguel', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/sao-miguel', 41),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Malanza', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/malanza', 42),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Praia Piscina', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/praia-piscina', 43),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Praia Jalé', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/praia-jale', 44),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Praia Inhame', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/praia-inhame', 45),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Porto Alegre Beach Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/porto-alegre-beach-area', 46),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Angolares Market Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/angolares-market-area', 47),
    ('sao-tome-and-principe/sao-tome-island/caue-district', 'Obô Natural Park South Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/caue-district/obo-natural-park-south-area', 48),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Neves', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/neves', 49),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Santa Catarina', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/santa-catarina', 50),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Ponta Figo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/ponta-figo', 51),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Diogo Vaz', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/diogo-vaz', 52),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Generosa', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/generosa', 53),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Ribeira Funda', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/ribeira-funda', 54),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Praia das Conchas', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/praia-das-conchas', 55),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Anambó', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/anambo', 56),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Morro Peixe', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/morro-peixe', 57),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Rosema Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/rosema-area', 58),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Lembá Coast Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/lemba-coast-area', 59),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'São Miguel Lembá', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/sao-miguel-lemba', 60),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Guadalupe Road Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/guadalupe-road-area', 61),
    ('sao-tome-and-principe/sao-tome-island/lemba-district', 'Monte Forte', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lemba-district/monte-forte', 62),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Guadalupe', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/guadalupe', 63),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Conde', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/conde', 64),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Agostinho Neto', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/agostinho-neto', 65),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Praia das Conchas Lobata', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/praia-das-conchas-lobata', 66),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Micoló', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/micolo', 67),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Morro Peixe Lobata', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/morro-peixe-lobata', 68),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Desejada', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/desejada', 69),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Ferreira Governo', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/ferreira-governo', 70),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Boa Entrada', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/boa-entrada', 71),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Santo Amaro', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/santo-amaro', 72),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Diogo Nunes', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/diogo-nunes', 73),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Lobata Centre', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/lobata-centre', 74),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Blue Lagoon Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/blue-lagoon-area', 75),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Praia dos Tamarindos', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/praia-dos-tamarindos', 76),
    ('sao-tome-and-principe/sao-tome-island/lobata-district', 'Airport North Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/lobata-district/airport-north-area', 77),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Trindade', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/trindade', 78),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Madalena', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/madalena', 79),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Batepá', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/batepa', 80),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Bombom', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/bombom', 81),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Caixão Grande', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/caixao-grande', 82),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Milagrosa', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/milagrosa', 83),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Santa Margarida', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/santa-margarida', 84),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Monte Café', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/monte-cafe', 85),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Cruzeiro', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/cruzeiro', 86),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'São Marçal', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/sao-marcal', 87),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Almeirim', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/almeirim', 88),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Piedade', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/piedade', 89),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Água Sampaio', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/agua-sampaio', 90),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Boa Morte', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/boa-morte', 91),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Bemposta', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/bemposta', 92),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Me-Zochi Centre', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/me-zochi-centre', 93),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Nova Moca', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/nova-moca', 94),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Roça Monte Café', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/roca-monte-cafe', 95),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Roça Saudade', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/roca-saudade', 96),
    ('sao-tome-and-principe/sao-tome-island/me-zochi-district', 'Trindade Market Area', 'City/Town/Area', 4, 'sao-tome-and-principe/sao-tome-island/me-zochi-district/trindade-market-area', 97),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Santo António', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/santo-antonio', 98),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Santo António Centre', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/santo-antonio-centre', 99),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Belo Monte', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/belo-monte', 100),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Bombom Island', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/bombom-island', 101),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Abade', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/abade', 102),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Picão', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/picao', 103),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Porto Real', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/porto-real', 104),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Sundy', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/sundy', 105),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Terreiro Velho', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/terreiro-velho', 106),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Nova Estrela', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/nova-estrela', 107),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Paciência', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/paciencia', 108),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Praia Banana', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-banana', 109),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Praia Boi', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-boi', 110),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Praia Grande', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-grande', 111),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Praia Burra', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-burra', 112),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Praia Campanha', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-campanha', 113),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Príncipe Airport Area', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/principe-airport-area', 114),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Roça Sundy', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/roca-sundy', 115),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Roça Belo Monte', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/roca-belo-monte', 116),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Ilhéu Bom Bom', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/ilheu-bom-bom', 117),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Príncipe Port Area', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/principe-port-area', 118),
    ('sao-tome-and-principe/principe-autonomous-region/pague-district', 'Obô Natural Park Príncipe Area', 'City/Town/Area', 4, 'sao-tome-and-principe/principe-autonomous-region/pague-district/obo-natural-park-principe-area', 119)
) as v(parent_path, name, location_type, level, path, sort_order)
join public.locations p
  on p.country_code = 'ST' and p.path = v.parent_path
on conflict (country_code, path) do update set
  name = excluded.name, location_type = excluded.location_type, level = excluded.level,
  sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- Verify: this file owns exactly 130 rows for ST. The assertion counts only
-- rows whose path is declared in this file, so a correct re-run still passes even when
-- other rows exist for ST.
do $$
declare cnt integer;
begin
  select count(*) into cnt
  from public.locations
  where country_code = 'ST'
    and path = any (array[
      'sao-tome-and-principe',
      'sao-tome-and-principe/principe-autonomous-region',
      'sao-tome-and-principe/principe-autonomous-region/pague-district',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/abade',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/belo-monte',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/bombom-island',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/ilheu-bom-bom',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/nova-estrela',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/obo-natural-park-principe-area',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/paciencia',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/picao',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/porto-real',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-banana',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-boi',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-burra',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-campanha',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/praia-grande',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/principe-airport-area',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/principe-port-area',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/roca-belo-monte',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/roca-sundy',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/santo-antonio',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/santo-antonio-centre',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/sundy',
      'sao-tome-and-principe/principe-autonomous-region/pague-district/terreiro-velho',
      'sao-tome-and-principe/sao-tome-island',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/agua-grande',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/airport-road-area',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/ana-chaves-bay',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-boa-vista',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-do-hospital',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-dos-casados',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/bairro-militar',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/chacara',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/mercado-municipal-area',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/pantufo',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/porto-de-sao-tome',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/praia-lagarto',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/quinta-de-santo-antonio',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/riboque',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/riboque-santana',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-sebastiao-area',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-tome',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/sao-tome-city-centre',
      'sao-tome-and-principe/sao-tome-island/agua-grande-district/uba-budo-praia',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/agua-ize',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/bela-vista',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/cafe-sao-joao',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/caue-road-area',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/claudino-faro',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/micondo',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/nova-olinda',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/porto-alegre-cantagalo',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/praia-melao',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/praia-messias-alves',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/ribeira-afonso',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/ribeira-peixe',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/santana',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/trindade-cantagalo',
      'sao-tome-and-principe/sao-tome-island/cantagalo-district/uba-budo',
      'sao-tome-and-principe/sao-tome-island/caue-district',
      'sao-tome-and-principe/sao-tome-island/caue-district/angolares-market-area',
      'sao-tome-and-principe/sao-tome-island/caue-district/angra-toldo',
      'sao-tome-and-principe/sao-tome-island/caue-district/dona-augusta',
      'sao-tome-and-principe/sao-tome-island/caue-district/ilheu-das-rolas',
      'sao-tome-and-principe/sao-tome-island/caue-district/malanza',
      'sao-tome-and-principe/sao-tome-island/caue-district/monte-mario',
      'sao-tome-and-principe/sao-tome-island/caue-district/obo-natural-park-south-area',
      'sao-tome-and-principe/sao-tome-island/caue-district/porto-alegre',
      'sao-tome-and-principe/sao-tome-island/caue-district/porto-alegre-beach-area',
      'sao-tome-and-principe/sao-tome-island/caue-district/praia-inhame',
      'sao-tome-and-principe/sao-tome-island/caue-district/praia-jale',
      'sao-tome-and-principe/sao-tome-island/caue-district/praia-piscina',
      'sao-tome-and-principe/sao-tome-island/caue-district/ribeira-peixe',
      'sao-tome-and-principe/sao-tome-island/caue-district/sao-joao-dos-angolares',
      'sao-tome-and-principe/sao-tome-island/caue-district/sao-miguel',
      'sao-tome-and-principe/sao-tome-island/lemba-district',
      'sao-tome-and-principe/sao-tome-island/lemba-district/anambo',
      'sao-tome-and-principe/sao-tome-island/lemba-district/diogo-vaz',
      'sao-tome-and-principe/sao-tome-island/lemba-district/generosa',
      'sao-tome-and-principe/sao-tome-island/lemba-district/guadalupe-road-area',
      'sao-tome-and-principe/sao-tome-island/lemba-district/lemba-coast-area',
      'sao-tome-and-principe/sao-tome-island/lemba-district/monte-forte',
      'sao-tome-and-principe/sao-tome-island/lemba-district/morro-peixe',
      'sao-tome-and-principe/sao-tome-island/lemba-district/neves',
      'sao-tome-and-principe/sao-tome-island/lemba-district/ponta-figo',
      'sao-tome-and-principe/sao-tome-island/lemba-district/praia-das-conchas',
      'sao-tome-and-principe/sao-tome-island/lemba-district/ribeira-funda',
      'sao-tome-and-principe/sao-tome-island/lemba-district/rosema-area',
      'sao-tome-and-principe/sao-tome-island/lemba-district/santa-catarina',
      'sao-tome-and-principe/sao-tome-island/lemba-district/sao-miguel-lemba',
      'sao-tome-and-principe/sao-tome-island/lobata-district',
      'sao-tome-and-principe/sao-tome-island/lobata-district/agostinho-neto',
      'sao-tome-and-principe/sao-tome-island/lobata-district/airport-north-area',
      'sao-tome-and-principe/sao-tome-island/lobata-district/blue-lagoon-area',
      'sao-tome-and-principe/sao-tome-island/lobata-district/boa-entrada',
      'sao-tome-and-principe/sao-tome-island/lobata-district/conde',
      'sao-tome-and-principe/sao-tome-island/lobata-district/desejada',
      'sao-tome-and-principe/sao-tome-island/lobata-district/diogo-nunes',
      'sao-tome-and-principe/sao-tome-island/lobata-district/ferreira-governo',
      'sao-tome-and-principe/sao-tome-island/lobata-district/guadalupe',
      'sao-tome-and-principe/sao-tome-island/lobata-district/lobata-centre',
      'sao-tome-and-principe/sao-tome-island/lobata-district/micolo',
      'sao-tome-and-principe/sao-tome-island/lobata-district/morro-peixe-lobata',
      'sao-tome-and-principe/sao-tome-island/lobata-district/praia-das-conchas-lobata',
      'sao-tome-and-principe/sao-tome-island/lobata-district/praia-dos-tamarindos',
      'sao-tome-and-principe/sao-tome-island/lobata-district/santo-amaro',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/agua-sampaio',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/almeirim',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/batepa',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/bemposta',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/boa-morte',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/bombom',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/caixao-grande',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/cruzeiro',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/madalena',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/me-zochi-centre',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/milagrosa',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/monte-cafe',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/nova-moca',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/piedade',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/roca-monte-cafe',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/roca-saudade',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/santa-margarida',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/sao-marcal',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/trindade',
      'sao-tome-and-principe/sao-tome-island/me-zochi-district/trindade-market-area'
    ]);
  if cnt <> 130 then
    raise exception 'ST: expected 130 locations, found %', cnt;
  end if;
end $$;

