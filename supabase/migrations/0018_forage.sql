-- ============================================================================
-- 0018_forage.sql — Sunnyside · Мир фуражинга: спека-микс точек + пер-тип кэпы
-- (08-mail-foraging.md §3.2.2/§3.2.3/§3.2.6, BL-4 FIXPLAN-CODE.md BACKLOG).
--
-- ГАП, закрываемый этой миграцией (сверка с текущей `foraging_points`/`job_foraging_
-- respawn`/`forage_collect`, 0003/0008/0012):
--   1) `uq_foraging_points` был `(town_id, point_type)` → РОВНО 1 инстанс на тип на
--      город. Спека §3.2.6 требует фиксированный микс 6 Mushroom / 10 Berry / 4 Wild
--      Beehive / 3 Fishing = 23 инстанса на Город. Добавляем `instance_index`,
--      расширяем уникальность до `(town_id, point_type, instance_index)`.
--   2) `job_foraging_respawn` хардкодил `pool_max=40` для ВСЕХ 4 типов. Спека §3.2.2
--      даёт разный пул/инстанс/день (mushroom 40 / berry 36 / wild_beehive 40 /
--      fishing 60 забросов) — централизуем в `game_configs.caps.forage_pool_by_type`.
--   3) `forage_collect` (0012) брал ФИКСИРОВАННЫЙ дневной кэп 8 для всех 4 типов
--      (`caps.forage_daily_cap`). Спека §3.2.3 — личный кэп СУММАРНО на игрока по
--      типу/день: mushroom 8 / berry 12 / wild_beehive 5 / fishing 6 забросов.
--      Централизуем в `game_configs.caps.forage_daily_cap_by_type`, с фолбэком на
--      старый флэт-кэп (обратная совместимость окружений без этой миграции).
--   4) Респавн 06:00 UTC (`sunny_foraging_respawn`, 0008) уже корректен по времени —
--      НЕ трогаем расписание cron, только тело джобы (создание недостающих
--      инстансов + сброс пула по новой схеме).
--   5) Новые/только что созданные Города оставались БЕЗ единой точки фуражинга до
--      следующего прогона крона (респавн только по крону, нет ensure на бутстрапе).
--      Заводим `ensure_foraging_points(town)` — идемпотентный self-heal хелпер,
--      вызываемый и из джобы, и лениво из `get_mail_foraging` (тот же паттерн, что
--      `ensure_bootstrap` в 0011 — лениво на каждом чтении снапшота).
--
-- Идемпотентно: `create or replace` / `add column if not exists` / `on conflict do
-- nothing` / merge конфига по активной версии. Правок в 0001–0017 не вносит.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Конфиг: спека-микс инстансов, пул/инстанс/день, персональный кэп/тип/день
--    (game_configs, namespace='caps', активная версия — тот же паттерн 0011 §1).
-- ---------------------------------------------------------------------------
do $$
declare v_ver uuid;
begin
  select id into v_ver from public.config_versions
    where id = '00000000-0000-0000-0000-0000000c0f19' or state = 'active'
    order by (id = '00000000-0000-0000-0000-0000000c0f19') desc, activated_at desc nulls last
    limit 1;
  if v_ver is null then
    raise notice '0018: no active config version — skip config merge';
    return;
  end if;

  update public.game_configs
    set doc = doc || jsonb_build_object(
          -- Инстансов данного типа на Город (08-mail-foraging §3.2.6).
          'forage_instances_by_type', jsonb_build_object(
            'mushroom', 6, 'berry', 10, 'wild_beehive', 4, 'fishing', 3),
          -- Общий пул объёма на инстанс/день (§3.2.2). Fishing огранич. ЗАБРОСЫ, не уловы.
          'forage_pool_by_type', jsonb_build_object(
            'mushroom', 40, 'berry', 36, 'wild_beehive', 40, 'fishing', 60),
          -- Личный дневной лимит сборов/забросов на игрока, суммарно по типу (§3.2.3).
          'forage_daily_cap_by_type', jsonb_build_object(
            'mushroom', 8, 'berry', 12, 'wild_beehive', 5, 'fishing', 6)),
        updated_at = now()
    where namespace = 'caps' and version_id = v_ver;
end $$;

-- ---------------------------------------------------------------------------
-- 2. `foraging_points`: инстансы, не singletons. `instance_index` различает
--    несколько точек одного типа в одном Городе (0..N-1, N — из конфига выше).
-- ---------------------------------------------------------------------------
alter table public.foraging_points
  add column if not exists instance_index int not null default 0;

drop index if exists public.uq_foraging_points;
create unique index if not exists uq_foraging_points_instance
  on public.foraging_points(town_id, point_type, instance_index);

-- ---------------------------------------------------------------------------
-- 3. `ensure_foraging_points(town)` — идемпотентно создаёт недостающие инстансы
--    спека-микса для Города (НЕ трогает пул уже существующих строк — только
--    вставка отсутствующих). Вызывается и из джобы, и лениво из get_mail_foraging.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_foraging_points(p_town uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_caps jsonb; t text; i int; v_pool int; v_count int;
begin
  select doc into v_caps
    from public.game_configs gc
    where gc.namespace = 'caps'
      and gc.version_id = coalesce(
        (select active_config_version_id from public.towns where id = p_town),
        (select id from public.config_versions where state = 'active' limit 1))
    limit 1;

  foreach t in array array['mushroom','berry','fishing','wild_beehive'] loop
    v_pool  := coalesce((v_caps->'forage_pool_by_type'->>t)::int, 40);
    v_count := greatest(1, coalesce((v_caps->'forage_instances_by_type'->>t)::int, 1));
    for i in 0..(v_count - 1) loop
      insert into public.foraging_points(town_id, point_type, instance_index, pool_remaining, pool_max)
      values (p_town, t, i, v_pool, v_pool)
      on conflict (town_id, point_type, instance_index) do nothing;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. `job_foraging_respawn` — гарантирует спека-микс инстансов (self-heal) и
--    ежедневно (06:00 UTC, cron не меняем) сбрасывает пул до `pool_max` по типу.
--    Идемпотентно на игровой день через `claim_idem` (как было в 0008).
-- ---------------------------------------------------------------------------
create or replace function public.job_foraging_respawn()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r_town record; v_updated int; v_n int := 0;
begin
  for r_town in select id from public.towns loop
    perform public.ensure_foraging_points(r_town.id);

    if not public.claim_idem('forage_respawn', r_town.id::text || ':' || public.game_day()::text) then
      continue;
    end if;

    update public.foraging_points
      set pool_remaining = pool_max, respawn_at = now() + interval '1 day', updated_at = now()
      where town_id = r_town.id;
    get diagnostics v_updated = row_count;
    v_n := v_n + v_updated;
  end loop;
  return jsonb_build_object('points_respawned', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. `get_mail_foraging` — self-heal: гарантирует инстансы ДО чтения (иначе
--    Город без единого прогона крона отдал бы пустой `foragePoints: []`).
-- ---------------------------------------------------------------------------
create or replace function public.get_mail_foraging()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare v_uid uuid := auth.uid(); v_town uuid; v_orders jsonb; v_points jsonb;
begin
  perform public.ensure_bootstrap();
  select town_id into v_town from public.players where id = v_uid;

  if v_town is not null then
    perform public.ensure_foraging_points(v_town);
  end if;

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
-- 6. `forage_collect` — персональный кэп ПО ТИПУ точки (§3.2.3), не флэт 8.
--    Фолбэк-цепочка: per-type → progression.forage.per_type_per_day (легаси
--    ключ 0012) → caps.forage_daily_cap (флэт 0011) → 8 (жёсткий дефолт).
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

  v_cap := coalesce(
    (public.config_doc(v_farm,'caps')->'forage_daily_cap_by_type'->>v_pt.point_type)::int,
    (public.config_doc(v_farm,'progression')->'forage'->>'per_type_per_day')::int,
    (public.config_doc(v_farm,'caps')->>'forage_daily_cap')::int,
    8);
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
