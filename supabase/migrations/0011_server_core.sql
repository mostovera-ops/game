-- ============================================================================
-- 0011_server_core.sql — Sunnyside · Ядро сервера (srv-core)
--
-- Реализует 20-backend.md §3.4 (read-снапшоты «одна истина, один шлюз»),
--   §3.2.15 (онбординг новичка), §3.4.1 (harvest — качество урожая),
--   §3.8 (централизация балансовых чисел в game_configs).
--
-- Скоуп файла (не пересекается с доменами других srv-агентов):
--   1) БУТСТРАП нового игрока (lazy, идемпотентно): player+farm+стартовый набор
--      (грядки/постройки/станки/курятник+корова/семена T1/рецепт/Bucks) — 18-onboarding §3.1.
--      NB: НЕ триггер на auth.users. Cloud-сьют логинит anon ДО ручного insert player
--      (service_role), поэтому eager-триггер дал бы PK-конфликт и сломал 12/12.
--      Бутстрап вызывается лениво из каждого read-снапшота (advisory-lock от гонки
--      параллельного hydrateAll; повторный вызов — no-op, если player уже есть).
--   2) ВСЕ read-RPC снапшотов, на которые замаплен SupabaseBackendAdapter (net/adapters/
--      supabase.ts READ_RPC): get_farm/get_inventory/get_server_time/get_calendar/get_town/
--      get_demand_board/get_fair_stall/get_contests/get_event/get_progression/get_collections/
--      get_mail_foraging. Возвращают целостный jsonb 1:1 к типам клиента (sunnyside/src/types).
--      Ключи — camelCase (адаптер отдаёт data как есть в стор-сеттеры), времена — EpochMs (ms).
--   3) КАЧЕСТВО урожая при harvest: P(Select) от ухода (полив) — 02-farm §3.6/§4.3.
--   4) Централизация захардкоженных чисел Edge-хендлеров в game_configs
--      (shift tips 10%, forage daily cap 8, expedition crate qty) + правки handlers.ts.
--
-- Все read/harvest — SECURITY DEFINER (владелец обходит RLS, валидирует по auth.uid()).
-- Идемпотентно: create or replace / on conflict do nothing / merge конфигов.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Утилиты времени: timestamptz → EpochMs (ms), и «сейчас» в ms.
-- ---------------------------------------------------------------------------
create or replace function public.to_ms(p timestamptz)
returns bigint language sql stable
as $$ select case when p is null then null else (extract(epoch from p) * 1000)::bigint end $$;

create or replace function public.now_ms()
returns bigint language sql stable
as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- Серверная фаза недели → клиентская (types/calendar WeekPhase).
-- 0007 сид календаря: mon_plan/tue_produce/wed_route/thu_coop/fri_prep/sat_fair/sun_event.
-- Клиент: mon_plan/tue_produce/wed_expedition/thu_push/fri_prep/sat_fair/sun_event.
create or replace function public.client_week_phase(p text)
returns text language sql immutable
as $$ select case p
  when 'wed_route' then 'wed_expedition'
  when 'thu_coop' then 'thu_push'
  else coalesce(p, 'mon_plan') end $$;

-- ---------------------------------------------------------------------------
-- 1. Централизация балансовых чисел (task 4) — мерж в активную версию конфига.
--    0007 уже применён, поэтому патчим doc активной версии (jsonb ||, детерминированно).
-- ---------------------------------------------------------------------------
do $$
declare v_ver uuid;
begin
  select id into v_ver from public.config_versions
    where id = '00000000-0000-0000-0000-0000000c0f19' or state = 'active'
    order by (id = '00000000-0000-0000-0000-0000000c0f19') desc, activated_at desc nulls last
    limit 1;
  if v_ver is null then
    raise notice '0011: no active config version — skip config merge';
    return;
  end if;

  -- 1.1 caps: shift tips 10% + forage дневной кэп 8 (были захардкожены в handlers.ts).
  update public.game_configs
    set doc = doc || jsonb_build_object(
          'shift_tips_pct',  0.10,   -- shiftSubmit: tips = floor(revenue * pct) (14-economy гипотеза)
          'forage_daily_cap', 8),    -- forageCollect: суммарный кэп по типу/день (08-mail-foraging §3.2.3)
        updated_at = now()
    where namespace = 'caps' and version_id = v_ver;

  -- 1.2 drops: базовое кол-во в ящике экспедиции (было qty=1 захардкожено в handlers.ts).
  update public.game_configs
    set doc = doc || jsonb_build_object('expedition_crate_base_qty', 1),
        updated_at = now()
    where namespace = 'drops' and version_id = v_ver;

  -- 1.3 harvest_quality: формула P(Select) урожая (02-farm §3.6/§4.3). Аддитивна, кап 90%.
  insert into public.game_configs(namespace, version_id, doc) values ('harvest_quality', v_ver, $json$
  {
    "base_pct": 0.10,
    "water_bonus_pct": 0.15,
    "cap_pct": 0.90,
    "normal_quality": 1,
    "select_quality": 2
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();

  -- 1.4 onboarding: стартовый набор новичка (18-onboarding §3.1). Значения — параметры
  --     баланса в БД (единый источник). Структурно паритет с локальным адаптером
  --     (net/local/world.ts starter*): 8 построек, grill/oven/churn, курица+корова, 6 грядок,
  --     кошелёк 1000/40. Семена T1 + стартовый рецепт — из 18-onboarding.
  --     (18-onboarding §3.1 приводит $150/◉5 как нарративную цифру FTUE; здесь взят
  --      паритет с образцом бизнес-правил — локальным адаптером; число тривиально меняется тут.)
  insert into public.game_configs(namespace, version_id, doc) values ('onboarding', v_ver, $json$
  {
    "start_bucks": 1000,
    "start_dimes": 40,
    "plots": 6,
    "buildings": ["bld_house","bld_kitchen","bld_diner","bld_barn","bld_coop","bld_garage","bld_silo","bld_icehouse"],
    "machines": ["mch_grill","mch_oven","mch_churn"],
    "animals": [
      {"species": "chicken", "housing": "bld_coop", "product": "egg"},
      {"species": "cow",     "housing": "bld_barn", "product": "milk"}
    ],
    "seeds": {"seed_tomato": 6, "seed_lettuce": 4},
    "recipes": ["recipe_tomato_soup"]
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- 2. Бутстрап нового игрока (18-onboarding §3.1). Lazy + идемпотентно.
-- ---------------------------------------------------------------------------

-- Активный конфиг-документ неймспейса по версии (до создания фермы config_doc недоступен).
create or replace function public.config_ns_active(p_ns text)
returns jsonb language sql stable
as $$
  select gc.doc from public.game_configs gc
  join public.config_versions cv on cv.id = gc.version_id
  where gc.namespace = p_ns and cv.state = 'active'
  order by cv.activated_at desc nulls last
  limit 1
$$;

-- Общий «seed-мир»: фиксированный город Sunnyside + стрит + календарь/спрос/ивент недели 0.
-- Детерминированные id → повторяемо; on conflict do nothing → безопасно при гонке.
create or replace function public.ensure_seed_world()
returns uuid language plpgsql security definer set search_path = public
as $fn$
declare
  v_town   uuid := '00000000-0000-0000-0000-00005eed0001';
  v_street uuid := '00000000-0000-0000-0000-00005eed57a1';
  v_ver    uuid;
begin
  select id into v_ver from public.config_versions where state = 'active'
    order by activated_at desc nulls last limit 1;

  insert into public.towns(id, name, active_config_version_id, current_week_index, status)
  values (v_town, 'Sunnyside', v_ver, 0, 'open')
  on conflict (id) do nothing;

  insert into public.streets(id, town_id, name_key)
  values (v_street, v_town, 'street_maple')
  on conflict (id) do nothing;

  -- Календарь недели 0 (идемпотентно через claim_anchor внутри rollover_open_week).
  perform public.rollover_open_week(v_town, 0);

  -- Спрос недели 0 (Demand Board). Категории — из demand-конфига (0007), значения — опорные.
  insert into public.market_weeks(town_id, week_index, demand, theme_key)
  values (v_town, 0,
    '{"produce":1.2,"grain":1.0,"dairy":1.1,"meat":1.0,"baked":1.0,"preserved":1.0,"luxury":1.0}'::jsonb,
    'seed_week')
  on conflict (town_id, week_index) do nothing;

  -- Серверный ивент недели 0 (Appetite Meter).
  insert into public.event_weeks(town_id, week_index, theme_key, goal_100)
  values (v_town, 0, 'ev_glutton', 100000)
  on conflict (town_id, week_index) do nothing;

  return v_town;
end;
$fn$;

-- Бутстрап текущего игрока (auth.uid()). No-op, если player уже существует.
create or replace function public.ensure_bootstrap()
returns void language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_town   uuid;
  v_street uuid;
  v_farm   uuid;
  v_ver    uuid;
  v_week   int;
  v_ob     jsonb;
  v_bk     text;
  v_mk     text;
  v_an     jsonb;
  v_seed   record;
  v_rec    text;
begin
  if v_uid is null then return; end if;
  if exists (select 1 from public.players where id = v_uid) then return; end if;

  -- Сериализуем параллельные первые снапшоты одного игрока (hydrateAll шлёт их пачкой).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if exists (select 1 from public.players where id = v_uid) then return; end if;

  v_town := public.ensure_seed_world();
  select current_week_index into v_week from public.towns where id = v_town;
  select id into v_street from public.streets where town_id = v_town order by created_at limit 1;
  select id into v_ver from public.config_versions where state = 'active'
    order by activated_at desc nulls last limit 1;
  v_ob := coalesce(public.config_ns_active('onboarding'), '{}'::jsonb);

  -- 2.1 Игрок + членство в стрите.
  insert into public.players(id, handle, town_id, street_id, created_week, farm_level,
                             town_joined_at, last_seen_at, status)
  values (v_uid, 'farmer_' || substr(v_uid::text, 1, 8), v_town, v_street,
          coalesce(v_week, 0), 1, now(), now(), 'active')
  on conflict (id) do nothing;

  insert into public.street_members(street_id, player_id, role)
  values (v_street, v_uid, 'member')
  on conflict (player_id) do nothing;

  -- 2.2 Ферма.
  insert into public.farms(player_id, town_id, config_version_id)
  values (v_uid, v_town, v_ver)
  returning id into v_farm;
  if v_farm is null then
    select id into v_farm from public.farms where player_id = v_uid;
  end if;

  -- 2.3 Постройки (уровень 1).
  for v_bk in select jsonb_array_elements_text(coalesce(v_ob->'buildings', '[]'::jsonb)) loop
    insert into public.buildings(farm_id, building_key, level) values (v_farm, v_bk, 1)
    on conflict (farm_id, building_key) do nothing;
  end loop;

  -- 2.4 Грядки (пустые).
  for i in 0 .. (coalesce((v_ob->>'plots')::int, 6) - 1) loop
    insert into public.plots(farm_id, slot_index, state) values (v_farm, i, 'empty')
    on conflict (farm_id, slot_index) do nothing;
  end loop;

  -- 2.5 Станки кухни (1 активный слот на старте; апгрейд открывает очередь).
  for v_mk in select jsonb_array_elements_text(coalesce(v_ob->'machines', '[]'::jsonb)) loop
    insert into public.machines(farm_id, machine_key, slots, level) values (v_farm, v_mk, 1, 1);
  end loop;

  -- 2.6 Животные (бабушкина курица + корова).
  for v_an in select * from jsonb_array_elements(coalesce(v_ob->'animals', '[]'::jsonb)) loop
    insert into public.animals(farm_id, species, housing_key, housing_level, affection, product_key, state)
    values (v_farm, v_an->>'species', v_an->>'housing', 1, 0, v_an->>'product', 'idle');
  end loop;

  -- 2.7 Стартовые семена T1 (item_class 'seed', качество-sentinel 0).
  for v_seed in select key, value from jsonb_each_text(coalesce(v_ob->'seeds', '{}'::jsonb)) loop
    perform public.inv_add(v_farm, v_seed.key, 'seed', v_seed.value::int, 0);
  end loop;

  -- 2.8 Стартовый рецепт (Nana Opal → Recipe Box).
  for v_rec in select jsonb_array_elements_text(coalesce(v_ob->'recipes', '[]'::jsonb)) loop
    insert into public.recipes(player_id, recipe_key, source) values (v_uid, v_rec, 'base')
    on conflict (player_id, recipe_key) do nothing;
  end loop;

  -- 2.9 Стартовая валюта (приветственный подарок) — только через леджер (античит).
  perform public.ledger_write(v_uid, 'bucks', coalesce((v_ob->>'start_bucks')::bigint, 1000),
                              'onboarding_gift', 'onboarding', v_uid::text);
  perform public.ledger_write(v_uid, 'dimes', coalesce((v_ob->>'start_dimes')::bigint, 40),
                              'onboarding_gift', 'onboarding', v_uid::text);

  -- 2.10 Служебные состояния прогрессии/удержания.
  insert into public.player_know_how(player_id, points, active_slots) values (v_uid, 0, 1)
    on conflict (player_id) do nothing;
  insert into public.player_state_counters(player_id) values (v_uid)
    on conflict (player_id) do nothing;
  insert into public.player_streaks(player_id) values (v_uid)
    on conflict (player_id) do nothing;
  insert into public.onboarding_state(player_id, t_day) values (v_uid, 0)
    on conflict (player_id) do nothing;

  perform public.log_audit(v_uid, 'bootstrap', 'ok');
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Read-RPC снапшотов (net/adapters/supabase.ts READ_RPC). Возвращают jsonb,
--    ключи camelCase 1:1 к sunnyside/src/types, времена — EpochMs (ms).
-- ---------------------------------------------------------------------------

-- 3.1 get_server_time → { serverNow } (21-client §8 п.1). Не требует игрока.
create or replace function public.get_server_time()
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('serverNow', public.now_ms()) $$;

-- wallet_get → Wallet (все 4 валюты, дефолт 0). Переопределяем: + бутстрап + полный набор.
create or replace function public.wallet_get()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_w jsonb;
begin
  perform public.ensure_bootstrap();
  select coalesce(jsonb_object_agg(currency, balance), '{}'::jsonb) into v_w
    from public.wallets where player_id = auth.uid();
  return jsonb_build_object(
    'bucks',   coalesce((v_w->>'bucks')::bigint, 0),
    'dimes',   coalesce((v_w->>'dimes')::bigint, 0),
    'tickets', coalesce((v_w->>'tickets')::bigint, 0),
    'ribbons', coalesce((v_w->>'ribbons')::bigint, 0));
end;
$fn$;

-- 3.2 get_farm → FarmSnapshot (types/farm.ts).
create or replace function public.get_farm()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_farm uuid; v_level int; v_fv bigint; v_vac timestamptz;
  v_plots jsonb; v_buildings jsonb; v_machines jsonb; v_animals jsonb;
begin
  perform public.ensure_bootstrap();
  select f.id, p.farm_level, p.farm_value, p.vacation_until
    into v_farm, v_level, v_fv, v_vac
    from public.farms f join public.players p on p.id = f.player_id
    where f.player_id = v_uid;
  if v_farm is null then
    return jsonb_build_object('farmId', null, 'farmLevel', 1, 'plots', '[]'::jsonb,
      'buildings', '{}'::jsonb, 'machines', '[]'::jsonb, 'animals', '[]'::jsonb,
      'farmValue', jsonb_build_object('production',0,'buildings',0,'collections',0,'cosmetics',0,'total',0));
  end if;

  perform public.promote_ready(v_farm);  -- growing→ready до чтения (dedline-модель, §3.6)

  -- Грядки. state: withered_none→withered (клиентский enum).
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'id', pl.id, 'slot', pl.slot_index,
      'state', case pl.state when 'withered_none' then 'withered' else pl.state end,
      'cropKey', pl.crop_key, 'quality', pl.quality,
      'plantedAt', public.to_ms(pl.planted_at), 'readyAt', public.to_ms(pl.ready_at),
      'wateredUntil', public.to_ms(pl.watered_until))) order by pl.slot_index), '[]'::jsonb)
    into v_plots from public.plots pl where pl.farm_id = v_farm;

  -- Постройки: object по building_key.
  select coalesce(jsonb_object_agg(b.building_key, jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'key', b.building_key, 'level', b.level,
      'upgradeReadyAt', public.to_ms(b.upgrade_ready_at)))), '{}'::jsonb)
    into v_buildings from public.buildings b where b.farm_id = v_farm;

  -- Станки + их задания (state: cooking/ready/collected).
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'key', m.machine_key, 'level', coalesce(m.level, 1),
      'jobs', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'version', 1, 'id', j.id, 'machineId', j.machine_id, 'recipeKey', j.recipe_key,
            'batch', j.batch_size,
            'state', case when j.collected then 'collected'
                          when now() >= j.ready_at then 'ready' else 'cooking' end,
            'startedAt', public.to_ms(j.started_at), 'readyAt', public.to_ms(j.ready_at),
            'output', case when now() >= j.ready_at and not j.collected then
              (public.config_doc(v_farm,'recipes')->j.recipe_key->'output') else null end)))
        from public.machine_jobs j where j.machine_id = m.id and j.collected = false), '[]'::jsonb))
      order by m.created_at), '[]'::jsonb)
    into v_machines from public.machines m where m.farm_id = v_farm;

  -- Животные: DB(species/housing_key/product_key/quality) → client(kind/housing/productKey/lastQuality).
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'id', a.id, 'kind', a.species, 'housing', a.housing_key,
      'name', a.pet_name, 'affection', a.affection, 'productKey', a.product_key,
      'productReadyAt', public.to_ms(a.product_ready_at),
      'lastQuality', nullif(a.quality, 0)))), '[]'::jsonb)
    into v_animals from public.animals a where a.farm_id = v_farm;

  return jsonb_strip_nulls(jsonb_build_object(
    'farmId', v_farm, 'farmLevel', coalesce(v_level, 1),
    'plots', v_plots, 'buildings', v_buildings, 'machines', v_machines, 'animals', v_animals,
    'farmValue', jsonb_build_object('production', 0, 'buildings', 0, 'collections', 0,
                                    'cosmetics', 0, 'total', coalesce(v_fv, 0)),
    'vacationUntil', public.to_ms(v_vac)));
end;
$fn$;

-- 3.3 get_inventory → InventorySnapshot (types/ingredients.ts).
create or replace function public.get_inventory()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_farm uuid; v_items jsonb; v_stacks jsonb; v_silo int; v_ice int;
begin
  perform public.ensure_bootstrap();
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then
    return jsonb_build_object('items', '{}'::jsonb, 'stacks', '[]'::jsonb,
      'limits', jsonb_build_object('silo', 100, 'icehouse', 100, 'general', 1000000000));
  end if;

  -- items: item_key → сумма qty (по всем качествам).
  select coalesce(jsonb_object_agg(t.item_key, t.q), '{}'::jsonb) into v_items
    from (select item_key, sum(qty)::int q from public.inventory
          where farm_id = v_farm group by item_key) t;

  -- stacks: детализация по качеству (для витрины/ярмарки).
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', i.item_key, 'qty', i.qty, 'quality', i.quality, 'itemClass', i.item_class)), '[]'::jsonb)
    into v_stacks from public.inventory i where i.farm_id = v_farm and i.qty > 0;

  -- Лимиты: база + шаг по уровню Silo/Icehouse (§4.4, опорная формула); general — без лимита.
  select coalesce(max(level) filter (where building_key = 'bld_silo'), 1),
         coalesce(max(level) filter (where building_key = 'bld_icehouse'), 1)
    into v_silo, v_ice from public.buildings where farm_id = v_farm;

  return jsonb_build_object('items', v_items, 'stacks', v_stacks,
    'limits', jsonb_build_object(
      'silo', 100 + 50 * (v_silo - 1),
      'icehouse', 100 + 50 * (v_ice - 1),
      'general', 1000000000));
end;
$fn$;

-- 3.4 get_calendar → ServerCalendar (types/calendar.ts).
create or replace function public.get_calendar()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_town uuid; v_week int; c public.server_calendars;
begin
  perform public.ensure_bootstrap();
  select f.town_id, t.current_week_index into v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = auth.uid();
  if v_town is null then return 'null'::jsonb; end if;

  select * into c from public.server_calendars
    where town_id = v_town and week_index = v_week
    order by week_index desc limit 1;
  if c.id is null then
    select * into c from public.server_calendars where town_id = v_town
      order by week_index desc limit 1;
  end if;
  if c.id is null then return 'null'::jsonb; end if;

  return jsonb_build_object(
    'townId', v_town, 'weekIndex', c.week_index,
    'phase', public.client_week_phase(c.phase),
    'rolloverAt', public.to_ms(c.rollover_at),
    'fairWindow', jsonb_build_object('opensAt', public.to_ms(c.fair_open),
                                     'closesAt', public.to_ms(c.fair_close)),
    'coopDeadlineAt', public.to_ms(c.coop_deadline),
    'eventFinalAt', public.to_ms(c.event_final));
end;
$fn$;

-- 3.5 get_demand_board → DemandBoard (types/economy.ts).
create or replace function public.get_demand_board()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_town uuid; v_week int; mw public.market_weeks;
begin
  perform public.ensure_bootstrap();
  select f.town_id, t.current_week_index into v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = auth.uid();

  select * into mw from public.market_weeks
    where town_id = v_town and week_index = v_week
    order by week_index desc limit 1;
  if mw.id is null then
    select * into mw from public.market_weeks where town_id = v_town
      order by week_index desc limit 1;
  end if;

  return jsonb_build_object(
    'weekIndex', coalesce(mw.week_index, v_week, 0),
    'seed', 0,
    'board', coalesce(mw.demand, '{}'::jsonb),
    'nostalgia', '[]'::jsonb);
end;
$fn$;

-- 3.6 get_fair_stall → Stall (types/fair.ts). Find-or-create прилавок недели (стабильный id).
create or replace function public.get_fair_stall()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_uid uuid := auth.uid(); v_town uuid; v_week int; s public.fair_stalls; v_lots jsonb;
begin
  perform public.ensure_bootstrap();
  select f.town_id, t.current_week_index into v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = v_uid;

  select * into s from public.fair_stalls where player_id = v_uid and week_index = coalesce(v_week, 0);
  if s.id is null then
    insert into public.fair_stalls(player_id, town_id, week_index)
    values (v_uid, v_town, coalesce(v_week, 0))
    on conflict (player_id, week_index) do nothing;
    select * into s from public.fair_stalls where player_id = v_uid and week_index = coalesce(v_week, 0);
  end if;
  if s.id is null then return 'null'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'itemKey', l.item_key, 'qty', l.qty_listed,
      'remaining', greatest(l.qty_listed - l.qty_sold, 0),
      'quality', coalesce(l.quality, 0), 'price', l.price) order by l.slot_index), '[]'::jsonb)
    into v_lots from public.fair_lots l where l.stall_id = s.id;

  return jsonb_strip_nulls(jsonb_build_object(
    'version', 1, 'id', s.id, 'level', coalesce(s.stall_level, 1),
    'displaySlots', s.display_slots, 'openedAt', public.to_ms(s.opened_at),
    'lots', v_lots));
end;
$fn$;

-- 3.7 get_contests → Contest[] (types/fair.ts).
create or replace function public.get_contests()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_uid uuid := auth.uid(); v_town uuid; v_week int; v_out jsonb;
begin
  perform public.ensure_bootstrap();
  select f.town_id, t.current_week_index into v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = v_uid;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', c.id, 'key', c.contest_key, 'phase', c.state,
      'entryWindow', jsonb_build_object('opensAt', public.to_ms(c.entry_open),
                                        'closesAt', public.to_ms(c.entry_close)),
      'votingWindow', jsonb_build_object('opensAt', public.to_ms(c.voting_open),
                                         'closesAt', public.to_ms(c.voting_close)),
      'entries', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', e.id, 'playerId', e.player_id, 'payload', coalesce(e.payload, '{}'::jsonb),
            'votes', coalesce(e.vote_count, 0), 'npcScore', e.npc_score,
            'finalScore', e.final_score, 'rank', e.rank)))
        from public.contest_entries e where e.contest_id = c.id), '[]'::jsonb),
      'myEntry', (
        select jsonb_strip_nulls(jsonb_build_object(
            'id', e.id, 'playerId', e.player_id, 'payload', coalesce(e.payload, '{}'::jsonb),
            'votes', coalesce(e.vote_count, 0), 'npcScore', e.npc_score,
            'finalScore', e.final_score, 'rank', e.rank))
        from public.contest_entries e where e.contest_id = c.id and e.player_id = v_uid limit 1)
    ))), '[]'::jsonb)
    into v_out from public.contests c where c.town_id = v_town and c.week_index = v_week;

  return v_out;
end;
$fn$;

-- 3.8 get_event → EventSnapshot (types/event.ts).
create or replace function public.get_event()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid(); v_town uuid; v_week int;
  ew public.event_weeks; c public.server_calendars;
  v_pct numeric; v_pfp bigint; v_ms jsonb; v_milecfg jsonb; v_pctkey text;
begin
  perform public.ensure_bootstrap();
  select f.town_id, t.current_week_index into v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = v_uid;

  select * into ew from public.event_weeks where town_id = v_town and week_index = v_week
    order by week_index desc limit 1;
  if ew.id is null then
    select * into ew from public.event_weeks where town_id = v_town order by week_index desc limit 1;
  end if;
  if ew.id is null then return 'null'::jsonb; end if;

  select * into c from public.server_calendars where town_id = v_town and week_index = ew.week_index limit 1;
  v_pct := round(100.0 * ew.meter_fp / nullif(ew.goal_100, 0), 1);

  -- Вехи 25/50/75/100 (клиентский набор). hit — по достигнутому проценту.
  v_milecfg := coalesce(public.config_doc(
    (select id from public.farms where player_id = v_uid), 'event')->'milestone_pct', '{}'::jsonb);
  v_ms := '[]'::jsonb;
  foreach v_pctkey in array array['25','50','75','100'] loop
    v_ms := v_ms || jsonb_build_object(
      'pct', v_pctkey::int,
      'reward', 'ms_' || v_pctkey,
      'hit', coalesce(v_pct, 0) >= v_pctkey::numeric);
  end loop;

  select coalesce(personal_fp, 0) into v_pfp from public.personal_contributions
    where event_week_id = ew.id and player_id = v_uid;

  return jsonb_build_object(
    'meter', jsonb_build_object(
      'eventKey', ew.theme_key,
      'meterPct', coalesce(v_pct, 0),
      'meterFp', ew.meter_fp,
      'goalFp', ew.goal_100,
      'milestones', v_ms,
      'window', jsonb_build_object(
        'opensAt', public.to_ms(coalesce(c.week_start, ew.created_at)),
        'closesAt', public.to_ms(c.event_final)),
      'finalAt', public.to_ms(c.event_final)),
    'personalFp', coalesce(v_pfp, 0),
    'streetPennant', false,
    'myContribHist', '[]'::jsonb);
end;
$fn$;

-- 3.9 get_progression → ProgressionSnapshot (types/progression.ts).
create or replace function public.get_progression()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid(); v_farm uuid; v_level int; v_xp bigint;
  v_khp bigint; v_slots int; v_nodes jsonb; v_staff jsonb; v_tokens bigint;
  rp public.route_pass_progress; v_season int; st public.player_streaks; v_state text;
begin
  perform public.ensure_bootstrap();
  select f.id, p.farm_level, p.xp into v_farm, v_level, v_xp
    from public.farms f join public.players p on p.id = f.player_id
    where f.player_id = v_uid;

  select coalesce(points, 0), coalesce(active_slots, 1) into v_khp, v_slots
    from public.player_know_how where player_id = v_uid;
  select coalesce(staff_tokens, 0) into v_tokens
    from public.player_state_counters where player_id = v_uid;

  select coalesce(jsonb_object_agg(n.node_key, jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'key', n.node_key, 'branch', n.branch,
      'studied', n.state = 'done', 'studyReadyAt', public.to_ms(n.research_ready_at),
      'prereqs', '[]'::jsonb))), '{}'::jsonb)
    into v_nodes from public.know_how_nodes n where n.player_id = v_uid;

  -- Стафф: roster + назначения (post).
  select coalesce(jsonb_object_agg(r.staff_key, jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'key', r.staff_key, 'level', r.level, 'hired', true,
      'assignedPost', (select post from public.staff_assignments sa
                       where sa.player_id = v_uid and sa.staff_key = r.staff_key limit 1)))), '{}'::jsonb)
    into v_staff from public.staff_roster r where r.player_id = v_uid;

  select * into rp from public.route_pass_progress where player_id = v_uid
    order by created_at desc limit 1;
  select season_index into v_season from public.route_pass_seasons s where s.id = rp.season_id;

  select * into st from public.player_streaks where player_id = v_uid;
  v_state := coalesce(st.state, 'active');
  if st.insured_until is not null and st.insured_until > now() then v_state := 'insured'; end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'farmId', v_farm, 'farmLevel', coalesce(v_level, 1), 'xp', coalesce(v_xp, 0),
    'knowHow', jsonb_build_object('points', coalesce(v_khp, 0),
      'activeSlots', coalesce(v_slots, 1), 'nodes', v_nodes),
    'staff', v_staff,
    'routePass', jsonb_build_object(
      'season', coalesce(v_season, 0), 'tier', coalesce(rp.level, 0),
      'xp', coalesce(rp.miles, 0),
      'track', case when coalesce(rp.premium, false) then 'premium' else 'free' end,
      'claimedFree', coalesce(rp.claimed_levels, '[]'::jsonb),
      'claimedPremium', '[]'::jsonb),
    'streak', jsonb_strip_nulls(jsonb_build_object(
      'streakDays', coalesce(st.streak_days, 0), 'state', v_state,
      'insuredUntil', public.to_ms(st.insured_until))),
    'staffTokens', coalesce(v_tokens, 0)));
end;
$fn$;

-- 3.10 get_collections → CollectionsSnapshot (types/collections.ts).
create or replace function public.get_collections()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_toys jsonb; v_postcards jsonb; v_ribbons jsonb; v_ach jsonb; v_mastery jsonb; v_neon jsonb;
begin
  perform public.ensure_bootstrap();

  select coalesce(jsonb_object_agg(t.toy_key, jsonb_build_object(
      'key', t.toy_key, 'series', t.series_key, 'owned', true,
      'duplicate', greatest(t.count - 1, 0))), '{}'::jsonb)
    into v_toys from public.toys t where t.player_id = v_uid;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'key', pc.postcard_key, 'stateKey', pc.region, 'owned', true))), '[]'::jsonb)
    into v_postcards from public.postcards pc where pc.player_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', rw.id, 'contestKey', rw.contest_key, 'weekIndex', rw.week_index, 'rank', 1)), '[]'::jsonb)
    into v_ribbons from public.ribbons_wall rw where rw.player_id = v_uid;

  select coalesce(jsonb_agg(pa.ach_key), '[]'::jsonb)
    into v_ach from public.player_achievements pa where pa.player_id = v_uid;

  select coalesce(jsonb_object_agg(rm.recipe_key, greatest(rm.stars, 0)), '{}'::jsonb)
    into v_mastery from public.recipes_mastery rm where rm.player_id = v_uid;

  select config into v_neon from public.player_neon_sign where player_id = v_uid;

  return jsonb_strip_nulls(jsonb_build_object(
    'toys', v_toys, 'cosmetics', '{}'::jsonb, 'postcards', v_postcards, 'ribbons', v_ribbons,
    'achievementsUnlocked', v_ach, 'recipeMastery', v_mastery, 'neonSign', v_neon));
end;
$fn$;

-- 3.11 get_town → TownSnapshot (types/town.ts).
create or replace function public.get_town()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid(); v_town uuid; v_week int;
  v_streets jsonb; v_roster jsonb; v_projects jsonb; v_coop jsonb; v_potluck jsonb; v_migr jsonb;
  v_street uuid;
begin
  perform public.ensure_bootstrap();
  select p.town_id, p.street_id, t.current_week_index into v_town, v_street, v_week
    from public.players p join public.towns t on t.id = p.town_id
    where p.id = v_uid;
  if v_town is null then return 'null'::jsonb; end if;

  -- Стриты + фермы их жителей.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name_key,
      'memberCount', (select count(*) from public.street_members sm where sm.street_id = s.id),
      'farmIds', coalesce((select jsonb_agg(f.id) from public.farms f
                           join public.players pp on pp.id = f.player_id
                           where pp.street_id = s.id), '[]'::jsonb))), '[]'::jsonb)
    into v_streets from public.streets s where s.town_id = v_town;

  -- Ростер соседей (для визитов).
  select coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.id, 'farmId', f.id, 'displayName', p.handle, 'streetId', p.street_id)), '[]'::jsonb)
    into v_roster from public.players p
    join public.farms f on f.player_id = p.id
    where p.town_id = v_town;

  -- Town Projects.
  select coalesce(jsonb_object_agg(tp.project_key, jsonb_build_object(
      'version', 1, 'key', tp.project_key, 'progress', tp.progress,
      'goal', greatest(tp.progress, 1), 'built', tp.state = 'complete',
      'myContribution', coalesce((select sum(amount) from public.town_project_contributions tc
                                  where tc.project_id = tp.id and tc.player_id = v_uid), 0))), '{}'::jsonb)
    into v_projects from public.town_projects tp where tp.town_id = v_town;

  -- Кооп-заказы недели (open). requirements + filled из progress-кэша.
  select coalesce(jsonb_agg(jsonb_build_object(
      'version', 1, 'id', o.id,
      'requirements', coalesce((
        select jsonb_agg(jsonb_build_object(
            'itemKey', req->>'item_key', 'qty', (req->>'qty')::int,
            'filled', coalesce((o.progress->>(req->>'item_key'))::int, 0)))
        from jsonb_array_elements(o.requirements) req), '[]'::jsonb),
      'deadlineAt', public.to_ms(o.deadline),
      'myContribution', coalesce((
        select jsonb_object_agg(oc.item_key, oc.s) from (
          select item_key, sum(qty)::int s from public.order_contributions
          where order_id = o.id and player_id = v_uid group by item_key) oc), '{}'::jsonb),
      'reward', coalesce(o.reward->>'label', ''))), '[]'::jsonb)
    into v_coop from public.orders o
    where o.town_id = v_town and o.week_index = v_week and o.state = 'open';

  -- Potluck моего стрита (текущая неделя).
  select jsonb_build_object(
      'weekIndex', pl.week_index, 'totalScore', pl.total_score,
      'myScore', coalesce((select sum(score) from public.potluck_contributions pc
                           where pc.potluck_id = pl.id and pc.player_id = v_uid), 0),
      'buffActive', pl.buff is not null)
    into v_potluck from public.potlucks pl
    where pl.street_id = v_street and pl.week_index = v_week limit 1;

  -- Активные голосования переезда (town-merge для города / caravan для стрита).
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'version', 1, 'id', mp.id, 'kind', mp.kind, 'targetTownId', mp.target_town_id,
      'votingWindow', jsonb_build_object('opensAt', public.to_ms(mp.opened_at),
                                         'closesAt', public.to_ms(mp.closes_at)),
      'tally', jsonb_build_object(
        'yes', (select count(*) from public.migration_votes mv where mv.proposal_id = mp.id and mv.vote = 'yes'),
        'no',  (select count(*) from public.migration_votes mv where mv.proposal_id = mp.id and mv.vote = 'no'),
        'quorum', 0),
      'myVote', (select vote from public.migration_votes mv
                 where mv.proposal_id = mp.id and mv.player_id = v_uid limit 1)))), '[]'::jsonb)
    into v_migr from public.migration_proposals mp
    where mp.state = 'voting' and (mp.scope_id = v_town or mp.scope_id = v_street);

  return jsonb_strip_nulls(jsonb_build_object(
    'townId', v_town, 'streets', v_streets, 'projects', v_projects, 'roster', v_roster,
    'coopOrders', v_coop, 'potluck', v_potluck, 'migrations', v_migr));
end;
$fn$;

-- 3.12 get_mail_foraging → MailForagingSnapshot (types/mail-foraging.ts).
create or replace function public.get_mail_foraging()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_uid uuid := auth.uid(); v_town uuid; v_orders jsonb; v_points jsonb;
begin
  perform public.ensure_bootstrap();
  select town_id into v_town from public.players where id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'version', 1, 'id', mo.id, 'itemKey', mo.item_key, 'qty', 1,
      'state', case when mo.collected then 'claimed'
                    when mo.delivered or now() >= mo.deliver_at then 'delivered'
                    else 'in_transit' end,
      'orderedAt', public.to_ms(mo.ordered_at), 'deliverAt', public.to_ms(mo.deliver_at))
      order by mo.ordered_at desc), '[]'::jsonb)
    into v_orders from public.mail_orders mo
    where mo.player_id = v_uid and mo.collected = false;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', fp.id, 'kind', fp.point_type, 'itemKey', 'forage_' || fp.point_type,
      'remaining', fp.pool_remaining, 'respawnAt', public.to_ms(fp.respawn_at)))), '[]'::jsonb)
    into v_points from public.foraging_points fp where fp.town_id = v_town;

  return jsonb_build_object('orders', v_orders, 'foragePoints', v_points);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. harvest: КАЧЕСТВО урожая P(Select) от ухода (02-farm §3.6/§4.3).
--    Сигнал ухода, отслеживаемый сервером — полив (plots.watered_until). Прополка/
--    вороны в схеме не трекаются (нет колонок) → в формулу входят база + полив,
--    аддитивно, кап 90%. Числа — из game_configs.harvest_quality (task 4).
--    Обычный/отборный — один item_key с разным quality (normal_quality/select_quality).
-- ---------------------------------------------------------------------------
create or replace function public.harvest(plot_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_farm uuid; r record; v_items jsonb := '[]'::jsonb;
  v_cfg jsonb; v_base numeric; v_water numeric; v_cap numeric;
  v_qn int; v_qs int; v_p numeric; v_q int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  v_cfg   := coalesce(public.config_doc(v_farm, 'harvest_quality'), '{}'::jsonb);
  v_base  := coalesce((v_cfg->>'base_pct')::numeric, 0.10);
  v_water := coalesce((v_cfg->>'water_bonus_pct')::numeric, 0.15);
  v_cap   := coalesce((v_cfg->>'cap_pct')::numeric, 0.90);
  v_qn    := coalesce((v_cfg->>'normal_quality')::int, 1);
  v_qs    := coalesce((v_cfg->>'select_quality')::int, 2);

  for r in
    select * from public.plots
    where id = any(plot_ids) and farm_id = v_farm
      and state = 'ready' and now() >= ready_at
    for update
  loop
    -- P(Select) = база + бонус ухода (полив вовремя), капается сверху.
    v_p := v_base;
    if r.watered_until is not null then
      v_p := v_p + v_water;
    end if;
    if v_p > v_cap then v_p := v_cap; end if;

    -- Независимый бросок при сборе (минимальный исход всегда Normal — P3, без порчи).
    v_q := case when random() < v_p then v_qs else v_qn end;

    perform public.inv_add(v_farm, r.crop_key, 'crop', 1, v_q);
    update public.plots
      set state = 'empty', crop_key = null, planted_at = null,
          ready_at = null, quality = null, watered_until = null, updated_at = now()
    where id = r.id;
    v_items := v_items || jsonb_build_object('key', r.crop_key, 'qty', 1, 'quality', v_q);
  end loop;

  perform public.log_audit(auth.uid(), 'harvest', 'ok');
  return jsonb_build_object('items', v_items);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Гранты выполнения: read-снапшоты — anon + authenticated (первичная гидрация
--    до/после апгрейда анонимной сессии). Внутренние бутстрап-хелперы — не клиенту.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice '0011: role authenticated missing — skip grants';
    return;
  end if;
  foreach fn in array array[
    'public.get_server_time()','public.wallet_get()','public.get_farm()','public.get_inventory()',
    'public.get_calendar()','public.get_demand_board()','public.get_town()','public.get_fair_stall()',
    'public.get_contests()','public.get_event()','public.get_progression()','public.get_collections()',
    'public.get_mail_foraging()'
  ] loop
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
end $$;

-- Внутренние хелперы бутстрапа/времени — отозвать у клиента (вызываются только из RPC).
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.ensure_bootstrap()','public.ensure_seed_world()','public.config_ns_active(text)'
  ] loop
    begin
      execute format('revoke all on function %s from anon, authenticated', fn);
    exception when others then null;
    end;
  end loop;
end $$;
