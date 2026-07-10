-- ============================================================================
-- 0012_server_gameplay.sql — Sunnyside · Серверные геймплейные мутации (RPC).
-- Домен «srv-gameplay»: мутации, которых не было как Postgres SECURITY DEFINER
-- RPC (часть жила только в Edge/handlers.ts, часть — вообще отсутствовала).
--
-- Реализует 20-backend.md §3.4.1 (горячий путь RPC) для:
--   building_upgrade, research_start, staff_assign, staff_upgrade,
--   fair_stall_set, fair_collect, shift_submit (серверный пересчёт чека),
--   contest_enter, contest_vote, expedition_start, expedition_collect,
--   mail_order, mail_collect, mail_speedup, forage_collect, fish_cast,
--   recipe_experiment (секретки, 06-recipes §4.5), rename_pet, affection_gift.
--
-- Инварианты (как в 0006):
--   • Все RPC — SECURITY DEFINER, set search_path = public (владелец обходит RLS
--     и валидирует сам). Клиентские числа игнорируются — сервер считает от
--     исходного состояния (§3.7).
--   • Движение валют — ТОЛЬКО через ledger_write (триггер-гард §3.2.11 не даёт
--     уйти в минус). Инвентарь — только через inv_add/inv_remove (атомарно).
--   • Валидации, цены, тайминги, кэпы — из game_configs / каталожных таблиц
--     через config_doc(farm, ns); coalesce-фолбэки — гипотезы 20-backend §4.2,
--     финальные числа централизует 14-economy.md. Хардкода бизнес-констант нет.
--   • Идемпотентность мутаций — по x-request-id на уровне шлюза (withIdem);
--     affection_gift дополнительно недельно-идемпотентен через idempotency
--     (scope='affection_gift', key=player:animal:week) — канон §977.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Каталог секреток-экспериментов (06-recipes §4.5) как конфиг-неймспейс.
--    Ключ — нормализованная (сортированная) комбинация «item_key:qty», значение —
--    открываемый рецепт. Механика generic, каталог — данные (расширяется без кода).
-- ---------------------------------------------------------------------------
do $$
declare v_ver uuid;
begin
  select id into v_ver from public.config_versions
    where id = '00000000-0000-0000-0000-0000000c0f19' or state = 'active'
    order by (id = '00000000-0000-0000-0000-0000000c0f19') desc, activated_at desc nulls last
    limit 1;
  if v_ver is null then
    raise notice 'no active config version — skip secrets/experiment seed';
    return;
  end if;

  -- Секретки: нормализованная комбинация → рецепт (06-recipes §4.5, подмножество).
  insert into public.game_configs(namespace, version_id, doc)
  values ('secrets', v_ver, $json$
  {
    "fallback_dish": {"item_key": "kitchen_sink_special", "item_class": "dish", "quality": 1},
    "experiment_time_min": 15,
    "combos": {
      "bacon:1+milk:3":            {"recipe_key": "recipe_bacon_shake",        "source": "secret"},
      "home_lemonade:1+pickles:1": {"recipe_key": "recipe_pickle_lemonade",    "source": "secret"},
      "bacon:3+coffee_bean:1":     {"recipe_key": "recipe_coffee_glazed_bacon","source": "secret"},
      "cherry:2+cream_soda:1":     {"recipe_key": "recipe_cherry_cola_float",  "source": "secret"},
      "chicken:3+honey:1":         {"recipe_key": "recipe_honey_fried_chicken","source": "secret"}
    }
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();

  -- Прогрессия (апгрейды/исследования/стафф) — опорные числа; фолбэки в коде
  -- совпадают с этими, финал — 13-progression.md / 14-economy.md.
  insert into public.game_configs(namespace, version_id, doc)
  values ('progression', v_ver, $json$
  {
    "building": {"base_cost_bucks": 100, "base_upgrade_min": 30, "level_max": 10},
    "research": {"default_cost_points": 1, "default_time_min": 60,
                 "second_slot_cost_dimes": 40},
    "staff":    {"upgrade_token_base": 1, "level_max": 10},
    "affection": {"gift_amount": 5, "max": 100},
    "forage":   {"per_type_per_day": 8},
    "fishing":  {"legendary_pct": 2, "rare_pct": 15}
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- 1. Общий контекст фермы игрока (farm, town, week) — internal-хелпер.
-- ---------------------------------------------------------------------------
create or replace function public.gp_farm_ctx(
  out o_farm uuid, out o_town uuid, out o_week int)
returns record language sql stable security definer set search_path = public
as $$
  select f.id, f.town_id, coalesce(t.current_week_index, 0)
  from public.farms f
  left join public.towns t on t.id = f.town_id
  where f.player_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 2. building_upgrade — House-гейт нет отдельной таблицы; серверный таймер.
--    Ленивая финализация готового апгрейда (нет отдельного финализатора-джобы).
-- ---------------------------------------------------------------------------
create or replace function public.building_upgrade(p_building_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_b public.buildings; v_doc jsonb;
  v_cost bigint; v_min int; v_max int; v_next int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  select * into v_b from public.buildings
    where farm_id = v_farm and building_key = p_building_key for update;
  if v_b.id is null then
    perform public.log_audit(auth.uid(), 'building_upgrade', 'rejected', 'no_building');
    raise exception 'no_building';
  end if;

  -- Ленивая финализация ранее оплаченного апгрейда, если срок настал.
  if v_b.upgrade_ready_at is not null and now() >= v_b.upgrade_ready_at then
    update public.buildings
      set level = least(level + 1, 10), upgrade_ready_at = null, updated_at = now()
    where id = v_b.id returning * into v_b;
  end if;

  if v_b.upgrade_ready_at is not null then
    perform public.log_audit(auth.uid(), 'building_upgrade', 'rejected', 'in_progress');
    raise exception 'upgrade_in_progress';
  end if;

  v_doc := coalesce(public.config_doc(v_farm,'progression')->'building', '{}'::jsonb);
  v_max := coalesce((public.config_doc(v_farm,'caps')->>'building_level_max')::int,
                    (v_doc->>'level_max')::int, 10);
  if v_b.level >= v_max then
    perform public.log_audit(auth.uid(), 'building_upgrade', 'rejected', 'max_level');
    raise exception 'max_level';
  end if;

  v_next := v_b.level + 1;
  v_cost := coalesce((v_doc->>'base_cost_bucks')::bigint, 100) * v_next;
  v_min  := coalesce((v_doc->>'base_upgrade_min')::int, 30) * v_next;

  -- Оплата bucks через леджер (гард отклонит нехватку).
  perform public.ledger_write(auth.uid(), 'bucks', -v_cost, 'building_upgrade',
    'buildings', v_b.id::text);

  update public.buildings
    set upgrade_ready_at = now() + make_interval(mins => v_min), updated_at = now()
  where id = v_b.id returning * into v_b;

  perform public.log_audit(auth.uid(), 'building_upgrade', 'ok');
  return jsonb_build_object('building', v_b.id, 'level', v_b.level,
    'upgrade_ready_at', v_b.upgrade_ready_at, 'cost_bucks', v_cost);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. research_start — тратит Know-How Points (НЕ валюта, K11), ставит таймер.
-- ---------------------------------------------------------------------------
create or replace function public.research_start(p_node_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_kh public.player_know_how; v_doc jsonb; v_node jsonb;
  v_cost bigint; v_min int; v_branch text; v_active int; v_prereq jsonb;
  v_missing text; v_node_id uuid;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  if exists (select 1 from public.know_how_nodes
             where player_id = auth.uid() and node_key = p_node_key) then
    perform public.log_audit(auth.uid(), 'research_start', 'rejected', 'already');
    raise exception 'node_exists';
  end if;

  v_doc  := coalesce(public.config_doc(v_farm,'progression')->'research', '{}'::jsonb);
  v_node := coalesce(public.config_doc(v_farm,'know_how')->p_node_key, '{}'::jsonb);
  v_branch := coalesce(v_node->>'branch', 'kh_agronomy');
  v_cost := coalesce((v_node->>'cost')::bigint, (v_doc->>'default_cost_points')::bigint, 1);
  v_min  := coalesce((v_node->>'time_min')::int, (v_doc->>'default_time_min')::int, 60);

  -- Предки изучены (если каталог задаёт prereq — иначе гейта нет).
  v_prereq := coalesce(v_node->'prereq', '[]'::jsonb);
  select e.v into v_missing
    from jsonb_array_elements_text(v_prereq) as e(v)
    where not exists (
      select 1 from public.know_how_nodes
      where player_id = auth.uid() and node_key = e.v and state = 'done')
    limit 1;
  if v_missing is not null then
    perform public.log_audit(auth.uid(), 'research_start', 'rejected', 'prereq');
    raise exception 'prereq_locked:%', v_missing;
  end if;

  insert into public.player_know_how(player_id) values (auth.uid())
    on conflict (player_id) do nothing;
  select * into v_kh from public.player_know_how where player_id = auth.uid() for update;

  select count(*) into v_active from public.know_how_nodes
    where player_id = auth.uid() and state = 'researching';
  if v_active >= v_kh.active_slots then
    perform public.log_audit(auth.uid(), 'research_start', 'rejected', 'no_slot');
    raise exception 'no_research_slot';
  end if;

  if v_kh.points < v_cost then
    perform public.log_audit(auth.uid(), 'research_start', 'rejected', 'no_points');
    raise exception 'insufficient_points';
  end if;

  update public.player_know_how
    set points = points - v_cost, spent_points = spent_points + v_cost, updated_at = now()
  where player_id = auth.uid();

  insert into public.know_how_nodes(player_id, branch, node_key, state, research_ready_at)
  values (auth.uid(), v_branch, p_node_key, 'researching',
          now() + make_interval(mins => v_min))
  returning id into v_node_id;

  perform public.log_audit(auth.uid(), 'research_start', 'ok');
  return jsonb_build_object('node', v_node_id, 'branch', v_branch,
    'cost_points', v_cost, 'ready_at', now() + make_interval(mins => v_min));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. staff_assign — назначить нанятого стаффа на пост (заменяет прежнего).
-- ---------------------------------------------------------------------------
create or replace function public.staff_assign(p_staff_key text, p_post text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_valid jsonb; v_id uuid;
begin
  if not exists (select 1 from public.staff_roster
                 where player_id = auth.uid() and staff_key = p_staff_key) then
    perform public.log_audit(auth.uid(), 'staff_assign', 'rejected', 'not_hired');
    raise exception 'staff_not_hired';
  end if;

  -- Пост валиден (каталог, фолбэк — 4 канон-поста §8 п.6).
  v_valid := coalesce(
    public.config_doc((select id from public.farms where player_id = auth.uid()),'staff')->'posts',
    '["kitchen","field","counter","yard"]'::jsonb);
  if not (v_valid ? p_post) then
    perform public.log_audit(auth.uid(), 'staff_assign', 'rejected', 'bad_post');
    raise exception 'invalid_post:%', p_post;
  end if;

  -- Один стафф — на один пост: снять его с прежнего поста, затем занять целевой.
  delete from public.staff_assignments
    where player_id = auth.uid() and staff_key = p_staff_key and post <> p_post;

  insert into public.staff_assignments(player_id, staff_key, post)
  values (auth.uid(), p_staff_key, p_post)
  on conflict (player_id, post)
  do update set staff_key = excluded.staff_key, assigned_at = now()
  returning id into v_id;

  perform public.log_audit(auth.uid(), 'staff_assign', 'ok');
  return jsonb_build_object('assignment', v_id, 'staff_key', p_staff_key, 'post', p_post);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. staff_upgrade — жетоны (staff_tokens, НЕ валюта, K11). Цена растёт с уровнем.
-- ---------------------------------------------------------------------------
create or replace function public.staff_upgrade(p_staff_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_lvl int; v_next int; v_cost bigint; v_max int; v_doc jsonb; v_tok bigint;
begin
  select id into v_farm from public.farms where player_id = auth.uid();

  select level into v_lvl from public.staff_roster
    where player_id = auth.uid() and staff_key = p_staff_key for update;
  if v_lvl is null then
    perform public.log_audit(auth.uid(), 'staff_upgrade', 'rejected', 'not_hired');
    raise exception 'staff_not_hired';
  end if;

  v_doc  := coalesce(public.config_doc(v_farm,'progression')->'staff', '{}'::jsonb);
  v_max  := coalesce((v_doc->>'level_max')::int, 10);
  if v_lvl >= v_max then
    perform public.log_audit(auth.uid(), 'staff_upgrade', 'rejected', 'max_level');
    raise exception 'max_level';
  end if;

  v_next := v_lvl + 1;
  v_cost := coalesce((v_doc->>'upgrade_token_base')::bigint, 1) * v_next;

  insert into public.player_state_counters(player_id) values (auth.uid())
    on conflict (player_id) do nothing;
  select staff_tokens into v_tok from public.player_state_counters
    where player_id = auth.uid() for update;
  if coalesce(v_tok, 0) < v_cost then
    perform public.log_audit(auth.uid(), 'staff_upgrade', 'rejected', 'no_tokens');
    raise exception 'insufficient_tokens';
  end if;

  update public.player_state_counters
    set staff_tokens = staff_tokens - v_cost, updated_at = now()
  where player_id = auth.uid();

  update public.staff_roster set level = v_next
    where player_id = auth.uid() and staff_key = p_staff_key;

  perform public.log_audit(auth.uid(), 'staff_upgrade', 'ok');
  return jsonb_build_object('staff_key', p_staff_key, 'level', v_next, 'cost_tokens', v_cost);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. fair_stall_set — выложить лоты (резерв стока из склада, окно ярмарки).
--    Серверная замена edge-fairList: сток списывается атомарно (античит
--    «продажа несуществующего»), клиентские числа не влияют на резерв.
-- ---------------------------------------------------------------------------
create or replace function public.fair_stall_set(p_lots jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_town uuid; v_week int; v_cal record; v_stall public.fair_stalls;
  v_lot record; v_listed jsonb := '[]'::jsonb;
begin
  select o_farm, o_town, o_week into v_farm, v_town, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  -- Окно ярмарки текущей недели открыто?
  select fair_open, fair_close into v_cal from public.server_calendars
    where town_id = v_town and week_index = v_week;
  if v_cal.fair_open is not null
     and (now() < v_cal.fair_open or now() >= v_cal.fair_close) then
    perform public.log_audit(auth.uid(), 'fair_stall_set', 'rejected', 'window_closed');
    raise exception 'fair_window_closed';
  end if;

  insert into public.fair_stalls(player_id, town_id, week_index)
  values (auth.uid(), v_town, v_week)
  on conflict (player_id, week_index)
  do update set town_id = excluded.town_id, updated_at = now();
  select * into v_stall from public.fair_stalls
    where player_id = auth.uid() and week_index = v_week;

  for v_lot in
    select (e.v->>'slot_index')::int as slot_index, e.v->>'item_key' as item_key,
           coalesce((e.v->>'quality')::int, 0) as quality,
           coalesce((e.v->>'qty')::int, 0) as qty,
           coalesce((e.v->>'price')::bigint, 0) as price
    from jsonb_array_elements(coalesce(p_lots, '[]'::jsonb)) as e(v)
  loop
    if v_lot.qty <= 0 then continue; end if;
    if v_lot.slot_index < 0 or v_lot.slot_index >= v_stall.display_slots then continue; end if;
    -- Резервируем сток: не хватило — тихо пропускаем (как harvest B4).
    if not public.inv_remove(v_farm, v_lot.item_key, v_lot.qty, v_lot.quality) then
      continue;
    end if;
    insert into public.fair_lots(stall_id, slot_index, item_key, quality, qty_listed, qty_sold, price)
    values (v_stall.id, v_lot.slot_index, v_lot.item_key, v_lot.quality::smallint,
            v_lot.qty, 0, v_lot.price)
    on conflict (stall_id, slot_index)
    do update set item_key = excluded.item_key, quality = excluded.quality,
                  qty_listed = excluded.qty_listed, qty_sold = 0,
                  price = excluded.price, updated_at = now();
    v_listed := v_listed || jsonb_build_object(
      'slot', v_lot.slot_index, 'item_key', v_lot.item_key, 'qty', v_lot.qty);
  end loop;

  perform public.log_audit(auth.uid(), 'fair_stall_set', 'ok');
  return jsonb_build_object('stall_id', v_stall.id, 'listed', v_listed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. fair_collect — свернуть прилавок: вернуть непроданный резерв на склад.
--    Выручка кредитуется пассивом (job_fair_tick), поэтому здесь — только
--    возврат нераспроданного стока. Идемпотентно: лоты удаляются после возврата.
-- ---------------------------------------------------------------------------
create or replace function public.fair_collect()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_week int; v_stall uuid; v_lot record;
        v_class text; v_returned jsonb := '[]'::jsonb; v_left int;
begin
  select o_farm, o_week into v_farm, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  select id into v_stall from public.fair_stalls
    where player_id = auth.uid() and week_index = v_week;
  if v_stall is null then
    return jsonb_build_object('returned', v_returned);  -- нечего сворачивать
  end if;

  for v_lot in
    select * from public.fair_lots where stall_id = v_stall for update
  loop
    v_left := v_lot.qty_listed - v_lot.qty_sold;
    if v_left > 0 then
      select item_class into v_class from public.inventory
        where farm_id = v_farm and item_key = v_lot.item_key limit 1;
      perform public.inv_add(v_farm, v_lot.item_key, coalesce(v_class, 'crop'),
        v_left, coalesce(v_lot.quality, 0));
      v_returned := v_returned || jsonb_build_object(
        'item_key', v_lot.item_key, 'qty', v_left, 'quality', coalesce(v_lot.quality, 0));
    end if;
    delete from public.fair_lots where id = v_lot.id;
  end loop;

  perform public.log_audit(auth.uid(), 'fair_collect', 'ok');
  return jsonb_build_object('returned', v_returned);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. shift_submit — итог смены у прилавка. СЕРВЕР реконструирует Tips/FairScore/
--    tickets/FP из фактических пассивных продаж (fair_sales), игнорируя клиента
--    (§3.7 / R10). Лимит ≤3 смены/окно + кулдаун 2ч; недельный кэп 🎟.
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
-- 9. contest_enter / contest_vote (§3.2.7). Античит накрутки — unique-гарды.
-- ---------------------------------------------------------------------------
create or replace function public.contest_enter(p_contest_key text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_town uuid; v_week int; v_c public.contests; v_item text; v_id uuid;
begin
  select o_farm, o_town, o_week into v_farm, v_town, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  select * into v_c from public.contests
    where town_id = v_town and week_index = v_week and contest_key = p_contest_key;
  if v_c.id is null then raise exception 'no_contest'; end if;
  if v_c.entry_open is not null
     and (now() < v_c.entry_open or now() >= v_c.entry_close) then
    perform public.log_audit(auth.uid(), 'contest_enter', 'rejected', 'window_closed');
    raise exception 'entry_window_closed';
  end if;

  -- Предмет заявки должен быть на складе (не потребляется — витрина).
  v_item := p_payload->>'item_key';
  if v_item is not null and not exists (
     select 1 from public.inventory where farm_id = v_farm and item_key = v_item and qty >= 1) then
    perform public.log_audit(auth.uid(), 'contest_enter', 'rejected', 'no_item');
    raise exception 'no_item';
  end if;

  begin
    insert into public.contest_entries(contest_id, player_id, payload)
    values (v_c.id, auth.uid(), p_payload)
    returning id into v_id;
  exception when unique_violation then
    perform public.log_audit(auth.uid(), 'contest_enter', 'rejected', 'already_entered');
    raise exception 'already_entered';
  end;

  perform public.log_audit(auth.uid(), 'contest_enter', 'ok');
  return jsonb_build_object('entry', v_id);
end;
$$;

create or replace function public.contest_vote(p_contest_id uuid, p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_c public.contests; v_owner uuid;
begin
  select * into v_c from public.contests where id = p_contest_id;
  if v_c.id is null then raise exception 'no_contest'; end if;
  if v_c.voting_open is not null
     and (now() < v_c.voting_open or now() >= v_c.voting_close) then
    perform public.log_audit(auth.uid(), 'contest_vote', 'rejected', 'window_closed');
    raise exception 'voting_window_closed';
  end if;

  select player_id into v_owner from public.contest_entries
    where id = p_entry_id and contest_id = p_contest_id;
  if v_owner is null then raise exception 'no_entry'; end if;
  if v_owner = auth.uid() then
    perform public.log_audit(auth.uid(), 'contest_vote', 'rejected', 'self_vote');
    raise exception 'self_vote';
  end if;

  begin
    insert into public.contest_votes(contest_id, voter_id, entry_id)
    values (p_contest_id, auth.uid(), p_entry_id);
  exception when unique_violation then
    perform public.log_audit(auth.uid(), 'contest_vote', 'rejected', 'already_voted');
    raise exception 'already_voted';
  end;

  update public.contest_entries set vote_count = coalesce(vote_count, 0) + 1
    where id = p_entry_id;

  perform public.log_audit(auth.uid(), 'contest_vote', 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. expedition_start / expedition_collect (§3.2.3). Детерминированный payload,
--     гарантированный ≥1 ряд лута (P3). Тайминги — из конфига (Gus −%).
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
  insert into public.expeditions(farm_id, state_key, route_slot, departed_at, return_at, payload, collected)
  values (v_farm, p_state_key, v_slot, now(), v_return, v_payload, false)
  returning id into v_id;

  perform public.log_audit(auth.uid(), 'expedition_start', 'ok');
  return jsonb_build_object('expedition', v_id, 'return_at', v_return);
end;
$$;

create or replace function public.expedition_collect(p_exp_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_row jsonb; v_items jsonb := '[]'::jsonb;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  for r in
    select * from public.expeditions
    where id = any(p_exp_ids) and farm_id = v_farm
      and collected = false and now() >= return_at
    for update
  loop
    for v_row in select e.v from jsonb_array_elements(coalesce(r.payload, '[]'::jsonb)) as e(v)
    loop
      perform public.inv_add(v_farm, v_row->>'item_key',
        coalesce(v_row->>'item_class', 'crop'),
        coalesce((v_row->>'qty')::int, 1), coalesce((v_row->>'quality')::int, 1));
      v_items := v_items || v_row;
    end loop;
    update public.expeditions set collected = true where id = r.id;
  end loop;

  perform public.log_audit(auth.uid(), 'expedition_collect', 'ok');
  return jsonb_build_object('items', v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. mail_order / mail_collect / mail_speedup (§3.2.13). Каталог — недельный.
--     Лимиты: ≤5 в пути; Rare3/Decor1/Tools5 в неделю; скип за ◉ (R3, кэп 5).
-- ---------------------------------------------------------------------------
create or replace function public.mail_order(p_item_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_town uuid; v_week int; v_caps jsonb; v_transit_max int;
  v_hours numeric[]; v_cat jsonb; v_item jsonb; v_rarity text; v_price bigint;
  v_limits jsonb; v_limit int; v_used int; v_deliver timestamptz; v_id uuid;
  v_lo numeric; v_hi numeric; v_cnt int;
begin
  select o_farm, o_town, o_week into v_farm, v_town, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  v_caps := public.config_doc(v_farm,'caps');
  v_transit_max := coalesce((v_caps->>'mail_in_transit_max')::int, 5);

  select count(*) into v_cnt from public.mail_orders
    where player_id = auth.uid() and collected = false;
  if v_cnt >= v_transit_max then
    perform public.log_audit(auth.uid(), 'mail_order', 'rejected', 'transit_cap');
    raise exception 'mail_transit_cap';
  end if;

  -- Позиция в недельном каталоге города (rarity/price — оттуда, античит цены).
  select items into v_cat from public.mail_catalog_weeks
    where town_id = v_town and week_index = v_week;
  select e.v into v_item from jsonb_array_elements(coalesce(v_cat, '[]'::jsonb)) as e(v)
    where e.v->>'item_key' = p_item_key limit 1;
  if v_cat is not null and v_item is null then
    perform public.log_audit(auth.uid(), 'mail_order', 'rejected', 'not_in_catalog');
    raise exception 'not_in_catalog';
  end if;
  v_rarity := coalesce(v_item->>'rarity', 'tools');
  v_price  := coalesce((v_item->>'price')::bigint, 0);

  -- Недельный лимит по классу редкости (Rare3/Decor1/Tools5).
  v_limits := coalesce(v_caps->'mail_weekly_limits', '{}'::jsonb);
  v_limit := coalesce((v_limits->>v_rarity)::int, 999);
  select count(*) into v_used from public.mail_orders mo
    where mo.player_id = auth.uid()
      and mo.ordered_at >= now() - interval '7 days'
      and exists (
        select 1 from jsonb_array_elements(coalesce(v_cat, '[]'::jsonb)) as c(v)
        where c.v->>'item_key' = mo.item_key and coalesce(c.v->>'rarity','tools') = v_rarity);
  if v_used >= v_limit then
    perform public.log_audit(auth.uid(), 'mail_order', 'rejected', 'weekly_limit');
    raise exception 'mail_weekly_limit:%', v_rarity;
  end if;

  -- Оплата bucks (если каталог задал цену) через леджер.
  if v_price > 0 then
    perform public.ledger_write(auth.uid(), 'bucks', -v_price, 'mail_order', 'mail', p_item_key);
  end if;

  -- deliver_at = +8..20ч (детерминированный разброс от игрока/предмета/времени).
  v_hours := array[
    coalesce((public.config_doc(v_farm,'timers')->'mail_deliver_hours'->>0)::numeric, 8),
    coalesce((public.config_doc(v_farm,'timers')->'mail_deliver_hours'->>1)::numeric, 20)];
  v_lo := v_hours[1]; v_hi := v_hours[2];
  v_deliver := now() + make_interval(
    mins => ((v_lo + public.rand01(auth.uid()::text || p_item_key || now()::text) * (v_hi - v_lo)) * 60)::int);

  insert into public.mail_orders(player_id, item_key, ordered_at, deliver_at, delivered, collected)
  values (auth.uid(), p_item_key, now(), v_deliver, false, false)
  returning id into v_id;

  perform public.log_audit(auth.uid(), 'mail_order', 'ok');
  return jsonb_build_object('order', v_id, 'deliver_at', v_deliver);
end;
$$;

create or replace function public.mail_collect(p_order_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_items jsonb := '[]'::jsonb;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  for r in
    select * from public.mail_orders
    where id = any(p_order_ids) and player_id = auth.uid()
      and collected = false and now() >= deliver_at
    for update
  loop
    perform public.inv_add(v_farm, r.item_key, 'consumable', 1, 0);
    update public.mail_orders set delivered = true, collected = true where id = r.id;
    v_items := v_items || to_jsonb(r.item_key);
  end loop;

  perform public.log_audit(auth.uid(), 'mail_collect', 'ok');
  return jsonb_build_object('items', v_items);
end;
$$;

create or replace function public.mail_speedup(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_o public.mail_orders; v_caps jsonb; v_cap int;
        v_hours_per numeric; v_remaining numeric; v_dimes int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();

  select * into v_o from public.mail_orders
    where id = p_order_id and player_id = auth.uid() and collected = false for update;
  if v_o.id is null then raise exception 'no_order'; end if;

  if now() >= v_o.deliver_at then
    return jsonb_build_object('deliver_at', v_o.deliver_at, 'dimes', 0);  -- уже готово
  end if;

  v_caps := public.config_doc(v_farm,'caps');
  v_cap  := coalesce((v_caps->>'mail_speedup_dime_cap')::int, 5);
  v_hours_per := coalesce((v_caps->>'mail_speedup_hours_per_dime')::numeric, 4);  -- R3: ◉1=4ч

  v_remaining := extract(epoch from (v_o.deliver_at - now())) / 3600.0;
  v_dimes := least(v_cap, ceil(v_remaining / v_hours_per)::int);
  if v_dimes < 1 then v_dimes := 1; end if;

  perform public.ledger_write(auth.uid(), 'dimes', -v_dimes, 'mail_speedup', 'mail', p_order_id::text);

  update public.mail_orders set deliver_at = now(), delivered = true where id = v_o.id;

  perform public.log_audit(auth.uid(), 'mail_speedup', 'ok');
  return jsonb_build_object('deliver_at', now(), 'dimes', v_dimes);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. forage_collect (§3.2.13). Атомарный декремент пула (гонка F6 → мягко),
--     дневной кэп по типу точки. Серверный дроп (античит).
-- ---------------------------------------------------------------------------
create or replace function public.forage_collect(p_point_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_pt public.foraging_points; v_cap int; v_gd date;
        v_cnt int; v_dec int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  select * into v_pt from public.foraging_points where id = p_point_id;
  if v_pt.id is null then raise exception 'no_point'; end if;

  v_cap := coalesce((public.config_doc(v_farm,'progression')->'forage'->>'per_type_per_day')::int,
                    (public.config_doc(v_farm,'caps')->>'forage_per_type_per_day')::int, 8);
  v_gd  := public.game_day();
  select count into v_cnt from public.forage_daily
    where player_id = auth.uid() and point_type = v_pt.point_type and game_day = v_gd;
  if coalesce(v_cnt, 0) >= v_cap then
    perform public.log_audit(auth.uid(), 'forage_collect', 'rejected', 'daily_cap');
    raise exception 'daily_cap';
  end if;

  -- Атомарный декремент: WHERE pool_remaining>0 (гонка → 0 строк = мягко «уже собрали»).
  update public.foraging_points set pool_remaining = pool_remaining - 1, updated_at = now()
    where id = p_point_id and pool_remaining > 0;
  get diagnostics v_dec = row_count;
  if v_dec = 0 then
    return jsonb_build_object('collected', false, 'reason', 'already_depleted');
  end if;

  insert into public.forage_daily(player_id, point_type, game_day, count)
  values (auth.uid(), v_pt.point_type, v_gd, 1)
  on conflict (player_id, point_type, game_day)
  do update set count = public.forage_daily.count + 1;

  perform public.inv_add(v_farm, 'forage_' || v_pt.point_type, 'crop', 1, 1);
  perform public.log_audit(auth.uid(), 'forage_collect', 'ok');
  return jsonb_build_object('collected', true, 'item', 'forage_' || v_pt.point_type);
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. fish_cast (§3.2.13). Серверный RNG редкости с гарантированным Common (P3).
-- ---------------------------------------------------------------------------
create or replace function public.fish_cast()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_doc jsonb; v_leg numeric; v_rare numeric; v_roll numeric; v_rarity text; v_item text;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  v_doc  := coalesce(public.config_doc(v_farm,'progression')->'fishing', '{}'::jsonb);
  v_leg  := coalesce((v_doc->>'legendary_pct')::numeric, 2) / 100.0;
  v_rare := coalesce((v_doc->>'rare_pct')::numeric, 15) / 100.0;

  v_roll := random();
  v_rarity := case when v_roll < v_leg then 'legendary'
                   when v_roll < v_leg + v_rare then 'rare'
                   else 'common' end;  -- остаток — гарантированный Common (P3)
  v_item := 'fish_' || v_rarity;

  perform public.inv_add(v_farm, v_item, 'crop', 1, case when v_rarity = 'common' then 1 else 3 end);
  perform public.log_audit(auth.uid(), 'fish_cast', 'ok');
  return jsonb_build_object('catch', jsonb_build_object('item_key', v_item, 'rarity', v_rarity));
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. recipe_experiment (§3.2.10 / 06-recipes §4.5). RNG-открытие секретки;
--     провала нет (P3) → Kitchen Sink Special. Дневной кэп в boosters_daily.
-- ---------------------------------------------------------------------------
create or replace function public.recipe_experiment(p_inputs jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_sec jsonb; v_cap int; v_used int; v_gd date;
  v_key text; v_hit jsonb; v_recipe text; v_src text; v_fb jsonb; v_in record;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  v_sec := coalesce(public.config_doc(v_farm,'secrets'), '{}'::jsonb);
  v_cap := coalesce((public.config_doc(v_farm,'caps')->>'experiment_per_day')::int, 1);  -- 1/день (§3.5)
  v_gd  := public.game_day();

  -- Дневной кэп (boosters_daily).
  insert into public.boosters_daily(player_id, booster_key, game_day, used)
  values (auth.uid(), 'experiment', v_gd, 0)
  on conflict (player_id, booster_key, game_day) do nothing;
  select used into v_used from public.boosters_daily
    where player_id = auth.uid() and booster_key = 'experiment' and game_day = v_gd for update;
  if coalesce(v_used, 0) >= v_cap then
    perform public.log_audit(auth.uid(), 'recipe_experiment', 'rejected', 'daily_cap');
    raise exception 'experiment_daily_cap';
  end if;

  -- Списываем ингредиенты атомарно (нехватка → откат, ничего не съедено).
  for v_in in
    select e.v->>'item_key' as item_key, coalesce((e.v->>'qty')::int, 1) as qty
    from jsonb_array_elements(coalesce(p_inputs, '[]'::jsonb)) as e(v)
  loop
    if v_in.item_key is null or v_in.qty <= 0 then continue; end if;
    if not public.inv_remove(v_farm, v_in.item_key, v_in.qty, 0) then
      perform public.log_audit(auth.uid(), 'recipe_experiment', 'rejected', 'no_input');
      raise exception 'insufficient_input:%', v_in.item_key;
    end if;
  end loop;

  update public.boosters_daily set used = used + 1
    where player_id = auth.uid() and booster_key = 'experiment' and game_day = v_gd;

  -- Нормализованный ключ комбинации: сортированные «item_key:qty».
  select string_agg(elem, '+' order by elem) into v_key from (
    select (e.v->>'item_key') || ':' || coalesce(e.v->>'qty','1') as elem
    from jsonb_array_elements(coalesce(p_inputs, '[]'::jsonb)) as e(v)
  ) s;

  v_hit := v_sec->'combos'->coalesce(v_key, '');
  if v_hit is not null and v_hit ? 'recipe_key' then
    v_recipe := v_hit->>'recipe_key';
    v_src := coalesce(v_hit->>'source', 'secret');
    -- Открыть рецепт (первый в городе получит тег на клиенте; владение не эксклюзив).
    insert into public.recipes(player_id, recipe_key, source)
    values (auth.uid(), v_recipe, v_src)
    on conflict (player_id, recipe_key) do nothing;
    perform public.log_audit(auth.uid(), 'recipe_experiment', 'ok');
    return jsonb_build_object('result', 'discovered', 'recipe_key', v_recipe);
  end if;

  -- Провала нет (P3): Kitchen Sink Special на склад.
  v_fb := coalesce(v_sec->'fallback_dish',
    '{"item_key":"kitchen_sink_special","item_class":"dish","quality":1}'::jsonb);
  perform public.inv_add(v_farm, v_fb->>'item_key', coalesce(v_fb->>'item_class','dish'),
    1, coalesce((v_fb->>'quality')::int, 1));
  perform public.log_audit(auth.uid(), 'recipe_experiment', 'ok');
  return jsonb_build_object('result', 'hint', 'consolation', v_fb->>'item_key');
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. rename_pet (§3.2.12). Владелец; кличка уникальна на ферме (partial unique).
-- ---------------------------------------------------------------------------
create or replace function public.rename_pet(p_animal_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_ok uuid;
begin
  if p_name is null or length(btrim(p_name)) = 0 then raise exception 'bad_name'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  begin
    update public.animals set pet_name = btrim(p_name), updated_at = now()
      where id = p_animal_id and farm_id = v_farm
      returning id into v_ok;
  exception when unique_violation then
    perform public.log_audit(auth.uid(), 'rename_pet', 'rejected', 'name_taken');
    raise exception 'name_taken';
  end;
  if v_ok is null then raise exception 'no_animal'; end if;

  perform public.log_audit(auth.uid(), 'rename_pet', 'ok');
  return jsonb_build_object('ok', true, 'animal', v_ok, 'name', btrim(p_name));
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. affection_gift (§3.2.12). Серверный инкремент; недельная идемпотентность
--     (1 подарок/животное/неделя, ключ player:animal:week — канон §977).
-- ---------------------------------------------------------------------------
create or replace function public.affection_gift(p_animal_id uuid, p_gift_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_week int; v_amt int; v_max int; v_aff int;
begin
  select o_farm, o_week into v_farm, v_week from public.gp_farm_ctx();
  if v_farm is null then raise exception 'no_farm'; end if;

  if not exists (select 1 from public.animals where id = p_animal_id and farm_id = v_farm) then
    raise exception 'no_animal';
  end if;

  -- Недельная идемпотентность: 1 подарок/животное/неделя.
  if not public.claim_idem('affection_gift',
       auth.uid()::text || ':' || p_animal_id::text || ':' || v_week::text) then
    perform public.log_audit(auth.uid(), 'affection_gift', 'rejected', 'weekly_done');
    raise exception 'gift_already_this_week';
  end if;

  -- Списать предмет-подарок со склада.
  if not public.inv_remove(v_farm, p_gift_key, 1, 0) then
    perform public.log_audit(auth.uid(), 'affection_gift', 'rejected', 'no_gift');
    raise exception 'no_gift';
  end if;

  v_amt := coalesce((public.config_doc(v_farm,'progression')->'affection'->>'gift_amount')::int, 5);
  v_max := coalesce((public.config_doc(v_farm,'progression')->'affection'->>'max')::int, 100);

  update public.animals
    set affection = least(v_max, affection + v_amt), updated_at = now()
    where id = p_animal_id and farm_id = v_farm
    returning affection into v_aff;

  perform public.log_audit(auth.uid(), 'affection_gift', 'ok');
  return jsonb_build_object('affection', v_aff);
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. Гранты выполнения (authenticated) + отзыв internal-хелпера у клиента.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'role authenticated missing — skip grants (non-Supabase env)';
    return;
  end if;
  foreach fn in array array[
    'public.building_upgrade(text)','public.research_start(text)',
    'public.staff_assign(text,text)','public.staff_upgrade(text)',
    'public.fair_stall_set(jsonb)','public.fair_collect()',
    'public.shift_submit()','public.contest_enter(text,jsonb)',
    'public.contest_vote(uuid,uuid)','public.expedition_start(text,int)',
    'public.expedition_collect(uuid[])','public.mail_order(text)',
    'public.mail_collect(uuid[])','public.mail_speedup(uuid)',
    'public.forage_collect(uuid)','public.fish_cast()',
    'public.recipe_experiment(jsonb)','public.rename_pet(uuid,text)',
    'public.affection_gift(uuid,text)'
  ] loop
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- gp_farm_ctx — internal-хелпер контекста (только RPC/движок), не клиент.
do $$
begin
  begin
    execute 'revoke all on function public.gp_farm_ctx() from authenticated, anon';
  exception when others then null;
  end;
end $$;
