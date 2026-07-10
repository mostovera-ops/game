-- ============================================================================
-- 0003_week.sql — Sunnyside · Weekly world (calendar, demand, fair, contests,
--                 server event, versus, foraging, mail)
-- Реализует 20-backend.md §3.2.4 (календарь), §3.2.5 (спрос), §3.2.7 (ярмарка),
--   §3.2.8 (серверный ивент), §3.2.13 (фуражинг/почта).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Календарь сервера + идемпотентность якорей (§3.2.4).
-- ---------------------------------------------------------------------------
create table if not exists public.server_calendars (
  id            uuid primary key default gen_random_uuid(),
  town_id       uuid not null references public.towns(id) on delete cascade,
  week_index    int  not null,
  week_start    timestamptz not null,           -- Пн 00:00 UTC
  phase         text not null,                  -- mon_plan|tue_produce|...|sun_event
  coop_deadline timestamptz not null,           -- Чт 23:59 UTC
  fair_open     timestamptz not null,           -- Сб 00:00 UTC
  fair_close    timestamptz not null,           -- Вс 12:00 UTC
  event_final   timestamptz not null,           -- Вс 20:00 UTC
  rollover_at   timestamptz not null,           -- Вс 23:59 UTC
  season_id     uuid references public.route_pass_seasons(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create unique index if not exists uq_server_cal on public.server_calendars(town_id, week_index);
create index        if not exists idx_server_cal_start on public.server_calendars(town_id, week_start);

create table if not exists public.processed_anchors (
  town_id       uuid not null references public.towns(id) on delete cascade,
  week_index    int  not null,
  anchor_code   text not null,   -- A0|coop_deadline|fair_open|fair_close|event_final|rollover|phase:*
  processed_at  timestamptz not null default now(),
  primary key (town_id, week_index, anchor_code)
);

-- ---------------------------------------------------------------------------
-- 2. Спрос недели (§3.2.5 / Demand Board).
-- ---------------------------------------------------------------------------
create table if not exists public.market_weeks (
  id           uuid primary key default gen_random_uuid(),
  town_id      uuid not null references public.towns(id) on delete cascade,
  week_index   int  not null,
  demand       jsonb not null,           -- {category: multiplier}, ±15–30%
  theme_key    text,
  generated_at timestamptz not null default now()
);
create unique index if not exists uq_market_weeks on public.market_weeks(town_id, week_index);

-- ---------------------------------------------------------------------------
-- 3. Ярмарка: прилавки / лоты / продажи (§3.2.7 / 09-fair.md).
-- ---------------------------------------------------------------------------
create table if not exists public.fair_stalls (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  town_id        uuid references public.towns(id),
  week_index     int  not null,
  display_slots  int  not null default 6 check (display_slots between 6 and 12),
  opened_at      timestamptz,
  stall_level    int  default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create unique index if not exists uq_fair_stalls  on public.fair_stalls(player_id, week_index);
create index        if not exists idx_fair_stalls on public.fair_stalls(town_id, week_index);

create table if not exists public.fair_lots (
  id          uuid primary key default gen_random_uuid(),
  stall_id    uuid not null references public.fair_stalls(id) on delete cascade,
  slot_index  int  not null,
  item_key    text not null,
  quality     smallint,
  qty_listed  int  not null check (qty_listed >= 0),
  qty_sold    int  not null default 0 check (qty_sold >= 0),
  price       bigint not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create unique index if not exists uq_fair_lots  on public.fair_lots(stall_id, slot_index);
create index        if not exists idx_fair_lots on public.fair_lots(stall_id);

create table if not exists public.fair_sales (
  id         bigint generated always as identity primary key,
  lot_id     uuid not null references public.fair_lots(id) on delete cascade,
  player_id  uuid not null references public.players(id),
  qty        int    not null,
  revenue    bigint not null,
  fp         bigint not null default 0,     -- Fill Points → ивент
  tick_at    timestamptz not null default now()
);
create index if not exists idx_fair_sales on public.fair_sales(player_id, tick_at);

-- ---------------------------------------------------------------------------
-- 4. Конкурсы (§3.2.7 / ct_*). Тайминг K8: голосование Сб→Вс 12:00.
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id            uuid primary key default gen_random_uuid(),
  town_id       uuid not null references public.towns(id) on delete cascade,
  week_index    int  not null,
  contest_key   text not null,             -- ct_pie_week|ct_giant_veg|ct_best_window
  entry_open    timestamptz,               -- Пн 00:00
  entry_close   timestamptz,               -- Пт 23:59
  voting_open   timestamptz,               -- Сб 00:00
  voting_close  timestamptz,               -- Вс 12:00
  announce_at   timestamptz,               -- после судейства
  state         text default 'entry' check (state in ('entry','voting','judged')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create unique index if not exists uq_contests on public.contests(town_id, week_index, contest_key);

create table if not exists public.contest_entries (
  id           uuid primary key default gen_random_uuid(),
  contest_id   uuid not null references public.contests(id) on delete cascade,
  player_id    uuid not null references public.players(id),
  payload      jsonb,                       -- {item_key, quality, mastery, metric}
  npc_score    numeric,
  vote_count   int default 0,
  final_score  numeric,
  rank         int,
  created_at   timestamptz not null default now()
);
create unique index if not exists uq_contest_entries on public.contest_entries(contest_id, player_id);

create table if not exists public.contest_votes (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests(id) on delete cascade,
  voter_id    uuid not null references public.players(id),
  entry_id    uuid not null references public.contest_entries(id) on delete cascade,
  created_at  timestamptz not null default now()
);
-- 1 голос/конкурс/игрок (античит накрутки).
create unique index if not exists uq_contest_votes on public.contest_votes(contest_id, voter_id);

-- ---------------------------------------------------------------------------
-- 5. Серверный ивент: Appetite Meter, вклады, вехи, лиги, versus (§3.2.8).
-- ---------------------------------------------------------------------------
create table if not exists public.event_weeks (
  id           uuid primary key default gen_random_uuid(),
  town_id      uuid not null references public.towns(id) on delete cascade,
  week_index   int  not null,
  theme_key    text not null,               -- ev_glutton|ev_big_festival|...
  meter_fp     bigint not null default 0,
  goal_100     bigint not null,
  phase_state  jsonb,
  settled      bool not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create unique index if not exists uq_event_weeks on public.event_weeks(town_id, week_index);

create table if not exists public.event_contributions (
  id             bigint generated always as identity primary key,
  event_week_id  uuid not null references public.event_weeks(id) on delete cascade,
  player_id      uuid not null references public.players(id),
  channel        text check (channel in ('passive_sell','contrib_donate')),
  fp             bigint not null,
  category       text,
  at             timestamptz not null default now()
);
create index if not exists idx_event_contrib_week   on public.event_contributions(event_week_id, player_id);
create index if not exists idx_event_contrib_player on public.event_contributions(player_id, at);

create table if not exists public.event_milestones_claimed (
  event_week_id  uuid not null references public.event_weeks(id) on delete cascade,
  milestone_key  text not null,             -- ms_25|ms_50|ms_75|ms_100|ms_125|ms_150
  player_id      uuid not null references public.players(id) on delete cascade,
  reward_key     text,
  claimed_at     timestamptz not null default now(),
  primary key (event_week_id, milestone_key, player_id)
);

create table if not exists public.personal_contributions (
  id             uuid primary key default gen_random_uuid(),
  event_week_id  uuid not null references public.event_weeks(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  personal_fp    bigint not null default 0,
  chests_claimed jsonb default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create unique index if not exists uq_personal_contrib on public.personal_contributions(event_week_id, player_id);

create table if not exists public.event_leagues (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  season_id     uuid not null references public.route_pass_seasons(id),
  league_score  bigint not null default 0,
  division      text,                        -- sprout|...
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create unique index if not exists uq_event_leagues on public.event_leagues(player_id, season_id);

create table if not exists public.versus_matches (
  id          uuid primary key default gen_random_uuid(),
  week_index  int not null,
  town_a      uuid references public.towns(id),
  town_b      uuid references public.towns(id),
  score_a     bigint default 0,
  score_b     bigint default 0,
  outcome     text default 'pending' check (outcome in ('a','b','tie','pending')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index if not exists idx_versus_towns on public.versus_matches(town_a, town_b);

-- ---------------------------------------------------------------------------
-- 6. Фуражинг (§3.2.13 / 08-mail-foraging.md).
-- ---------------------------------------------------------------------------
create table if not exists public.foraging_points (
  id             uuid primary key default gen_random_uuid(),
  town_id        uuid not null references public.towns(id) on delete cascade,
  point_type     text not null,             -- mushroom|berry|fishing|wild_beehive
  pool_remaining int  not null check (pool_remaining >= 0),
  pool_max       int  not null,
  respawn_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create unique index if not exists uq_foraging_points on public.foraging_points(town_id, point_type);

create table if not exists public.forage_daily (
  player_id   uuid not null references public.players(id) on delete cascade,
  point_type  text not null,
  game_day    date not null,
  count       int  not null default 0,
  primary key (player_id, point_type, game_day)
);

-- ---------------------------------------------------------------------------
-- 7. Почта: недельный каталог + заказы игрока (§3.2.13).
-- ---------------------------------------------------------------------------
create table if not exists public.mail_catalog_weeks (
  id          uuid primary key default gen_random_uuid(),
  town_id     uuid not null references public.towns(id) on delete cascade,
  week_index  int  not null,
  items       jsonb not null,               -- [{item_key, price, stock, rarity}]
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_mail_catalog on public.mail_catalog_weeks(town_id, week_index);

create table if not exists public.mail_orders (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  item_key    text not null,
  ordered_at  timestamptz not null default now(),
  deliver_at  timestamptz not null,         -- +8–20 ч (скип за ◉ кэп 5, R3-исключение)
  delivered   bool default false,
  collected   bool default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mail_orders_collect on public.mail_orders(player_id, collected);
create index if not exists idx_mail_orders_deliver on public.mail_orders(deliver_at);

-- ---------------------------------------------------------------------------
-- 8. updated_at триггеры.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'public.server_calendars','public.fair_stalls','public.fair_lots','public.contests',
    'public.event_weeks','public.personal_contributions','public.event_leagues',
    'public.versus_matches','public.foraging_points'
  ] loop
    perform public.attach_updated_at(t::regclass);
  end loop;
end $$;
