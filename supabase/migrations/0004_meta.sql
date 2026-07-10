-- ============================================================================
-- 0004_meta.sql — Sunnyside · Meta (progression, collections, monetization,
--                 retention, currency ledger, infra/telemetry)
-- Реализует 20-backend.md §3.2.3 (прогрессия), §3.2.9 (коллекции/престиж),
--   §3.2.10 (монетизация), §3.2.11 (валюты/античит/аудит),
--   §3.2.14 (стрик/спецблюда/ачивки/декор), §3.2.15 (онбординг/win-back).
-- Валют РОВНО 4 (канон §2.1, K11). Служебные счётчики — state, не леджер.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Прогрессия: стафф / know-how / служебные счётчики (§3.2.3).
-- ---------------------------------------------------------------------------
create table if not exists public.staff_roster (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  staff_key  text not null,
  level      int  not null default 1,
  hired_at   timestamptz not null default now()
);
create unique index if not exists uq_staff_roster on public.staff_roster(player_id, staff_key);

create table if not exists public.staff_assignments (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  staff_key    text not null,
  post         text not null check (post in ('kitchen','field','counter','yard')),
  assigned_at  timestamptz not null default now()
);
create unique index if not exists uq_staff_assign on public.staff_assignments(player_id, post);
create index        if not exists idx_staff_assign_player on public.staff_assignments(player_id);

create table if not exists public.know_how_nodes (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.players(id) on delete cascade,
  branch             text not null check (branch in ('kh_agronomy','kh_cookery','kh_commerce','kh_civics')),
  node_key           text not null,
  state              text default 'researching' check (state in ('researching','done')),
  research_ready_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);
create unique index if not exists uq_know_how_nodes on public.know_how_nodes(player_id, node_key);

-- Know-How Points — НЕ валюта (K11), а состояние игрока.
create table if not exists public.player_know_how (
  player_id     uuid primary key references public.players(id) on delete cascade,
  points        bigint not null default 0,
  active_slots  int    not null default 1,
  spent_points  bigint not null default 0,
  updated_at    timestamptz
);

-- Технические счётчики (staff_tokens, scrap) — state, не валюты (K11).
create table if not exists public.player_state_counters (
  player_id     uuid primary key references public.players(id) on delete cascade,
  staff_tokens  bigint not null default 0,
  scrap         bigint not null default 0,   -- ⚙ скрап дублей Prize Machine
  updated_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. Коллекции и престиж (§3.2.9 / 17-collections.md).
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  collection_key  text not null,
  items           jsonb,                     -- {item_key: owned/count}
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create unique index if not exists uq_collections on public.collections(player_id, collection_key);

create table if not exists public.toys (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  toy_key     text not null,
  series_key  text,                          -- toy_cosmos_57|...
  rarity      text check (rarity in ('common','rare','chase')),
  count       int  not null default 1,       -- дубли → скрап
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create unique index if not exists uq_toys on public.toys(player_id, toy_key);

create table if not exists public.ribbons_wall (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  contest_key  text not null,
  week_index   int  not null,
  ribbon_type  text,                          -- blue|...
  awarded_at   timestamptz not null default now()
);
create index if not exists idx_ribbons_player on public.ribbons_wall(player_id);

create table if not exists public.postcards (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  postcard_key  text not null,               -- штат/ивент
  region        text,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_postcards on public.postcards(player_id, postcard_key);

create table if not exists public.farm_value_snapshots (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  farm_value  bigint not null,
  week_index  int not null,
  breakdown   jsonb,                          -- вклад 4 осей + коллекций
  created_at  timestamptz not null default now()
);
create index if not exists idx_fv_snapshots on public.farm_value_snapshots(player_id, week_index);

create table if not exists public.player_achievements (
  player_id    uuid not null references public.players(id) on delete cascade,
  ach_key      text not null,
  unlocked_at  timestamptz not null default now(),
  primary key (player_id, ach_key)
);

create table if not exists public.player_decor (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  decor_key  text not null,
  slot       text,                            -- интерьер|двор|фасад
  placed     bool default false,
  layout     jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index if not exists uq_player_decor on public.player_decor(player_id, decor_key);

create table if not exists public.player_neon_sign (
  player_id  uuid primary key references public.players(id) on delete cascade,
  config     jsonb,                           -- сегменты/цвета/анимация
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 3. Монетизация (§3.2.10 / 15-monetization.md).
-- ---------------------------------------------------------------------------
-- route_pass_seasons — в 0001 (нужна server_calendars/event_leagues раньше).
create table if not exists public.route_pass_progress (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  season_id       uuid not null references public.route_pass_seasons(id),
  miles           bigint default 0,           -- Route Miles — state, не валюта (K11)
  level           int  default 0 check (level between 0 and 50),
  premium         bool default false,
  claimed_levels  jsonb default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create unique index if not exists uq_route_pass_progress on public.route_pass_progress(player_id, season_id);

create table if not exists public.prize_series_pity (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.players(id) on delete cascade,
  series_key        text not null,
  pulls_since_rare  int default 0,            -- гарантия Rare ≤10
  pulls_since_chase int default 0,            -- гарантия Chase ≤40
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);
create unique index if not exists uq_prize_pity on public.prize_series_pity(player_id, series_key);

create table if not exists public.prize_pulls (
  id             bigint generated always as identity primary key,
  player_id      uuid not null references public.players(id) on delete cascade,
  series_key     text not null,
  result_toy_key text,
  rarity         text,
  cost_dimes     int default 0,               -- 0 для дневного фри-пулла
  was_pity       bool default false,
  at             timestamptz not null default now()
);
create index if not exists idx_prize_pulls on public.prize_pulls(player_id, at);

create table if not exists public.regulars_club (
  player_id    uuid primary key references public.players(id) on delete cascade,
  club_points  bigint not null default 0,     -- от стриков/активности, НЕ от спенда
  tier         int    not null default 0,
  updated_at   timestamptz
);

create table if not exists public.boosters_daily (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  booster_key text not null,
  game_day    date not null,
  used        int  not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_boosters_daily on public.boosters_daily(player_id, booster_key, game_day);

create table if not exists public.purchases (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  sku             text not null,
  provider        text check (provider in ('stripe','apple','google','paddle')),
  provider_txn_id text not null,
  dimes_granted   bigint,
  amount_cents    bigint,
  currency_iso    text,
  state           text default 'pending' check (state in ('pending','verified','granted','refunded')),
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
-- Жёсткий дедуп квитанции (античит дюпа покупок).
create unique index if not exists uq_purchases_txn on public.purchases(provider, provider_txn_id);

-- ---------------------------------------------------------------------------
-- 4. Удержание: стрик / спецблюда / онбординг / win-back (§3.2.14–15).
-- ---------------------------------------------------------------------------
create table if not exists public.player_streaks (
  player_id           uuid primary key references public.players(id) on delete cascade,
  streak_days         int  not null default 0,
  best_streak         int  not null default 0,
  state               text not null default 'active' check (state in ('active','frozen','broken')),
  last_credited_day   date,
  freezes_this_month  int  not null default 0,    -- 2 бесплатные заморозки/мес
  insured_until       timestamptz,                -- страховка за 🎟
  updated_at          timestamptz
);

create table if not exists public.daily_specials (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  game_day        date not null,
  template_key    text not null,
  focus           text,
  target          int not null default 1,
  progress        int not null default 0,
  done            bool not null default false,
  yesterday_focus text,                            -- anti-repeat (пул 32 шаблона)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create unique index if not exists uq_daily_specials on public.daily_specials(player_id, game_day, template_key);

create table if not exists public.onboarding_state (
  player_id      uuid primary key references public.players(id) on delete cascade,
  t_day          int default 0,
  ftue_complete  bool default false,             -- гейт: не в dau_7d до FTUE
  skipped        bool default false,
  flags          jsonb default '{}'::jsonb,
  updated_at     timestamptz
);

create table if not exists public.winback_state (
  player_id            uuid primary key references public.players(id) on delete cascade,
  last_wave            text,
  wave_sent_at         timestamptz,
  best_streak_snapshot int default 0,
  updated_at           timestamptz
);

-- ---------------------------------------------------------------------------
-- 5. Валютный леджер + проекция кошелька (§3.2.11) — ядро античита экономики.
-- ---------------------------------------------------------------------------
create table if not exists public.currency_ledgers (
  id               bigint generated always as identity primary key,
  player_id        uuid not null references public.players(id) on delete cascade,
  currency         text not null check (currency in ('bucks','dimes','tickets','ribbons')),  -- РОВНО 4 (K11)
  delta            bigint not null,
  reason           text not null,
  ref_type         text,
  ref_id           text,
  idempotency_key  text,
  balance_after    bigint,
  at               timestamptz not null default now()
);
create index if not exists idx_ledger_player on public.currency_ledgers(player_id, currency, at);
create unique index if not exists uq_ledger_idem
  on public.currency_ledgers(idempotency_key) where idempotency_key is not null;

-- Материализованная проекция баланса (обновляется триггером на леджер, 0006).
create table if not exists public.wallets (
  player_id  uuid not null references public.players(id) on delete cascade,
  currency   text not null check (currency in ('bucks','dimes','tickets','ribbons')),
  balance    bigint not null default 0,
  updated_at timestamptz,
  primary key (player_id, currency)
);

-- ---------------------------------------------------------------------------
-- 6. Инфра / античит / аудит (§3.2.11).
-- ---------------------------------------------------------------------------
create table if not exists public.device_fingerprints (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.players(id) on delete cascade,
  fingerprint_hash  text not null,               -- только хеш (privacy)
  first_seen        timestamptz not null default now()
);
create index if not exists idx_fingerprints on public.device_fingerprints(fingerprint_hash);

create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid,                            -- игрок или system (null)
  action        text not null,
  payload_hash  text,
  result        text check (result in ('ok','rejected','error')),
  reject_reason text,
  at            timestamptz not null default now()
);
create index if not exists idx_audit_actor  on public.audit_logs(actor_id, at);
create index if not exists idx_audit_action on public.audit_logs(action, at);

create table if not exists public.rate_limits (
  player_id     uuid not null references public.players(id) on delete cascade,
  bucket        text not null,                   -- harvest|craft|help|chat|pull
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (player_id, bucket, window_start)
);

-- Универсальный гард идемпотентности для наградных/оркестрационных действий.
create table if not exists public.idempotency (
  scope   text not null,                         -- contest_judge|season_rollover|push|fair_tick|...
  key     text not null,
  at      timestamptz not null default now(),
  result  text,                                  -- ok|error (для ретрая)
  primary key (scope, key)
);

-- ---------------------------------------------------------------------------
-- 7. updated_at триггеры.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'public.know_how_nodes','public.player_know_how','public.player_state_counters',
    'public.collections','public.toys','public.player_decor','public.player_neon_sign',
    'public.route_pass_progress','public.prize_series_pity','public.regulars_club',
    'public.purchases','public.player_streaks','public.daily_specials',
    'public.onboarding_state','public.winback_state','public.wallets'
  ] loop
    perform public.attach_updated_at(t::regclass);
  end loop;
end $$;
