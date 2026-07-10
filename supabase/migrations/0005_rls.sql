-- ============================================================================
-- 0005_rls.sql — Sunnyside · Row Level Security (все таблицы)
-- Реализует 20-backend.md §3.3. Инвариант: НЕТ ни одной WITH CHECK(true)
--   политики записи для роли authenticated. Клиенту доступен только SELECT
--   (своё + публичное-в-городе). Запись — SECURITY DEFINER RPC (0006) под
--   ролью-владельцем и Edge под service_role (обходят RLS осознанно).
-- Идемпотентно: ENABLE RLS (повторно — no-op), DROP POLICY IF EXISTS + CREATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auth-хелперы (SECURITY DEFINER — обходят RLS, чтобы не было рекурсии).
-- ---------------------------------------------------------------------------
create or replace function public.current_town_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select town_id from public.players where id = auth.uid() $$;

create or replace function public.current_street_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select street_id from public.players where id = auth.uid() $$;

create or replace function public.owns_farm(p_farm uuid)
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (
        select 1 from public.farms f
        where f.id = p_farm and f.player_id = auth.uid()) $$;

create or replace function public.same_town_player(p_player uuid)
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (
        select 1 from public.players p
        where p.id = p_player and p.town_id = public.current_town_id()) $$;

-- Хелпер создания SELECT-политики для роли authenticated (идемпотентно).
create or replace function public.ensure_select_policy(p_table regclass, p_using text)
returns void language plpgsql
as $$
declare v_pol text := 'sel_' || (select relname from pg_class where oid = p_table);
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('drop policy if exists %I on %s', v_pol, p_table);
  execute format(
    'create policy %I on %s for select to authenticated using (%s)',
    v_pol, p_table, p_using);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Включить RLS на ВСЕХ таблицах public (линт: нет таблицы без RLS).
--    Таблицы без SELECT-политики ниже = deny-all для authenticated
--    (service_role/owner всё равно обходят) — служебные таблицы §3.3.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as t
    from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %s enable row level security', r.t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. SELECT-политики по группам (§3.3).
-- ---------------------------------------------------------------------------

-- 3a. Приватные игрока: player_id = auth.uid().
do $$
declare t text;
begin
  foreach t in array array[
    'recipes','recipes_mastery','staff_roster','staff_assignments','know_how_nodes',
    'player_know_how','player_state_counters','route_pass_progress','prize_series_pity',
    'prize_pulls','regulars_club','boosters_daily','farm_value_snapshots','player_streaks',
    'daily_specials','player_achievements','player_decor','player_neon_sign','onboarding_state',
    'mail_orders','forage_daily','winback_state','purchases','currency_ledgers','wallets',
    'personal_contributions','event_milestones_claimed','event_leagues'
  ] loop
    perform public.ensure_select_policy(('public.'||t)::regclass, 'player_id = auth.uid()');
  end loop;
end $$;

-- 3b. Приватные фермы: owns_farm(farm_id).
do $$
declare t text;
begin
  foreach t in array array[
    'plots','buildings','machines','machine_jobs','inventory','animals','holding_pen','expeditions'
  ] loop
    perform public.ensure_select_policy(('public.'||t)::regclass, 'public.owns_farm(farm_id)');
  end loop;
end $$;

-- 3c. Публичные-в-городе: town_id = current_town_id().
do $$
declare t text;
begin
  foreach t in array array[
    'towns','market_weeks','town_projects','contests','event_weeks',
    'mail_catalog_weeks','foraging_points','server_calendars'
  ] loop
    if t = 'towns' then
      perform public.ensure_select_policy('public.towns'::regclass, 'id = public.current_town_id()');
    else
      perform public.ensure_select_policy(('public.'||t)::regclass, 'town_id = public.current_town_id()');
    end if;
  end loop;
end $$;

-- 3d. Пер-табличные предикаты (у части нет колонки town_id).
select public.ensure_select_policy('public.streets'::regclass,
  'town_id = public.current_town_id()');
select public.ensure_select_policy('public.street_members'::regclass,
  'street_id in (select id from public.streets where town_id = public.current_town_id())');
select public.ensure_select_policy('public.versus_matches'::regclass,
  'town_a = public.current_town_id() or town_b = public.current_town_id()');

-- players: своё + соседи по городу (витрина).
select public.ensure_select_policy('public.players'::regclass,
  'id = auth.uid() or town_id = public.current_town_id()');
-- farms: своя + layout соседей по городу.
select public.ensure_select_policy('public.farms'::regclass,
  'player_id = auth.uid() or town_id = public.current_town_id()');

-- 3e. Соседские витрины: своё ИЛИ владелец в том же городе.
do $$
declare t text;
begin
  foreach t in array array['ribbons_wall','toys','collections','postcards'] loop
    perform public.ensure_select_policy(('public.'||t)::regclass,
      'player_id = auth.uid() or public.same_town_player(player_id)');
  end loop;
end $$;

-- 3f. Кооп / вклад / голоса (город/стрит игрока или собственные строки).
select public.ensure_select_policy('public.orders'::regclass,
  'town_id = public.current_town_id()');
select public.ensure_select_policy('public.order_contributions'::regclass,
  'player_id = auth.uid() or order_id in (select id from public.orders where town_id = public.current_town_id())');
select public.ensure_select_policy('public.potlucks'::regclass,
  'street_id in (select id from public.streets where town_id = public.current_town_id())');
select public.ensure_select_policy('public.potluck_contributions'::regclass,
  'player_id = auth.uid() or potluck_id in (select id from public.potlucks where street_id in (select id from public.streets where town_id = public.current_town_id()))');
select public.ensure_select_policy('public.town_project_contributions'::regclass,
  'player_id = auth.uid() or project_id in (select id from public.town_projects where town_id = public.current_town_id())');
select public.ensure_select_policy('public.event_contributions'::regclass,
  'player_id = auth.uid() or event_week_id in (select id from public.event_weeks where town_id = public.current_town_id())');
select public.ensure_select_policy('public.contest_entries'::regclass,
  'contest_id in (select id from public.contests where town_id = public.current_town_id())');
select public.ensure_select_policy('public.contest_votes'::regclass,
  'voter_id = auth.uid()');
select public.ensure_select_policy('public.help_actions'::regclass,
  'actor_id = auth.uid() or target_id = auth.uid()');
select public.ensure_select_policy('public.gifts'::regclass,
  'from_id = auth.uid() or to_id = auth.uid()');
select public.ensure_select_policy('public.mentorships'::regclass,
  'mentor_id = auth.uid() or mentee_id = auth.uid()');
select public.ensure_select_policy('public.farm_visits'::regclass,
  'visitor_id = auth.uid() or host_id = auth.uid()');
select public.ensure_select_policy('public.neighbor_sits'::regclass,
  'host_id = auth.uid() or sitter_id = auth.uid()');
select public.ensure_select_policy('public.migration_proposals'::regclass,
  'scope_id = public.current_town_id() or scope_id = public.current_street_id()');
select public.ensure_select_policy('public.migration_votes'::regclass,
  'player_id = auth.uid() or proposal_id in (select id from public.migration_proposals where scope_id = public.current_town_id() or scope_id = public.current_street_id())');

-- 3g. Ярмарка (публичный просмотр прилавков города + собственный лог продаж).
select public.ensure_select_policy('public.fair_stalls'::regclass,
  'player_id = auth.uid() or town_id = public.current_town_id()');
select public.ensure_select_policy('public.fair_lots'::regclass,
  'stall_id in (select id from public.fair_stalls where player_id = auth.uid() or town_id = public.current_town_id())');
select public.ensure_select_policy('public.fair_sales'::regclass,
  'player_id = auth.uid()');

-- 3h. Чат: только каналы игрока (стрит/город).
select public.ensure_select_policy('public.chat_messages'::regclass,
  $sql$channel = ('town:' || public.current_town_id()::text)
       or channel = ('street:' || public.current_street_id()::text)$sql$);

-- 3i. Инфра-справочники: активные конфиги — read всем authenticated.
select public.ensure_select_policy('public.config_versions'::regclass,
  $sql$state = 'active'$sql$);
select public.ensure_select_policy('public.game_configs'::regclass,
  $sql$version_id in (select id from public.config_versions where state = 'active')$sql$);
select public.ensure_select_policy('public.route_pass_seasons'::regclass, 'true');

-- ---------------------------------------------------------------------------
-- 4. Служебные таблицы: RLS включён, SELECT-политик НЕТ → deny-all для
--    authenticated (§3.3, только service_role): audit_logs, device_fingerprints,
--    rate_limits, processed_anchors, idempotency. (RLS уже включён п.2.)
-- ---------------------------------------------------------------------------
-- (намеренно без политик)
