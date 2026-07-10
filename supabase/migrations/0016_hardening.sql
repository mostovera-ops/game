-- ============================================================================
-- 0016_hardening.sql — Sunnyside · Хардненинг SQL-зоны (код-ревью FIXPLAN-CODE)
-- Закрывает находки SQL-1…SQL-13:
--   SQL-1/2/3/13 — REVOKE EXECUTE от public/anon/authenticated на всех
--     служебных (job_*, _migrate_*, ensure_calendar, call_edge) и внутренних
--     хелперах движения (ledger_write/inv_*/claim_*/rollover_open_week/
--     gp_farm_ctx/log_audit/rand01). Дефолтный грант PUBLIC снимается — иллюзия
--     защиты `revoke … from authenticated,anon` (0006/0013) устранена.
--   SQL-4  — shift_submit: пер-игрок advisory-lock до чтений (двойная оплата).
--   SQL-5  — job_market_generate: зеро-сумная генерация спроса (анти-инфляция,
--     пол 0.70/потолок 1.30 по D_CAT_FLOOR/CEIL, паритет с econ/demand.computeDCat).
--   SQL-6  — ledger_write: on conflict (idempotency_key) do nothing (не аварит джоб).
--   SQL-7  — help_neighbor/gift_send/prize_pull: advisory-lock вокруг кэп-проверок.
--   SQL-8  — craft_start: FOR UPDATE на строке машины (гонка слотов).
--   SQL-9  — expedition_start: partial-unique(farm,route_slot) + insert-guard.
--   SQL-10 — migration_move: FOR UPDATE на строке towns (гонка вместимости).
--   SQL-11 — mentor_invite: advisory-lock вокруг mentee-кэпа.
--   SQL-12 — композитные индексы *_contributions(id, player_id) для get_town.
-- Идемпотентно: create or replace (грант EXECUTE сохраняется), revoke/create
--   index if not exists — повторно no-op. Правок в 0001–0015 не вносит.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SQL-1/2/3/13 · REVOKE: снять дефолтный PUBLIC-грант (и anon/authenticated)
--   на служебных джобах-по-крону и внутренних хелперах. Cron/SECURITY DEFINER
--   вызывают их как владелец — снятие грантов у клиентских ролей их не ломает.
--   Матчим по именам (устойчиво к сигнатурам): job_%, _migrate%, и явный список
--   хелперов. Идемпотентно, ошибки глушим (редкая среда без роли).
-- ---------------------------------------------------------------------------
do $$
declare r record; role_list text; has_anon boolean; has_auth boolean;
begin
  select exists(select 1 from pg_roles where rolname='anon') into has_anon;
  select exists(select 1 from pg_roles where rolname='authenticated') into has_auth;
  role_list := 'public'
    || case when has_anon then ', anon' else '' end
    || case when has_auth then ', authenticated' else '' end;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'job\_%'            -- 0008 + 0015 крон-джобы
        or p.proname like '\_migrate%'     -- 0015 _migrate_player_to/_migrate_street_to
        or p.proname in (
          -- служебные (SQL-1)
          'ensure_calendar','call_edge','rand01',
          -- forgeable audit (SQL-3)
          'log_audit',
          -- внутренние хелперы движения (SQL-13)
          'inv_add','inv_remove','ledger_write','rollover_open_week',
          'claim_idem','claim_anchor','gp_farm_ctx','config_doc',
          'trg_ledger_apply','promote_ready'
        )
      )
  loop
    begin
      execute format('revoke execute on function %s from %s', r.sig, role_list);
    exception when others then
      raise notice 'skip revoke on %: %', r.sig, sqlerrm;
    end;
  end loop;
end $$;

-- Долгосрочный deny-by-default: новые функции public больше не получают PUBLIC
-- EXECUTE автоматически. Явные grant-ы клиентским RPC (0006/0013) не затрагивает.
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- SQL-12 · Композитные индексы под get_town.myContribution (0011:686-768):
--   фильтр по (scope_id, player_id) шёл по одиночным индексам.
-- ---------------------------------------------------------------------------
create index if not exists idx_order_contrib_order_player
  on public.order_contributions(order_id, player_id);
create index if not exists idx_potluck_contrib_potluck_player
  on public.potluck_contributions(potluck_id, player_id);
create index if not exists idx_tp_contrib_project_player
  on public.town_project_contributions(project_id, player_id);

-- SQL-9 · Partial-unique: один незакрытый рейс на (ферма, слот маршрута).
create unique index if not exists uq_expedition_open_slot
  on public.expeditions(farm_id, route_slot) where collected = false;

-- ---------------------------------------------------------------------------
-- SQL-6 · ledger_write: идемпотентная вставка (не аварит вызывающий джоб при
--   повторном idempotency_key). NULL v_id → «уже выплачено» для вызывающих.
-- ---------------------------------------------------------------------------
create or replace function public.ledger_write(
  p_player uuid, p_currency text, p_delta bigint, p_reason text,
  p_ref_type text default null, p_ref_id text default null, p_idem text default null)
returns bigint language plpgsql
as $$
declare v_id bigint;
begin
  insert into public.currency_ledgers(player_id, currency, delta, reason, ref_type, ref_id, idempotency_key)
  values (p_player, p_currency, p_delta, p_reason, p_ref_type, p_ref_id, p_idem)
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_id;
  return v_id;  -- null ⇒ дубль по idem-ключу, работа уже выполнена
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-8 · craft_start: FOR UPDATE на строке машины до подсчёта активных джоб
--   (иначе два параллельных старта на 1 слот оба проходят).
-- ---------------------------------------------------------------------------
create or replace function public.craft_start(p_machine uuid, p_recipe_key text, p_batch int default 1)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_active int; v_slots int; v_time_min int;
  v_inputs jsonb; v_in record; v_job uuid;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  -- SQL-8: лочим строку машины — сериализуем конкурентные craft_start по слотам.
  select slots into v_slots from public.machines where id = p_machine and farm_id = v_farm for update;
  if v_slots is null then raise exception 'no_machine'; end if;

  if not exists (select 1 from public.recipes where player_id = auth.uid() and recipe_key = p_recipe_key) then
    perform public.log_audit(auth.uid(), 'craft_start', 'rejected', 'recipe_locked');
    raise exception 'recipe_locked';
  end if;

  select count(*) into v_active from public.machine_jobs
    where machine_id = p_machine and collected = false;
  if v_active >= v_slots then
    perform public.log_audit(auth.uid(), 'craft_start', 'rejected', 'no_slot');
    raise exception 'no_free_slot';
  end if;

  v_inputs := coalesce(public.config_doc(v_farm,'recipes')->p_recipe_key->'inputs', '[]'::jsonb);
  -- Списываем вход атомарно (any-missing → откат транзакции = ничего не съедено).
  for v_in in select * from jsonb_to_recordset(v_inputs) as x(item_key text, qty int, quality smallint)
  loop
    if not public.inv_remove(v_farm, v_in.item_key, v_in.qty * p_batch, coalesce(v_in.quality,0)) then
      perform public.log_audit(auth.uid(), 'craft_start', 'rejected', 'no_input');
      raise exception 'insufficient_input:%', v_in.item_key;
    end if;
  end loop;

  v_time_min := coalesce((public.config_doc(v_farm,'recipes')->p_recipe_key->>'time_min')::int, 15);

  insert into public.machine_jobs(machine_id, farm_id, recipe_key, batch_size, started_at, ready_at, input_snapshot)
  values (p_machine, v_farm, p_recipe_key, p_batch, now(),
          now() + make_interval(mins => v_time_min), v_inputs)
  returning id into v_job;

  perform public.log_audit(auth.uid(), 'craft_start', 'ok');
  return jsonb_build_object('job', v_job, 'ready_min', v_time_min);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-7 · help_neighbor: advisory-lock (actor:target:day) вокруг count+insert
--   (иначе пачка параллельных запросов все читают <3 и превышают кэп 3/цель/день).
-- ---------------------------------------------------------------------------
create or replace function public.help_neighbor(p_target uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_cnt int;
begin
  if p_target = auth.uid() then raise exception 'self_help'; end if;
  -- SQL-7: сериализуем кэп-ключ (actor:target:день) — TOCTOU дневного кэпа.
  perform pg_advisory_xact_lock(hashtextextended(
    'help_neighbor:'||auth.uid()::text||':'||p_target::text||':'||public.game_day()::text, 0));
  -- смурф-фильтр: общий отпечаток исключает помощь.
  if exists (
    select 1 from public.device_fingerprints a
    join public.device_fingerprints b on a.fingerprint_hash = b.fingerprint_hash
    where a.player_id = auth.uid() and b.player_id = p_target) then
    perform public.log_audit(auth.uid(), 'help_neighbor', 'rejected', 'smurf');
    raise exception 'smurf_blocked';
  end if;
  -- кэп ≤3 одному target/день.
  select count(*) into v_cnt from public.help_actions
    where actor_id = auth.uid() and target_id = p_target and game_day = public.game_day();
  if v_cnt >= 3 then
    perform public.log_audit(auth.uid(), 'help_neighbor', 'rejected', 'daily_cap');
    raise exception 'daily_cap';
  end if;

  insert into public.help_actions(actor_id, target_id, action_type, game_day)
  values (auth.uid(), p_target, p_action, public.game_day());
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-7 · gift_send: advisory-lock (from:to:day) вокруг count+insert.
-- ---------------------------------------------------------------------------
create or replace function public.gift_send(p_to uuid, p_item_key text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_cnt int;
begin
  if p_to = auth.uid() or p_qty <= 0 then raise exception 'bad_gift'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
  -- SQL-7: сериализуем кэп-ключ (from:to:день).
  perform pg_advisory_xact_lock(hashtextextended(
    'gift_send:'||auth.uid()::text||':'||p_to::text||':'||public.game_day()::text, 0));
  select count(*) into v_cnt from public.gifts
    where from_id = auth.uid() and to_id = p_to and game_day = public.game_day();
  if v_cnt >= 3 then raise exception 'daily_cap'; end if;
  if not public.inv_remove(v_farm, p_item_key, p_qty, 0) then raise exception 'no_stock'; end if;

  insert into public.gifts(from_id, to_id, item_key, qty, game_day)
  values (auth.uid(), p_to, p_item_key, p_qty, public.game_day());
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-4 · shift_submit: пер-игрок advisory-lock ДО любых чтений (двойная оплата
--   / обход кэпов через N параллельных вызовов, все видящие v_done=0).
-- ---------------------------------------------------------------------------
create or replace function public.shift_submit()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_town uuid; v_week int; v_caps jsonb;
  v_per_window int; v_cooldown_h int; v_ticket_cap int;
  v_window_start timestamptz; v_done int; v_last timestamptz; v_since timestamptz;
  v_rev bigint := 0; v_fp bigint := 0; v_tips bigint; v_earned bigint; v_tickets bigint;
begin
  select o_farm, o_town, o_week into v_farm, v_town, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  -- SQL-4: сериализуем сабмиты одного игрока до чтения audit_logs/fair_sales.
  perform pg_advisory_xact_lock(hashtextextended('shift_submit:'||auth.uid()::text, 0));

  v_caps := public.config_doc(v_farm,'caps');
  v_per_window := coalesce((v_caps->>'shift_per_fair_window')::int, 3);
  v_cooldown_h := coalesce((v_caps->>'shift_cooldown_hours')::int, 2);
  v_ticket_cap := coalesce((v_caps->>'ticket_cap_per_week')::int, 5);

  select fair_open into v_window_start from public.server_calendars
    where town_id = v_town and week_index = v_week;
  v_window_start := coalesce(v_window_start, to_timestamp(0));

  -- Лимит смен/окно + кулдаун между сменами (по audit_logs).
  select count(*), max(at) into v_done, v_last from public.audit_logs
    where actor_id = auth.uid() and action = 'shift_submit'
      and result = 'ok' and at >= v_window_start;
  if v_done >= v_per_window then
    perform public.log_audit(auth.uid(), 'shift_submit', 'rejected', 'shift_cap');
    raise exception 'shift_cap';
  end if;
  if v_last is not null and now() - v_last < make_interval(hours => v_cooldown_h) then
    perform public.log_audit(auth.uid(), 'shift_submit', 'rejected', 'cooldown');
    raise exception 'shift_cooldown';
  end if;

  -- Реконструкция: пассивные продажи с прошлой смены (или с начала окна).
  v_since := coalesce(v_last, v_window_start);
  select coalesce(sum(revenue), 0), coalesce(sum(fp), 0) into v_rev, v_fp
    from public.fair_sales where player_id = auth.uid() and tick_at > v_since;

  v_tips := floor(v_rev * 0.1)::bigint;  -- гипотеза баланса (14-economy.md)

  -- Недельный кэп 🎟 (R10): уже начисленные за 7 дней тикеты смены.
  select coalesce(sum(greatest(0, delta)), 0) into v_earned
    from public.currency_ledgers
    where player_id = auth.uid() and currency = 'tickets'
      and reason = 'shift_reward' and at >= now() - interval '7 days';
  v_tickets := least(1 + floor(v_fp / 50)::bigint, v_ticket_cap - v_earned);
  if v_tickets < 0 then v_tickets := 0; end if;

  if v_tips > 0 then
    perform public.ledger_write(auth.uid(), 'bucks', v_tips, 'shift_tips', 'fair', v_farm::text);
  end if;
  if v_tickets > 0 then
    perform public.ledger_write(auth.uid(), 'tickets', v_tickets, 'shift_reward', 'fair', v_farm::text);
  end if;

  perform public.log_audit(auth.uid(), 'shift_submit', 'ok');
  return jsonb_build_object('tips', v_tips, 'fair_score', v_rev + v_fp,
    'tickets', v_tickets, 'fp', v_fp);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-9 · expedition_start: insert под partial-unique(farm,route_slot); гонку
--   двух инсертов в один слот ловим unique_violation → slot_busy (дабл-лут).
-- ---------------------------------------------------------------------------
create or replace function public.expedition_start(p_state_key text, p_route_slot int default 1)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_hours numeric; v_slot int; v_rows int; v_payload jsonb := '[]'::jsonb;
  v_return timestamptz; v_id uuid; i int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  v_hours := (public.config_doc(v_farm,'timers')->'expedition_hours'->>p_state_key)::numeric;
  if v_hours is null then
    perform public.log_audit(auth.uid(), 'expedition_start', 'rejected', 'state_locked');
    raise exception 'state_locked';
  end if;

  v_slot := coalesce(p_route_slot, 1);
  if exists (select 1 from public.expeditions
             where farm_id = v_farm and route_slot = v_slot and collected = false) then
    perform public.log_audit(auth.uid(), 'expedition_start', 'rejected', 'slot_busy');
    raise exception 'slot_busy';
  end if;

  v_rows := coalesce((public.config_doc(v_farm,'drops')->>'expedition_guaranteed_rows')::int, 1);
  for i in 1..greatest(1, v_rows) loop
    v_payload := v_payload || jsonb_build_object(
      'item_key', p_state_key || '_crate', 'item_class', 'crop', 'qty', i, 'quality', 1);
  end loop;

  v_return := now() + make_interval(mins => (v_hours * 60)::int);
  -- SQL-9: конкурентный инсерт в тот же слот отсекает partial-unique.
  begin
    insert into public.expeditions(farm_id, state_key, route_slot, departed_at, return_at, payload, collected)
    values (v_farm, p_state_key, v_slot, now(), v_return, v_payload, false)
    returning id into v_id;
  exception when unique_violation then
    perform public.log_audit(auth.uid(), 'expedition_start', 'rejected', 'slot_busy');
    raise exception 'slot_busy';
  end;

  perform public.log_audit(auth.uid(), 'expedition_start', 'ok');
  return jsonb_build_object('expedition', v_id, 'return_at', v_return);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-10 · migration_move: FOR UPDATE на строке towns при проверке вместимости
--   (иначе конкурентные переезды перебирают town_capacity).
-- ---------------------------------------------------------------------------
create or replace function public.migration_move(p_target_town uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pl public.players; v_farm uuid; v_caps jsonb;
  v_cooldown int; v_minstay int; v_rate int;
  v_contrib bigint; v_tickets bigint; v_free boolean;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  select * into v_pl from public.players where id = v_uid for update;
  if v_pl.id is null then raise exception 'no_player'; end if;
  if v_pl.status = 'vacation' then raise exception 'on_vacation'; end if;         -- §3.1.2
  if p_target_town is null or p_target_town = v_pl.town_id then raise exception 'bad_target'; end if;

  select id into v_farm from public.farms where player_id = v_uid;
  v_caps    := public.config_doc(v_farm,'caps');
  v_cooldown:= coalesce((v_caps->>'moving_cooldown_days')::int, 14);
  v_minstay := coalesce((v_caps->>'town_min_stay_days')::int, 3);
  v_rate    := coalesce((v_caps->>'migrate_ticket_compensation_rate')::int, 50);

  if v_pl.last_migrated_at is not null and v_pl.last_migrated_at > now() - make_interval(days => v_cooldown) then
    perform public.log_audit(v_uid, 'migration_move', 'rejected', 'cooldown');
    raise exception 'move_cooldown';
  end if;
  if v_pl.town_joined_at is not null and v_pl.town_joined_at > now() - make_interval(days => v_minstay) then
    perform public.log_audit(v_uid, 'migration_move', 'rejected', 'min_stay');
    raise exception 'min_stay';
  end if;

  -- SQL-10: лочим строку целевого города — сериализуем конкурентные переезды.
  -- Цель открыта и со свободной ёмкостью (< town_capacity жителей).
  select (t.status = 'open'
          and (select count(*) from public.players p where p.town_id = t.id)
              < coalesce((v_caps->>'town_capacity')::int, t.capacity))
    into v_free
    from public.towns t where t.id = p_target_town for update;
  if not coalesce(v_free, false) then raise exception 'target_full'; end if;

  -- Конвертация личного вклада в Town Projects старого города → 🎟 (курс 50:1, кэп 500).
  select coalesce(sum(amount), 0) into v_contrib
    from public.town_project_contributions tpc
    join public.town_projects tp on tp.id = tpc.project_id
    where tpc.player_id = v_uid and tp.town_id = v_pl.town_id and tpc.currency = 'bucks';
  v_tickets := least(floor(v_contrib / greatest(v_rate,1))::bigint, 500);
  if v_tickets > 0 then
    perform public.ledger_write(v_uid, 'tickets', v_tickets, 'migrate_compensation',
      'town', v_pl.town_id::text);
  end if;

  -- Перенос: ферма и игрок меняют город, игрок покидает стрит (§3.1.1 G3).
  update public.farms set town_id = p_target_town, updated_at = now() where id = v_farm;
  delete from public.street_members where player_id = v_uid;
  update public.players
    set town_id = p_target_town, street_id = null,
        last_migrated_at = now(), town_joined_at = now(), updated_at = now()
  where id = v_uid;

  perform public.log_audit(v_uid, 'migration_move', 'ok');
  return jsonb_build_object('town', p_target_town, 'tickets_compensated', v_tickets);
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-11 · mentor_invite: advisory-lock вокруг mentee-кэпа (параллельные
--   инвайты разным mentee оба проходят мимо mentor_max_mentees).
-- ---------------------------------------------------------------------------
create or replace function public.mentor_invite(p_mentee uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_level int; v_max int; v_active int; v_farm uuid;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_mentee = v_uid then raise exception 'self_mentor'; end if;

  select farm_level into v_level from public.players where id = v_uid;
  if coalesce(v_level, 1) < 8 then
    perform public.log_audit(v_uid, 'mentor_invite', 'rejected', 'level_too_low');
    raise exception 'mentor_level';                                   -- ферма ≥8 (§3.7)
  end if;

  -- Смурф-фильтр: общий отпечаток устройства ментора и менти запрещает связь (§3.7).
  if exists (
    select 1 from public.device_fingerprints a
    join public.device_fingerprints b on a.fingerprint_hash = b.fingerprint_hash
    where a.player_id = v_uid and b.player_id = p_mentee) then
    perform public.log_audit(v_uid, 'mentor_invite', 'rejected', 'smurf');
    raise exception 'smurf_blocked';
  end if;

  select id into v_farm from public.farms where player_id = v_uid;
  v_max := coalesce((public.config_doc(v_farm,'caps')->>'mentor_max_mentees')::int, 2);
  -- SQL-11: сериализуем mentee-кэп ментора.
  perform pg_advisory_xact_lock(hashtextextended('mentor_invite:'||v_uid::text, 0));
  select count(*) into v_active from public.mentorships
    where mentor_id = v_uid and state = 'active';
  if v_active >= v_max then
    perform public.log_audit(v_uid, 'mentor_invite', 'rejected', 'mentee_cap');
    raise exception 'mentee_cap';
  end if;

  -- 1 ментор на менти (uq mentee_id 0002). Уже есть ментор → конфликт.
  insert into public.mentorships(mentor_id, mentee_id, state, started_week)
  values (v_uid, p_mentee, 'active',
          (select current_week_index from public.towns where id = (select town_id from public.players where id = v_uid)))
  on conflict (mentee_id) do nothing;
  if not found then raise exception 'mentee_taken'; end if;

  perform public.log_audit(v_uid, 'mentor_invite', 'ok');
  return jsonb_build_object('mentee', p_mentee, 'state', 'active');
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-7 · prize_pull: пер-игрок advisory-lock вокруг free-pull-кэпа. Free-cap
--   считается по ВСЕМ сериям, но pity-row лочится по одной серии → два
--   параллельных пула на РАЗНЫЕ серии оба видят v_free_used=0. Лочим по игроку.
--   (Тело идентично 0013, добавлен только advisory-lock перед подсчётом.)
-- ---------------------------------------------------------------------------
create or replace function public.prize_pull(p_series text, p_count int default 1)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_farm uuid; v_cfg jsonb;
  v_cost int; v_rare_cap int; v_chase_cap int; v_free_daily int; v_scrap_dupe boolean;
  v_pc_common numeric; v_pc_uncommon numeric; v_pc_rare numeric; v_pc_chase numeric;
  v_p record; v_results jsonb := '[]'::jsonb;
  i int; v_roll numeric; v_rarity text; v_pity boolean; v_this_cost int;
  v_free_used int; v_is_dupe boolean; v_toy_key text;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  select id into v_farm from public.farms where player_id = v_uid;

  v_cfg        := public.config_doc(v_farm,'prize_machine');
  v_cost       := coalesce((v_cfg->>'cost_dimes')::int, 20);
  v_rare_cap   := coalesce((v_cfg->>'rare_pity')::int, 10);
  v_chase_cap  := coalesce((v_cfg->>'chase_pity')::int, 40);
  v_free_daily := coalesce((v_cfg->>'free_pull_daily')::int, 1);
  v_scrap_dupe := coalesce((v_cfg->>'dupes_to_scrap')::boolean, true);
  v_pc_common  := coalesce((v_cfg->'drop_rates_pct'->>'common')::numeric, 68);
  v_pc_uncommon:= coalesce((v_cfg->'drop_rates_pct'->>'uncommon')::numeric, 24);
  v_pc_rare    := coalesce((v_cfg->'drop_rates_pct'->>'rare')::numeric, 6.5);
  v_pc_chase   := coalesce((v_cfg->'drop_rates_pct'->>'chase')::numeric, 1.5);

  -- SQL-7: сериализуем free-pull-кэп игрока (кэп считается по всем сериям).
  perform pg_advisory_xact_lock(hashtextextended('prize_pull:'||v_uid::text, 0));

  -- Сколько бесплатных круток уже потрачено сегодня (по всем сериям; UTC-день как game_day).
  select count(*) into v_free_used from public.prize_pulls
    where player_id = v_uid and cost_dimes = 0
      and (at at time zone 'utc')::date = public.game_day();

  insert into public.prize_series_pity(player_id, series_key) values (v_uid, p_series)
    on conflict (player_id, series_key) do nothing;
  select * into v_p from public.prize_series_pity
    where player_id = v_uid and series_key = p_series for update;

  for i in 1..greatest(1, coalesce(p_count,1)) loop
    -- Оплата: сперва дневной free-pull, затем ◉ через леджер (гард против минуса).
    if v_free_used < v_free_daily then
      v_this_cost := 0; v_free_used := v_free_used + 1;
    else
      v_this_cost := v_cost;
      perform public.ledger_write(v_uid, 'dimes', -v_cost, 'prize_pull', 'prize_series_pity', p_series);
    end if;

    -- Редкость: pity-оверрайд, иначе кумулятивный ролл из config (chase→rare→uncommon→common).
    v_pity := false;
    if v_p.pulls_since_chase + 1 >= v_chase_cap then
      v_rarity := 'chase'; v_pity := true;
    elsif v_p.pulls_since_rare + 1 >= v_rare_cap then
      v_rarity := 'rare'; v_pity := true;
    else
      v_roll := random() * 100.0;
      v_rarity := case
        when v_roll < v_pc_chase then 'chase'
        when v_roll < v_pc_chase + v_pc_rare then 'rare'
        when v_roll < v_pc_chase + v_pc_rare + v_pc_uncommon then 'uncommon'
        else 'common' end;
    end if;

    -- Обновление pity-счётчиков (uncommon — как common, не гарантируется).
    if v_rarity = 'chase' then
      v_p.pulls_since_chase := 0; v_p.pulls_since_rare := 0;
    elsif v_rarity = 'rare' then
      v_p.pulls_since_rare := 0; v_p.pulls_since_chase := v_p.pulls_since_chase + 1;
    else
      v_p.pulls_since_rare := v_p.pulls_since_rare + 1;
      v_p.pulls_since_chase := v_p.pulls_since_chase + 1;
    end if;

    v_toy_key := p_series || '_' || v_rarity;
    v_is_dupe := exists (select 1 from public.toys where player_id = v_uid and toy_key = v_toy_key);

    insert into public.prize_pulls(player_id, series_key, result_toy_key, rarity, cost_dimes, was_pity)
    values (v_uid, p_series, v_toy_key, v_rarity, v_this_cost, v_pity);

    insert into public.toys(player_id, toy_key, series_key, rarity, count)
    values (v_uid, v_toy_key, p_series, v_rarity, 1)
    on conflict (player_id, toy_key)
    do update set count = public.toys.count + 1, updated_at = now();

    -- Дубль → scrap (⚙), non-currency state (K11).
    if v_is_dupe and v_scrap_dupe then
      insert into public.player_state_counters(player_id, scrap) values (v_uid, 1)
      on conflict (player_id) do update set scrap = public.player_state_counters.scrap + 1, updated_at = now();
    end if;

    v_results := v_results || jsonb_build_object(
      'rarity', v_rarity, 'pity', v_pity, 'free', v_this_cost = 0, 'dupe', v_is_dupe);
  end loop;

  update public.prize_series_pity
    set pulls_since_rare = v_p.pulls_since_rare,
        pulls_since_chase = v_p.pulls_since_chase, updated_at = now()
  where player_id = v_uid and series_key = p_series;

  perform public.log_audit(v_uid, 'prize_pull', 'ok');
  return jsonb_build_object('results', v_results,
    'pity_after', jsonb_build_object('rare', v_p.pulls_since_rare, 'chase', v_p.pulls_since_chase));
end;
$$;

-- ---------------------------------------------------------------------------
-- SQL-5 · job_market_generate: зеро-сумная генерация спроса (§3.6 паритет с
--   engine/econ/demand.computeDCat). Было: независимый uniform[0.85,1.30] на
--   категорию → систематическая +7.5%/нед инфляция (нарушает §3.11/EC1), пол
--   0.85 вместо канона 0.70. Стало: один сид (town,week,cat) → raw uniform[-1,1]
--   → центрирование (Σ отклонений=0) → spread ±15…30% ×1.7 → clamp[0.70,1.30]
--   → ре-нормировка к зеро-сумме. Остальная логика (market_weeks/contest) — как в 0008.
-- ---------------------------------------------------------------------------
create or replace function public.job_market_generate()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r_town record; v_week int; v_start timestamptz; v_seed text;
  v_cats jsonb; v_gen int := 0;
  v_cat_arr text[]; v_n int; k int; iter int;
  v_raw numeric[]; v_d numeric[]; v_mean numeric; v_spread numeric;
  v_residual numeric; v_free_cnt int; v_share numeric;
  v_demand jsonb;
  c_floor constant numeric := 0.70;   -- D_CAT_FLOOR
  c_ceil  constant numeric := 1.30;   -- D_CAT_CEIL
  c_smin  constant numeric := 0.15;   -- DEMAND_SPREAD_MIN
  c_smax  constant numeric := 0.30;   -- DEMAND_SPREAD_MAX
  c_gain  constant numeric := 1.7;    -- DEMAND_SPREAD_GAIN
begin
  v_start := date_trunc('week', now());  -- Пн 00:00 текущей недели
  for r_town in select id, current_week_index from public.towns loop
    v_week := r_town.current_week_index;
    if not public.claim_anchor(r_town.id, v_week, 'A0') then continue; end if;
    perform public.ensure_calendar(r_town.id, v_week, v_start);

    -- Категории спроса (из конфига; дефолт — 4 меты econ/demand).
    v_cats := coalesce(public.config_doc(
      (select id from public.farms where town_id = r_town.id limit 1), 'demand')
      ->'categories', '["cat_grill","cat_bakery","cat_drinks","cat_produce"]'::jsonb);
    v_cat_arr := array(select jsonb_array_elements_text(v_cats));
    v_n := coalesce(array_length(v_cat_arr, 1), 0);
    v_demand := '{}'::jsonb;

    if v_n > 0 then
      -- 1. Сырые тяготения uniform[-1,1] (детерминированно по сид town:week:cat).
      v_raw := array_fill(0::numeric, array[v_n]);
      for k in 1..v_n loop
        v_seed := r_town.id::text || ':' || v_week::text || ':' || v_cat_arr[k];
        v_raw[k] := 2 * public.rand01(v_seed) - 1;
      end loop;
      -- 2. Центрирование к нулю (зеро-сумность §3.11).
      select avg(x) into v_mean from unnest(v_raw) as x;
      -- 3. Масштаб ±15…30% (×1.7) и клип в [0.70,1.30].
      v_d := array_fill(0::numeric, array[v_n]);
      for k in 1..v_n loop
        v_seed := r_town.id::text || ':' || v_week::text || ':' || v_cat_arr[k];
        v_spread := c_smin + public.rand01(v_seed || ':spread') * (c_smax - c_smin);
        v_d[k] := least(c_ceil, greatest(c_floor,
          round(1 + (v_raw[k] - v_mean) * v_spread * c_gain, 4)));
      end loop;
      -- 4. Ре-нормировка после клипа: цель Σ = N (mean 1), остаток на не-зажатые.
      for iter in 1..24 loop
        select v_n - coalesce(sum(x), 0) into v_residual from unnest(v_d) as x;
        exit when abs(v_residual) < 1e-9;
        select count(*) into v_free_cnt from unnest(v_d) as x
          where x > c_floor + 1e-9 and x < c_ceil - 1e-9;
        exit when v_free_cnt = 0;
        v_share := v_residual / v_free_cnt;
        for k in 1..v_n loop
          if v_d[k] > c_floor + 1e-9 and v_d[k] < c_ceil - 1e-9 then
            v_d[k] := least(c_ceil, greatest(c_floor, v_d[k] + v_share));
          end if;
        end loop;
      end loop;
      for k in 1..v_n loop
        v_demand := v_demand || jsonb_build_object(v_cat_arr[k], round(v_d[k], 2));
      end loop;
    end if;

    insert into public.market_weeks(town_id, week_index, demand, theme_key)
    values (r_town.id, v_week, v_demand,
            'theme_' || (1 + floor(public.rand01(r_town.id::text||v_week::text||':theme')*8)::int))
    on conflict (town_id, week_index) do nothing;

    -- Конкурс недели (entry Пн→Пт, voting Сб→Вс12, judged Вс12+).
    insert into public.contests(town_id, week_index, contest_key, entry_open, entry_close,
      voting_open, voting_close, announce_at, state)
    values (r_town.id, v_week, 'ct_pie_week',
      v_start, v_start + interval '4 days 23 hours 59 minutes',
      v_start + interval '5 days', v_start + interval '6 days 12 hours',
      v_start + interval '6 days 12 hours 5 minutes', 'entry')
    on conflict (town_id, week_index, contest_key) do nothing;

    v_gen := v_gen + 1;
  end loop;
  return jsonb_build_object('towns_generated', v_gen);
end;
$$;
