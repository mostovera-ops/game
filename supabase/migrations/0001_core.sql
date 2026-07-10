-- ============================================================================
-- 0001_core.sql — Sunnyside · Core domain (identity, social graph, farm)
-- Реализует 20-backend.md §3.1 (расширения, конвенции), §3.2.1 (идентичность),
-- §3.2.2 (ферма/производство), §3.2.12 (животные), §3.2.3 (экспедиции).
-- Server-authoritative: клиент НИКОГДА не пишет напрямую (RLS в 0005).
-- Идемпотентно: CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DO-гарды.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Расширения (20-backend §3.1) — включаются первой миграцией.
-- ---------------------------------------------------------------------------
create schema if not exists extensions;

create extension if not exists pgcrypto            with schema extensions;  -- gen_random_uuid, hashes
create extension if not exists "uuid-ossp"         with schema extensions;  -- fallback UUID
create extension if not exists pg_stat_statements;                          -- профилирование
-- pg_cron / pg_net включаются платформой Supabase (планировщик §3.6); при
-- наличии прав — раскомментировать. Схема самодостаточна без них.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable (ok for local): %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net unavailable (ok for local): %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Общий триггер updated_at (20-backend §3.2 конвенции).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Хелпер: навесить set_updated_at на таблицу идемпотентно.
create or replace function public.attach_updated_at(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_name text := 'set_updated_at_' || (select relname from pg_class where oid = p_table);
begin
  execute format('drop trigger if exists %I on %s', v_name, p_table);
  execute format(
    'create trigger %I before update on %s for each row execute function public.set_updated_at()',
    v_name, p_table);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Инфраструктура конфигов (20-backend §3.2.11 / §3.8) — нужна раньше FK.
-- ---------------------------------------------------------------------------
create table if not exists public.config_versions (
  id            uuid primary key default gen_random_uuid(),
  label         text,
  state         text not null default 'draft'
                  check (state in ('draft','active','retired')),
  activated_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create table if not exists public.game_configs (
  id          uuid primary key default gen_random_uuid(),
  namespace   text not null,   -- crops|recipes|prices|timers|demand|event|route_pass|prize_machine|drops|staff|...
  version_id  uuid not null references public.config_versions(id) on delete cascade,
  doc         jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  unique (namespace, version_id)
);
create index if not exists idx_game_configs_version on public.game_configs(version_id);

-- ---------------------------------------------------------------------------
-- 3. Сезоны Route Pass (20-backend §3.2.10) — 8 недель (R7). Ссылается
--    server_calendars (0003) и event_leagues (0003), поэтому создаём в core.
-- ---------------------------------------------------------------------------
create table if not exists public.route_pass_seasons (
  id            uuid primary key default gen_random_uuid(),
  season_index  int not null unique,
  theme_key     text,
  start_week    int not null,
  end_week      int not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Города / стриты / игроки / фермы (20-backend §3.2.1).
-- ---------------------------------------------------------------------------
create table if not exists public.towns (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  region_tag                text,
  capacity                  int  not null default 200,
  dau_7d                    int  default 0,
  current_week_index        int  not null default 0,
  active_config_version_id  uuid references public.config_versions(id),
  status                    text default 'open'
                              check (status in ('open','full','merging','archived')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz
);

create table if not exists public.streets (
  id            uuid primary key default gen_random_uuid(),
  town_id       uuid not null references public.towns(id) on delete cascade,
  name_key      text not null,
  capacity      int  not null default 20,
  founder_id    uuid,   -- FK→players добавляется после players (циклическая ссылка)
  street_score  bigint default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index if not exists idx_streets_town on public.streets(town_id);

create table if not exists public.players (
  id                uuid primary key references auth.users(id) on delete cascade,
  handle            text not null unique,
  town_id           uuid references public.towns(id)   on delete set null,
  street_id         uuid references public.streets(id) on delete set null,
  created_week      int  not null default 0,
  farm_value        bigint not null default 0,
  farm_level        int  not null default 1 check (farm_level between 1 and 60),
  xp                bigint not null default 0,
  locale            text not null default 'ru',
  tz_offset_min     int  default 0,
  last_seen_at      timestamptz,
  vacation_until    timestamptz,
  last_migrated_at  timestamptz,   -- кулдаун 2 недели (mech_moving_truck); скип за ◉ невозможен (12-O1)
  town_joined_at    timestamptz,   -- мин. 3 дня до нового переезда
  status            text not null default 'active'
                      check (status in ('active','vacation','merging','banned')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);
create index if not exists idx_players_town        on public.players(town_id);
create index if not exists idx_players_street      on public.players(street_id);
create index if not exists idx_players_town_seen   on public.players(town_id, last_seen_at);
create index if not exists idx_players_farm_value  on public.players(farm_value);

-- Замкнуть циклическую ссылку streets.founder_id → players.id.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'streets_founder_id_fkey'
  ) then
    alter table public.streets
      add constraint streets_founder_id_fkey
      foreign key (founder_id) references public.players(id) on delete set null;
  end if;
end $$;

create table if not exists public.street_members (
  id         uuid primary key default gen_random_uuid(),
  street_id  uuid not null references public.streets(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  role       text default 'member' check (role in ('founder','officer','member')),
  joined_at  timestamptz not null default now()
);
create unique index if not exists uq_street_members_player on public.street_members(player_id);
create index        if not exists idx_street_members_street on public.street_members(street_id);

create table if not exists public.farms (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null unique references public.players(id) on delete cascade,
  town_id              uuid references public.towns(id),
  layout               jsonb not null default '{}'::jsonb,
  grand_opening_until  timestamptz,
  config_version_id    uuid references public.config_versions(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);
create index if not exists idx_farms_town   on public.farms(town_id);
create index if not exists idx_farms_player on public.farms(player_id);

-- ---------------------------------------------------------------------------
-- 5. Производство: грядки / постройки / станки / склад / рецепты (§3.2.2).
-- ---------------------------------------------------------------------------
create table if not exists public.plots (
  id             uuid primary key default gen_random_uuid(),
  farm_id        uuid not null references public.farms(id) on delete cascade,
  slot_index     int  not null,
  crop_key       text,
  planted_at     timestamptz,
  ready_at       timestamptz,
  quality        smallint check (quality between 1 and 5),
  state          text not null default 'empty'
                   check (state in ('empty','growing','ready','withered_none')),
  watered_until  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create unique index if not exists uq_plots_slot     on public.plots(farm_id, slot_index);
create index        if not exists idx_plots_state   on public.plots(farm_id, state);
create index        if not exists idx_plots_ready   on public.plots(ready_at);

create table if not exists public.buildings (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  building_key      text not null,
  level             int  not null default 1 check (level between 1 and 10),
  upgrade_ready_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);
create unique index if not exists uq_buildings_key on public.buildings(farm_id, building_key);

create table if not exists public.machines (
  id           uuid primary key default gen_random_uuid(),
  farm_id      uuid not null references public.farms(id) on delete cascade,
  machine_key  text not null,
  slots        int  not null default 1 check (slots >= 1),
  level        int  default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create index if not exists idx_machines_farm on public.machines(farm_id);

create table if not exists public.machine_jobs (
  id              uuid primary key default gen_random_uuid(),
  machine_id      uuid not null references public.machines(id) on delete cascade,
  farm_id         uuid not null references public.farms(id) on delete cascade,
  recipe_key      text not null,
  batch_size      int  not null default 1 check (batch_size >= 1),
  started_at      timestamptz not null default now(),
  ready_at        timestamptz not null,
  collected       bool not null default false,
  input_snapshot  jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_machine_jobs_collect on public.machine_jobs(farm_id, collected);
create index if not exists idx_machine_jobs_ready   on public.machine_jobs(ready_at);
create index if not exists idx_machine_jobs_machine on public.machine_jobs(machine_id);

create table if not exists public.inventory (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  item_key    text not null,
  item_class  text not null check (item_class in ('crop','dish','seed','consumable','decor','token')),
  qty         int  not null default 0 check (qty >= 0),
  quality     smallint not null default 0,   -- sentinel 0 = «без качества»/N/A (не nullable — анти-дюп стека)
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create unique index if not exists uq_inventory_stack on public.inventory(farm_id, item_key, quality);
create index        if not exists idx_inventory_class on public.inventory(farm_id, item_class);

create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  recipe_key   text not null,
  source       text check (source in ('base','state','secret','narrative')),
  unlocked_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create unique index if not exists uq_recipes_player on public.recipes(player_id, recipe_key);

create table if not exists public.recipes_mastery (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  recipe_key  text not null,
  stars       smallint not null default 0 check (stars between 0 and 5),
  progress    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create unique index if not exists uq_recipes_mastery on public.recipes_mastery(player_id, recipe_key);

-- ---------------------------------------------------------------------------
-- 6. Животные (20-backend §3.2.12 / 03-animals.md).
-- ---------------------------------------------------------------------------
create table if not exists public.animals (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  species           text not null,
  pet_name          text,
  housing_key       text not null,   -- bld_barn|bld_coop|bld_apiary
  housing_level     int  not null default 1 check (housing_level between 1 and 10),
  affection         int  not null default 0,
  fed_at            timestamptz,
  product_ready_at  timestamptz,
  product_key       text,
  quality           smallint not null default 1,
  state             text not null default 'idle'
                      check (state in ('idle','hungry','producing','ready','sleepy_pen')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);
create index if not exists idx_animals_state on public.animals(farm_id, state);
create index if not exists idx_animals_ready on public.animals(product_ready_at);
create unique index if not exists uq_animals_petname
  on public.animals(farm_id, pet_name) where pet_name is not null;

create table if not exists public.holding_pen (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id)    on delete cascade,
  animal_id  uuid not null unique references public.animals(id) on delete cascade,
  since      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Экспедиции (20-backend §3.2.3 / 07-expeditions.md).
-- ---------------------------------------------------------------------------
create table if not exists public.expeditions (
  id           uuid primary key default gen_random_uuid(),
  farm_id      uuid not null references public.farms(id) on delete cascade,
  state_key    text not null,
  route_slot   int,
  departed_at  timestamptz not null default now(),
  return_at    timestamptz not null,
  payload      jsonb,
  collected    bool not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_expeditions_collect on public.expeditions(farm_id, collected);
create index if not exists idx_expeditions_return  on public.expeditions(return_at);

-- ---------------------------------------------------------------------------
-- 8. Навесить updated_at на мутабельные таблицы.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'public.config_versions','public.game_configs','public.towns','public.streets',
    'public.players','public.farms','public.plots','public.buildings','public.machines',
    'public.inventory','public.recipes_mastery','public.animals'
  ] loop
    perform public.attach_updated_at(t::regclass);
  end loop;
end $$;
