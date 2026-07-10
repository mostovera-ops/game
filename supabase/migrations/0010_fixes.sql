-- ============================================================================
-- 0010_fixes.sql — Sunnyside · Прод-фиксы дыр, найденных облачной верификацией C4.
-- Реализует 20-backend.md §3.2.2 (склад/качество, sentinel 0 = «без качества/N/A»)
-- и §3.4.1 (RPC горячего пути). Две связанные дыры, ломавшие базовый T1-цикл
-- sow→harvest→craft→sell на реальном проекте:
--
--  ДЫРА 1 — рассинхрон качества при потреблении.
--    `harvest` кладёт культуру со stack-качеством ≥1 (coalesce(plot.quality,1)),
--    а ВСЕ пути потребления (`sell_to_market`, входы `craft_start`, coop/potluck/
--    gift/event) вызывают `inv_remove(..., p_quality => 0)`. Прежний inv_remove
--    искал стек РОВНО quality=0 → собранная культура (quality 1) не продавалась и
--    не крафтилась никогда. Фикс: sentinel `0` при списании трактуется как «любое
--    качество» — списываем по item_key через все стеки (от низшего качества к
--    высшему). Специфичное качество (p_quality>0) — как раньше, точный стек.
--
--  ДЫРА 2 — отсутствует namespace `crops` (seed_key → crop_key).
--    `sow` резолвит культуру через `config_doc(farm,'crops')->seed_key->>'crop_key'`
--    с фолбэком на сам seed_key. Namespace `crops` в сиде 0007 отсутствовал →
--    культура == ключ семени, что схлопывает семя и урожай в один item_key
--    (коллизия стеков склада). Фикс: добавить `crops` в активную версию конфига,
--    маппинг `seed_*` → базовая культура; клиент сеет `seed_tomato`, растёт `tomato`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ДЫРА 1. inv_remove: sentinel-качество 0 = «любое» (списание по всем стекам).
-- ---------------------------------------------------------------------------
create or replace function public.inv_remove(
  p_farm uuid, p_key text, p_qty int, p_quality int default 0)
returns boolean language plpgsql
as $$
declare v_total int; v_left int; r record;
begin
  if p_qty <= 0 then
    return true;  -- нечего списывать
  end if;

  if coalesce(p_quality, 0) = 0 then
    -- «Любое качество»: суммарный сток по ключу должен покрыть p_qty.
    select coalesce(sum(qty), 0) into v_total
      from public.inventory
      where farm_id = p_farm and item_key = p_key;
    if v_total < p_qty then
      return false;
    end if;
    v_left := p_qty;
    for r in
      select id, qty from public.inventory
      where farm_id = p_farm and item_key = p_key and qty > 0
      order by quality asc          -- тратим сначала низшее качество
      for update
    loop
      exit when v_left <= 0;
      if r.qty <= v_left then
        update public.inventory set qty = 0, updated_at = now() where id = r.id;
        v_left := v_left - r.qty;
      else
        update public.inventory set qty = qty - v_left, updated_at = now() where id = r.id;
        v_left := 0;
      end if;
    end loop;
    return true;
  else
    -- Специфичное качество: точный стек (как прежде).
    update public.inventory
      set qty = qty - p_qty, updated_at = now()
    where farm_id = p_farm and item_key = p_key
      and quality = p_quality::smallint and qty >= p_qty;
    return found;
  end if;
end;
$$;

-- ACL: внутренний хелпер движения — только RPC/Edge (не клиент). Пере-revoke
-- на случай, если CREATE OR REPLACE где-то сбросил (обычно ACL сохраняется).
do $$
begin
  begin
    execute 'revoke all on function public.inv_remove(uuid,text,int,int) from authenticated, anon';
  exception when others then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- ДЫРА 2. namespace `crops`: seed_key → crop_key для активной версии конфига.
-- ---------------------------------------------------------------------------
do $$
declare v_ver uuid;
begin
  -- Активная версия (детерминированный id сида 0007, либо любая active).
  select id into v_ver from public.config_versions
    where id = '00000000-0000-0000-0000-0000000c0f19' or state = 'active'
    order by (id = '00000000-0000-0000-0000-0000000c0f19') desc, activated_at desc nulls last
    limit 1;
  if v_ver is null then
    raise notice 'no active config version — skip crops seed';
    return;
  end if;

  insert into public.game_configs(namespace, version_id, doc)
  values ('crops', v_ver, $json$
  {
    "seed_tomato":     {"crop_key": "tomato"},
    "seed_lettuce":    {"crop_key": "lettuce"},
    "seed_potato":     {"crop_key": "potato"},
    "seed_wheat":      {"crop_key": "wheat"},
    "seed_corn":       {"crop_key": "corn"},
    "seed_strawberry": {"crop_key": "strawberry"}
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();
end $$;
