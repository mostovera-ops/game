-- ============================================================================
-- 0021_agents_memory.sql — Sunnyside · Агентская память/задачи/журнал.
--
-- НАЗНАЧЕНИЕ: координация параллельных код-агентов волны (не игроков). Отдельная
-- схема `agents` с тремя таблицами:
--   • agents.memory — долговременная память (ключ→документ), общая для агентов.
--   • agents.tasks  — задачи с статусом/владельцем/зависимостями.
--   • agents.log    — журнал действий (start/finish/decision/blocker/handoff).
--
-- ДОСТУП: ТОЛЬКО service_role. Игровых RLS-политик здесь НЕТ — эта схема
-- невидима anon/authenticated: revoke usage на схему + revoke all на таблицы,
-- RLS enable без политик (deny-by-default для не-service ролей; service_role
-- обходит RLS by design). Игроков и клиента это не касается.
--
-- Идемпотентно: `create schema/table if not exists`, `create index if not
-- exists`, `do $$` для констрейнтов. Правок в 0001–0020 не вносит.
-- ============================================================================

create schema if not exists agents;

-- ---------------------------------------------------------------------------
-- 1. agents.memory — общая память агентов (ключ→документ).
-- ---------------------------------------------------------------------------
create table if not exists agents.memory (
  key        text primary key,
  title      text,
  content    text not null,
  tags       text[] not null default '{}',
  author     text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. agents.tasks — задачи с статусом, владельцем, зависимостями.
-- ---------------------------------------------------------------------------
create table if not exists agents.tasks (
  id          bigserial primary key,
  title       text not null,
  description text,
  status      text not null default 'pending',
  owner       text,
  depends_on  bigint[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_status_chk'
      and conrelid = 'agents.tasks'::regclass
  ) then
    alter table agents.tasks add constraint tasks_status_chk
      check (status in ('pending','in_progress','review','done','blocked'));
  end if;
end $$;

create index if not exists tasks_status_idx on agents.tasks (status);

-- ---------------------------------------------------------------------------
-- 3. agents.log — журнал действий агентов.
-- ---------------------------------------------------------------------------
create table if not exists agents.log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  agent   text,
  model   text,
  branch  text,
  action  text not null,
  task_id bigint,
  summary text,
  files   text[] not null default '{}',
  details jsonb
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'log_action_chk'
      and conrelid = 'agents.log'::regclass
  ) then
    alter table agents.log add constraint log_action_chk
      check (action in ('start','finish','decision','blocker','handoff'));
  end if;
end $$;

create index if not exists log_at_desc_idx on agents.log (at desc);

-- ---------------------------------------------------------------------------
-- 4. Доступ: только service_role. Схема невидима anon/authenticated/public.
-- ---------------------------------------------------------------------------
alter table agents.memory enable row level security;
alter table agents.tasks  enable row level security;
alter table agents.log    enable row level security;

revoke all on schema agents from anon, authenticated, public;
revoke all on all tables    in schema agents from anon, authenticated, public;
revoke all on all sequences in schema agents from anon, authenticated, public;

-- Явно наделяем service_role (обходит RLS; но usage на схему нужен явно).
grant usage on schema agents to service_role;
grant all on all tables    in schema agents to service_role;
grant all on all sequences in schema agents to service_role;

-- Дефолты для будущих объектов схемы (на случай доп. таблиц/сиквенсов).
alter default privileges in schema agents
  revoke all on tables from anon, authenticated, public;
alter default privileges in schema agents
  revoke all on sequences from anon, authenticated, public;
alter default privileges in schema agents grant all on tables to service_role;
alter default privileges in schema agents grant all on sequences to service_role;
