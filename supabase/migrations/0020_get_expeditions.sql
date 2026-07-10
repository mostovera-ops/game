-- ============================================================================
-- 0020_get_expeditions.sql — Sunnyside · read-снапшот роуд-трипа грузовика
-- (07-expeditions.md §5, 20-backend §3.4 read-снапшоты «одна истина, один шлюз»).
--
-- Закрывает последний серверный хвост read-RPC: `SupabaseBackendAdapter`
-- (sunnyside/src/net/adapters/supabase.ts, READ_RPC.expeditions='get_expeditions')
-- уже мапил снапшот `ui_expeditions`, но серверной функции не было — cloud-режим
-- отдавал ok:false, панель рисовала тёплый экран ошибки. Таблица `public.expeditions`
-- (0001_core.sql §7) и мутации `expedition_start`/`expedition_collect`
-- (0012_server_gameplay.sql §10) уже развёрнуты — здесь только ЧТЕНИЕ.
--
-- Возвращает целостный jsonb 1:1 к типу клиента `ExpeditionsSnapshot`
-- (sunnyside/src/types/expeditions.ts): { expeditions, speedLevel, routeSlots,
-- hasStaffGus }. Ключи camelCase (адаптер отдаёт data как есть в стор-сеттер,
-- toRpcResult не делает snake→camel конверсию — конвенция всего проекта, сверено с
-- get_farm/get_mail_foraging в 0011). Времена — EpochMs (ms) через public.to_ms.
--
-- Паритет бизнес-правил — образцовый локальный адаптер
-- (sunnyside/src/net/adapters/local.ts `getExpeditions`):
--   • expeditions — только НЕсобранные рейсы (collected=false); собранные сервер
--     отсеивает. `loot` в снапшоте НЕ раскрывается (payload — детерминированный
--     секрет до collect; expedition_collect отдаёт лут отдельно) → поле опущено.
--   • state: 'returned' если грузовик уже вернулся (now ≥ return_at), иначе
--     'en_route'. Панель (ExpeditionsPanel.tsx) готовность и так выводит из
--     returnAt vs serverNow(), но тип несёт 'returned' — отдаём честно (1:1 к типу).
--   • speedLevel: 0 — ветка апгрейдов Speed/Capacity/Route Slots пока не
--     персистится ни сервером, ни LocalWorld (нет ветки покупки); отдаём базу.
--   • routeSlots = 1 (база, §3.4.3) + `staff_buck` (Trucker Buck) на посту Yard →
--     +1 слот. Зеркалит `totalRouteSlots(1, hasStaffBuck)` (engine/expedition/
--     upgrades.ts): routeSlotsAtLevel(1)=1 + STAFF_BUCK_BONUS_SLOTS=1.
--   • hasStaffGus: `staff_gus` (Mechanic Gus) на посту Yard → −15% времени рейса
--     (§3.4.1); вход превью длительности в UI, чтобы совпало с expedition_start.
--
-- NB: посты в public.staff_assignments хранятся lower-case
-- (staff_assign, 0012 §7: каталог posts=["kitchen","field","counter","yard"]),
-- а клиентский StaffPost — Capitalized ('Yard'). Здесь сравниваем по серверной
-- истине (lower(post)='yard'), assignedPost наружу не отдаём.
--
-- SECURITY DEFINER (владелец обходит RLS, валидирует по auth.uid()), по образцу
-- соседних get_* (0011_server_core.sql §3). Идемпотентно (create or replace).
-- Правок в 0001–0019 не вносит.
-- ============================================================================

create or replace function public.get_expeditions()
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_farm uuid;
  v_exps jsonb;
  v_has_gus  boolean;
  v_has_buck boolean;
begin
  perform public.ensure_bootstrap();
  select id into v_farm from public.farms where player_id = v_uid;
  if v_farm is null then
    return jsonb_build_object(
      'expeditions', '[]'::jsonb,
      'speedLevel', 0,
      'routeSlots', 1,
      'hasStaffGus', false);
  end if;

  -- Активные (en_route) + вернувшиеся-несобранные рейсы (собранные отсеиваем).
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'version', 1,
      'id', e.id,
      'stateKey', e.state_key,
      'routeSlot', e.route_slot,
      'state', case when now() >= e.return_at then 'returned' else 'en_route' end,
      'startedAt', public.to_ms(e.departed_at),
      'returnAt', public.to_ms(e.return_at)
    )) order by e.departed_at), '[]'::jsonb)
    into v_exps
    from public.expeditions e
    where e.farm_id = v_farm and e.collected = false;

  -- Стафф на посту Yard (нанят И назначен). assignment существует только если стафф
  -- в staff_roster (staff_assign это гарантирует) — join для явности семантики.
  v_has_gus := exists (
    select 1 from public.staff_assignments sa
    join public.staff_roster sr on sr.player_id = sa.player_id and sr.staff_key = sa.staff_key
    where sa.player_id = v_uid and sa.staff_key = 'staff_gus' and lower(sa.post) = 'yard');
  v_has_buck := exists (
    select 1 from public.staff_assignments sa
    join public.staff_roster sr on sr.player_id = sa.player_id and sr.staff_key = sa.staff_key
    where sa.player_id = v_uid and sa.staff_key = 'staff_buck' and lower(sa.post) = 'yard');

  return jsonb_build_object(
    'expeditions', v_exps,
    'speedLevel', 0,
    'routeSlots', 1 + (case when v_has_buck then 1 else 0 end),
    'hasStaffGus', v_has_gus);
end;
$fn$;

-- Грант выполнения: anon + authenticated (первичная гидрация до/после апгрейда
-- анонимной сессии), по образцу read-снапшотов 0011 §5.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice '0020: role authenticated missing — skip grant';
    return;
  end if;
  execute 'grant execute on function public.get_expeditions() to anon, authenticated';
end $$;
