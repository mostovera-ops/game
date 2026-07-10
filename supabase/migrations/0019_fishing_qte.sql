-- ============================================================================
-- 0019_fishing_qte.sql — Sunnyside · рыбалка-QTE (08-mail-foraging.md §3.2.4,
-- BACKLOG BL-1 FIXPLAN-CODE.md). Заменяет `fish_cast()` (0012_server_gameplay.sql
-- §13): та версия игнорировала результат Catch Bar целиком и возвращала JSON с
-- snake_case ключом `item_key` (несовместимо с клиентским `FishCatch.itemKey` —
-- клиент НЕ делает camelCase-конверсию ответа RPC, см. sunnyside
-- src/net/adapters/supabase.ts `toRpcResult` — конверт пробрасывается как есть).
--
-- АНТИ-ЧИТ (см. докстринг sunnyside/src/engine/mail-foraging/fishing.ts
-- `resolveFishCast`/`types/rpc.ts` `FishCastReq`, задокументировано по требованию
-- задачи fishing-qte): честно проверить на сервере, что игрок ДЕЙСТВИТЕЛЬНО попал в
-- тайминг Catch Bar, невозможно — клиент рендерит анимацию сам, сервер не видит
-- кадров, только присланное число попаданий. Решение: `p_hits` (0..3, кламп) —
-- ТОЛЬКО вероятностный МОДИФИКАТОР (`v_p_common`/`v_p_good` ниже, зеркалят
-- `CATCH_ODDS_BY_HITS` в sunnyside/src/engine/mail-foraging/fishing.ts — держать в
-- синхроне при правке одного из двух мест), не гарантия редкости: сервер РОЛЛЯЕТ
-- САМ (`random()`), клиентское число лишь двигает пороги. Независимый Legend Fish
-- (2%, `legendary_pct`) — тоже целиком на сервере, не подменяется/не блокируется
-- (§3.2.4 п.5), в одном броске с остальным (кумулятивные пороги одного `random()` —
-- математически эквивалентно двум независимым роллам «сначала Legend, потом
-- редкость», не даёт клиенту читерского пути).
--
-- Идемпотентно: `create or replace`/`drop function if exists`. Правок в 0001–0018
-- не вносит.
-- ============================================================================

-- Старый ноль-арность overload УДАЛЯЕМ явно: `create or replace function fish_cast(int)`
-- с ДРУГИМ числом параметров создал бы ВТОРОЙ overload, а не заменил старый (Postgres
-- разрешает перегрузку по сигнатуре) — остался бы мёртвый `fish_cast()` без QTE.
drop function if exists public.fish_cast();

create or replace function public.fish_cast(p_hits int default 0)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid;
  v_hits int;
  v_leg numeric;
  v_p_common numeric;
  v_p_good numeric;
  v_roll numeric;
  v_rarity text;
  v_quality int;
  v_item text := 'crop_catfish';
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  -- Кламп в валидный диапазон попыток заброса (FISHING_ATTEMPTS_PER_CAST=3, sunnyside
  -- src/engine/mail-foraging/constants.ts) — защита от мусорного/абсурдного клиентского
  -- числа, НЕ доверие ему как источнику истины (см. докстринг файла выше).
  v_hits := greatest(0, least(3, coalesce(p_hits, 0)));

  v_leg := coalesce((public.config_doc(v_farm,'progression')->'fishing'->>'legendary_pct')::numeric, 2) / 100.0;

  -- Вероятностный модификатор по hits (калибровка-гипотеза — зеркалит
  -- CATCH_ODDS_BY_HITS в sunnyside/src/engine/mail-foraging/fishing.ts).
  v_p_common := case v_hits when 0 then 0.70 when 1 then 0.40 when 2 then 0.15 else 0.05 end;
  v_p_good   := case v_hits when 0 then 0.25 when 1 then 0.45 when 2 then 0.45 else 0.25 end;

  v_roll := random();
  v_rarity := case
    when v_roll < v_leg then 'legendary'
    when v_roll < v_leg + (1 - v_leg) * v_p_common then 'common'
    when v_roll < v_leg + (1 - v_leg) * (v_p_common + v_p_good) then 'good'
    else 'prime'  -- остаток покрывает весь исход (P3 — нет провала, всегда какой-то улов)
  end;

  v_quality := case v_rarity
    when 'legendary' then 5
    when 'prime' then 4
    when 'good' then 2
    else 1  -- common
  end;

  perform public.inv_add(v_farm, v_item, 'crop', 1, v_quality);
  perform public.log_audit(auth.uid(), 'fish_cast', 'ok');
  -- camelCase — конверт RPC пробрасывается клиенту как есть (см. докстринг файла).
  return jsonb_build_object('catch', jsonb_build_object(
    'itemKey', v_item, 'quality', v_quality, 'rarity', v_rarity));
end;
$$;

grant execute on function public.fish_cast(int) to authenticated;
