-- ============================================================================
-- 0002_social.sql — Sunnyside · Social interactions (coop, help, potluck,
--                    town-projects, chat, gifts, mentorship, migration votes)
-- Реализует 20-backend.md §3.2.6 (кооп/помощь/town-projects), §3.2.15
--   (переезды-голосования). Города/стриты/игроки — в 0001 (соц-граф).
-- Server-authoritative: вклады/голоса пишутся ТОЛЬКО через RPC (RLS в 0005).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Кооп-заказы (20-backend §3.2.6 / 11-town.md).
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  town_id       uuid not null references public.towns(id) on delete cascade,
  week_index    int  not null,
  title_key     text,
  requirements  jsonb not null,                       -- [{item_key, qty}]
  progress      jsonb not null default '{}'::jsonb,   -- кэш заполнения
  deadline      timestamptz not null,                 -- = coop_deadline (Чт 23:59)
  state         text default 'open' check (state in ('open','fulfilled','expired')),
  reward        jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index if not exists idx_orders_town_week on public.orders(town_id, week_index, state);

create table if not exists public.order_contributions (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id)  on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  item_key        text not null,
  qty             int  not null check (qty > 0),
  contributed_at  timestamptz not null default now()
);
create index if not exists idx_order_contrib_order  on public.order_contributions(order_id);
create index if not exists idx_order_contrib_player on public.order_contributions(player_id);

-- ---------------------------------------------------------------------------
-- 2. Потлак стрита (20-backend §3.2.6 / mech_potluck).
-- ---------------------------------------------------------------------------
create table if not exists public.potlucks (
  id           uuid primary key default gen_random_uuid(),
  street_id    uuid not null references public.streets(id) on delete cascade,
  week_index   int  not null,
  total_score  bigint not null default 0,
  buff         jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create unique index if not exists uq_potlucks_street_week on public.potlucks(street_id, week_index);

create table if not exists public.potluck_contributions (
  id          uuid primary key default gen_random_uuid(),
  potluck_id  uuid not null references public.potlucks(id) on delete cascade,
  player_id   uuid not null references public.players(id)  on delete cascade,
  item_key    text not null,
  qty         int  not null check (qty > 0),
  score       bigint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_potluck_contrib on public.potluck_contributions(potluck_id);

-- ---------------------------------------------------------------------------
-- 3. Помощь соседу / подарки / менторство (20-backend §3.2.6 / 11-town.md).
-- ---------------------------------------------------------------------------
create table if not exists public.help_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references public.players(id) on delete cascade,
  target_id    uuid not null references public.players(id) on delete cascade,
  action_type  text not null check (action_type in ('water','feed','restock','cheer')),
  game_day     date not null,   -- игровой день UTC для дневных кэпов (≤3/target)
  created_at   timestamptz not null default now()
);
create index if not exists idx_help_actor  on public.help_actions(actor_id, game_day);
create index if not exists idx_help_target on public.help_actions(target_id, game_day);

create table if not exists public.gifts (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.players(id) on delete cascade,
  to_id      uuid not null references public.players(id) on delete cascade,
  item_key   text not null,
  qty        int  not null check (qty > 0),
  game_day   date not null,
  claimed    bool default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_gifts_to on public.gifts(to_id, claimed);

create table if not exists public.mentorships (
  id            uuid primary key default gen_random_uuid(),
  mentor_id     uuid not null references public.players(id) on delete cascade,
  mentee_id     uuid not null unique references public.players(id) on delete cascade,  -- 1 ментор на менти
  state         text default 'active' check (state in ('active','graduated')),
  started_week  int,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mentorships_mentor on public.mentorships(mentor_id);
-- Лимит активных ≤2 у ментора — enforced counting-запросом в RPC (0006).

-- ---------------------------------------------------------------------------
-- 4. Городские проекты (20-backend §3.2.6 / tp_*).
-- ---------------------------------------------------------------------------
create table if not exists public.town_projects (
  id           uuid primary key default gen_random_uuid(),
  town_id      uuid not null references public.towns(id) on delete cascade,
  project_key  text not null,
  tier         int  default 0,
  progress     bigint default 0,
  state        text default 'building' check (state in ('building','complete')),
  buff_active  jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);
create unique index if not exists uq_town_projects on public.town_projects(town_id, project_key);

create table if not exists public.town_project_contributions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.town_projects(id) on delete cascade,
  player_id   uuid not null references public.players(id)       on delete cascade,
  currency    text not null,
  amount      bigint not null,
  week_index  int not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tp_contrib_project on public.town_project_contributions(project_id);
create index if not exists idx_tp_contrib_player  on public.town_project_contributions(player_id);

-- ---------------------------------------------------------------------------
-- 5. Чат / визиты (20-backend §3.2.6).
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id          bigint generated always as identity primary key,  -- ordered
  channel     text not null,                                    -- street:{id}|town:{id}
  author_id   uuid not null references public.players(id) on delete cascade,
  body        text check (char_length(body) <= 500),
  sticker_key text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_chat_channel on public.chat_messages(channel, created_at desc);

create table if not exists public.farm_visits (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  uuid not null references public.players(id) on delete cascade,
  host_id     uuid not null references public.players(id) on delete cascade,
  visited_at  timestamptz not null default now()
);
create index if not exists idx_farm_visits_host on public.farm_visits(host_id, visited_at desc);

-- ---------------------------------------------------------------------------
-- 6. Присмотр за фермой в отпуске (20-backend §3.2.15 / Neighbor Sitter).
-- ---------------------------------------------------------------------------
create table if not exists public.neighbor_sits (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.players(id) on delete cascade,
  sitter_id  uuid not null references public.players(id) on delete cascade,
  game_day   date not null,
  created_at timestamptz not null default now()
);
-- 1 оплачиваемая награда/ферма-в-отпуске/день (первый смотритель); анти-манекен.
create unique index if not exists uq_neighbor_sits_host_day on public.neighbor_sits(host_id, game_day);

-- ---------------------------------------------------------------------------
-- 7. Переезды-голосования (20-backend §3.2.15 / 12-migration.md).
-- ---------------------------------------------------------------------------
create table if not exists public.migration_proposals (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('town_merge','street_caravan')),
  scope_id        uuid not null,               -- town_id (merge) | street_id (caravan)
  target_town_id  uuid references public.towns(id),
  opened_at       timestamptz not null default now(),
  closes_at       timestamptz not null,        -- Caravan 72ч / Merge — календарная неделя
  state           text default 'voting' check (state in ('voting','passed','failed','executed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
-- Частичный unique: одно активное голосование на город/стрит.
create unique index if not exists uq_migration_active
  on public.migration_proposals(scope_id) where state = 'voting';

create table if not exists public.migration_votes (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.migration_proposals(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  vote         text not null check (vote in ('yes','no')),
  at           timestamptz not null default now()
);
-- 1 голос/предложение/игрок (античит накрутки).
create unique index if not exists uq_migration_votes on public.migration_votes(proposal_id, player_id);

-- ---------------------------------------------------------------------------
-- 8. updated_at триггеры.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'public.orders','public.potlucks','public.town_projects','public.migration_proposals'
  ] loop
    perform public.attach_updated_at(t::regclass);
  end loop;
end $$;
