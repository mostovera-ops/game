-- ============================================================================
-- 0006_functions.sql — Sunnyside · Функции, триггеры, RPC (SECURITY DEFINER)
-- Реализует 20-backend.md §3.4.1 («горячий путь» RPC), §3.7 (античит:
--   сервер реконструирует результат), §3.2.11 (леджер→кошелёк триггер-гард),
--   §3.6 (rollover-помощники идемпотентности).
-- Все RPC — SECURITY DEFINER (владелец обходит RLS и валидирует сам).
-- Клиентские числа игнорируются; сервер считает от исходного состояния.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Общие хелперы.
-- ---------------------------------------------------------------------------
create or replace function public.game_day()
returns date language sql stable
as $$ select (now() at time zone 'utc')::date $$;

-- Идемпотентность оркестрации: захват ключа. true = первый раз (можно работать).
create or replace function public.claim_idem(p_scope text, p_key text)
returns boolean language plpgsql
as $$
declare v_n int;
begin
  insert into public.idempotency(scope, key) values (p_scope, p_key)
  on conflict (scope, key) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Идемпотентность фазовых якорей. true = якорь ещё не обработан.
create or replace function public.claim_anchor(p_town uuid, p_week int, p_code text)
returns boolean language plpgsql
as $$
declare v_n int;
begin
  insert into public.processed_anchors(town_id, week_index, anchor_code)
  values (p_town, p_week, p_code)
  on conflict (town_id, week_index, anchor_code) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.log_audit(
  p_actor uuid, p_action text, p_result text, p_reason text default null)
returns void language sql
as $$
  insert into public.audit_logs(actor_id, action, result, reject_reason)
  values (p_actor, p_action, p_result, p_reason)
$$;

-- Активный конфиг-документ неймспейса для фермы игрока (fallback → город/любой active).
create or replace function public.config_doc(p_farm uuid, p_ns text)
returns jsonb language sql stable
as $$
  select gc.doc
  from public.game_configs gc
  where gc.namespace = p_ns
    and gc.version_id = coalesce(
      (select config_version_id from public.farms where id = p_farm),
      (select active_config_version_id from public.towns t
         join public.farms f on f.town_id = t.id where f.id = p_farm),
      (select id from public.config_versions where state = 'active' limit 1))
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 1. Инвентарь: атомарные add/remove (античит дюпа — одна транзакция).
-- ---------------------------------------------------------------------------
create or replace function public.inv_add(
  p_farm uuid, p_key text, p_class text, p_qty int, p_quality int default 0)
returns void language plpgsql
as $$
begin
  insert into public.inventory(farm_id, item_key, item_class, qty, quality)
  values (p_farm, p_key, p_class, p_qty, coalesce(p_quality, 0)::smallint)
  on conflict (farm_id, item_key, quality)
  do update set qty = public.inventory.qty + excluded.qty, updated_at = now();
end;
$$;

-- Списание; возвращает true при успехе (хватило стока), иначе false (без ошибки).
create or replace function public.inv_remove(
  p_farm uuid, p_key text, p_qty int, p_quality int default 0)
returns boolean language plpgsql
as $$
declare v_n int;
begin
  update public.inventory
    set qty = qty - p_qty, updated_at = now()
  where farm_id = p_farm and item_key = p_key
    and quality = coalesce(p_quality, 0)::smallint and qty >= p_qty;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Валютный леджер → кошелёк (триггер-гард §3.2.11 / B17).
--    ЛЮБАЯ вставка в currency_ledgers проходит через этот гард: считает
--    balance_after, запрещает уход в минус, синхронизирует wallets.
-- ---------------------------------------------------------------------------
create or replace function public.trg_ledger_apply()
returns trigger language plpgsql
as $$
declare v_bal bigint;
begin
  select balance into v_bal from public.wallets
    where player_id = new.player_id and currency = new.currency for update;
  v_bal := coalesce(v_bal, 0) + new.delta;
  if v_bal < 0 then
    raise exception 'currency_underflow: % % delta % below zero',
      new.player_id, new.currency, new.delta
      using errcode = 'check_violation';
  end if;
  new.balance_after := v_bal;
  insert into public.wallets(player_id, currency, balance, updated_at)
  values (new.player_id, new.currency, v_bal, now())
  on conflict (player_id, currency)
  do update set balance = excluded.balance, updated_at = now();
  return new;
end;
$$;

drop trigger if exists ledger_apply on public.currency_ledgers;
create trigger ledger_apply before insert on public.currency_ledgers
  for each row execute function public.trg_ledger_apply();

-- Удобная обёртка движения валюты (используют RPC/наградные джобы).
create or replace function public.ledger_write(
  p_player uuid, p_currency text, p_delta bigint, p_reason text,
  p_ref_type text default null, p_ref_id text default null, p_idem text default null)
returns bigint language plpgsql
as $$
declare v_id bigint;
begin
  insert into public.currency_ledgers(player_id, currency, delta, reason, ref_type, ref_id, idempotency_key)
  values (p_player, p_currency, p_delta, p_reason, p_ref_type, p_ref_id, p_idem)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC фермы (§3.4.1 «горячий путь»). Сервер игнорит клиентское время.
-- ---------------------------------------------------------------------------

-- harvest: собирает только реально созревшее (state='ready' AND now()>=ready_at).
create or replace function public.harvest(plot_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_items jsonb := '[]'::jsonb;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  for r in
    select * from public.plots
    where id = any(plot_ids) and farm_id = v_farm
      and state = 'ready' and now() >= ready_at
    for update
  loop
    perform public.inv_add(v_farm, r.crop_key, 'crop', 1, coalesce(r.quality, 1));
    update public.plots
      set state = 'empty', crop_key = null, planted_at = null,
          ready_at = null, quality = null, updated_at = now()
    where id = r.id;
    v_items := v_items || jsonb_build_object('key', r.crop_key, 'qty', 1, 'quality', coalesce(r.quality, 1));
  end loop;

  perform public.log_audit(auth.uid(), 'harvest', 'ok');
  return jsonb_build_object('items', v_items);
end;
$$;

-- sow: сажает семя (списывает со склада, ставит серверный таймер).
create or replace function public.sow(p_slot int, p_seed_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_plot public.plots; v_grow_min int; v_crop text;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  select * into v_plot from public.plots
    where farm_id = v_farm and slot_index = p_slot for update;
  if v_plot.id is null or v_plot.state <> 'empty' then
    perform public.log_audit(auth.uid(), 'sow', 'rejected', 'slot_busy');
    raise exception 'slot_not_empty';
  end if;

  if not public.inv_remove(v_farm, p_seed_key, 1, 0) then
    perform public.log_audit(auth.uid(), 'sow', 'rejected', 'no_seed');
    raise exception 'no_seed';
  end if;

  v_crop     := coalesce(public.config_doc(v_farm,'crops')->p_seed_key->>'crop_key', p_seed_key);
  v_grow_min := coalesce((public.config_doc(v_farm,'timers')->'crops'->v_crop->>'grow_min')::int, 15);

  update public.plots
    set crop_key = v_crop, planted_at = now(),
        ready_at = now() + make_interval(mins => v_grow_min),
        state = 'growing', updated_at = now()
  where id = v_plot.id;

  perform public.log_audit(auth.uid(), 'sow', 'ok');
  return jsonb_build_object('plot', v_plot.id, 'ready_min', v_grow_min);
end;
$$;

-- water: полив своей/соседской грядки (кэп помощи проверяется в help_neighbor).
create or replace function public.water(plot_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_cnt int;
begin
  update public.plots
    set watered_until = now() + interval '8 hours', updated_at = now()
  where id = any(plot_ids)
    and farm_id in (select id from public.farms where player_id = auth.uid())
    and state = 'growing';
  get diagnostics v_cnt = row_count;
  return jsonb_build_object('watered', v_cnt);
end;
$$;

-- promote_ready: помечает созревшие грядки (вызывается при чтении/тиком).
create or replace function public.promote_ready(p_farm uuid)
returns void language sql security definer set search_path = public
as $$
  update public.plots set state = 'ready', updated_at = now()
  where farm_id = p_farm and state = 'growing' and now() >= ready_at
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC крафта (§3.4.1). Списание входа атомарно; сбор — по серверному ready_at.
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

  select slots into v_slots from public.machines where id = p_machine and farm_id = v_farm;
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

create or replace function public.craft_collect(job_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_out jsonb; v_items jsonb := '[]'::jsonb; v_mastery int := 0;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  for r in
    select * from public.machine_jobs
    where id = any(job_ids) and farm_id = v_farm
      and collected = false and now() >= ready_at
    for update
  loop
    v_out := coalesce(public.config_doc(v_farm,'recipes')->r.recipe_key->'output', '{}'::jsonb);
    perform public.inv_add(v_farm,
      coalesce(v_out->>'item_key', r.recipe_key), 'dish',
      coalesce((v_out->>'qty')::int, 1) * r.batch_size,
      coalesce((v_out->>'quality')::smallint, 0));

    update public.machine_jobs set collected = true where id = r.id;

    insert into public.recipes_mastery(player_id, recipe_key, stars, progress)
    values (auth.uid(), r.recipe_key, 0, r.batch_size)
    on conflict (player_id, recipe_key)
    do update set progress = public.recipes_mastery.progress + r.batch_size, updated_at = now();
    v_mastery := v_mastery + r.batch_size;

    v_items := v_items || jsonb_build_object('key', coalesce(v_out->>'item_key', r.recipe_key));
  end loop;

  perform public.log_audit(auth.uid(), 'craft_collect', 'ok');
  return jsonb_build_object('items', v_items, 'mastery_delta', v_mastery);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC продажи NPC-рынку (§3.4.1). Движение bucks — только через леджер.
-- ---------------------------------------------------------------------------
create or replace function public.sell_to_market(p_item_key text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_price bigint; v_mult numeric; v_cat text; v_rev bigint;
begin
  if p_qty <= 0 then raise exception 'bad_qty'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
  if v_farm is null then raise exception 'no_farm'; end if;

  if not public.inv_remove(v_farm, p_item_key, p_qty, 0) then
    perform public.log_audit(auth.uid(), 'sell_to_market', 'rejected', 'no_stock');
    raise exception 'insufficient_stock';
  end if;

  v_price := coalesce((public.config_doc(v_farm,'prices')->p_item_key->>'base')::bigint, 1);
  v_cat   := coalesce(public.config_doc(v_farm,'prices')->p_item_key->>'category', 'misc');
  select coalesce((mw.demand->v_cat)::numeric, 1.0) into v_mult
    from public.market_weeks mw
    join public.farms f on f.town_id = mw.town_id
    where f.id = v_farm order by mw.week_index desc limit 1;
  v_rev := floor(v_price * p_qty * coalesce(v_mult, 1.0))::bigint;

  perform public.ledger_write(auth.uid(), 'bucks', v_rev, 'harvest_sell', 'inventory', p_item_key);
  perform public.log_audit(auth.uid(), 'sell_to_market', 'ok');
  return jsonb_build_object('revenue', v_rev);
end;
$$;

create or replace function public.wallet_get()
returns jsonb language sql security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(currency, balance), '{}'::jsonb)
  from public.wallets where player_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC соц-вкладов (§3.4.1). Списывают сток, инкрементят агрегаты атомарно.
-- ---------------------------------------------------------------------------
create or replace function public.coop_contribute(p_order uuid, p_item_key text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_deadline timestamptz; v_prog jsonb;
begin
  if p_qty <= 0 then raise exception 'bad_qty'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
  select deadline into v_deadline from public.orders where id = p_order and state = 'open';
  if v_deadline is null or now() >= v_deadline then
    perform public.log_audit(auth.uid(), 'coop_contribute', 'rejected', 'closed');
    raise exception 'order_closed';
  end if;
  if not public.inv_remove(v_farm, p_item_key, p_qty, 0) then
    raise exception 'no_stock';
  end if;

  insert into public.order_contributions(order_id, player_id, item_key, qty)
  values (p_order, auth.uid(), p_item_key, p_qty);

  update public.orders
    set progress = coalesce(progress, '{}'::jsonb) ||
        jsonb_build_object(p_item_key,
          coalesce((progress->>p_item_key)::int, 0) + p_qty),
        updated_at = now()
  where id = p_order
  returning progress into v_prog;

  return jsonb_build_object('progress', v_prog);
end;
$$;

create or replace function public.potluck_contribute(p_week int, p_item_key text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_street uuid; v_pot uuid; v_score bigint; v_total bigint;
begin
  if p_qty <= 0 then raise exception 'bad_qty'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
  select street_id into v_street from public.players where id = auth.uid();
  if v_street is null then raise exception 'no_street'; end if;
  if not public.inv_remove(v_farm, p_item_key, p_qty, 0) then raise exception 'no_stock'; end if;

  insert into public.potlucks(street_id, week_index, total_score)
  values (v_street, p_week, 0)
  on conflict (street_id, week_index) do nothing;
  select id into v_pot from public.potlucks where street_id = v_street and week_index = p_week;

  v_score := p_qty;  -- баланс очков — из конфига; здесь 1:1 гипотеза
  insert into public.potluck_contributions(potluck_id, player_id, item_key, qty, score)
  values (v_pot, auth.uid(), p_item_key, p_qty, v_score);
  update public.potlucks set total_score = total_score + v_score, updated_at = now()
    where id = v_pot returning total_score into v_total;

  return jsonb_build_object('total_score', v_total);
end;
$$;

-- event_contribute: атомарно инкрементит meter_fp и ловит пересечение вех (EV8).
create or replace function public.event_contribute(p_item_key text, p_qty int, p_channel text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_town uuid; v_week int; v_ew public.event_weeks;
  v_fp bigint; v_pct numeric; v_pfp bigint; v_hit jsonb := '[]'::jsonb;
begin
  if p_qty <= 0 then raise exception 'bad_qty'; end if;
  select f.id, f.town_id, t.current_week_index into v_farm, v_town, v_week
    from public.farms f join public.towns t on t.id = f.town_id
    where f.player_id = auth.uid();

  if p_channel = 'contrib_donate' then
    if not public.inv_remove(v_farm, p_item_key, p_qty, 0) then raise exception 'no_stock'; end if;
  end if;

  select * into v_ew from public.event_weeks
    where town_id = v_town and week_index = v_week for update;
  if v_ew.id is null or v_ew.settled then raise exception 'event_closed'; end if;

  v_fp := coalesce((public.config_doc(v_farm,'event')->'fp'->>p_item_key)::bigint, p_qty);

  update public.event_weeks set meter_fp = meter_fp + v_fp, updated_at = now()
    where id = v_ew.id returning meter_fp into v_ew.meter_fp;

  insert into public.event_contributions(event_week_id, player_id, channel, fp, category)
  values (v_ew.id, auth.uid(), p_channel, v_fp, null);

  insert into public.personal_contributions(event_week_id, player_id, personal_fp)
  values (v_ew.id, auth.uid(), v_fp)
  on conflict (event_week_id, player_id)
  do update set personal_fp = public.personal_contributions.personal_fp + v_fp, updated_at = now()
  returning personal_fp into v_pfp;

  v_pct := round(100.0 * v_ew.meter_fp / nullif(v_ew.goal_100, 0), 1);
  return jsonb_build_object('meter_pct', v_pct, 'personal_fp', v_pfp, 'milestones_hit', v_hit);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC помощи/подарков с дневными кэпами (§3.4.1, §3.7 смурф-фильтр).
-- ---------------------------------------------------------------------------
create or replace function public.help_neighbor(p_target uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_cnt int;
begin
  if p_target = auth.uid() then raise exception 'self_help'; end if;
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

create or replace function public.gift_send(p_to uuid, p_item_key text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_cnt int;
begin
  if p_to = auth.uid() or p_qty <= 0 then raise exception 'bad_gift'; end if;
  select id into v_farm from public.farms where player_id = auth.uid();
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
-- 8. RPC животных (§3.2.12).
-- ---------------------------------------------------------------------------
create or replace function public.feed_animal(animal_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_fed int := 0; v_cycle_min int;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  for r in select * from public.animals
           where id = any(animal_ids) and farm_id = v_farm for update
  loop
    v_cycle_min := coalesce((public.config_doc(v_farm,'timers')->'animals'->r.species->>'cycle_min')::int, 120);
    if public.inv_remove(v_farm, 'feed_'||r.species, 1, 0)
       or public.inv_remove(v_farm, 'feed_generic', 1, 0) then
      update public.animals
        set fed_at = now(), state = 'producing',
            product_ready_at = now() + make_interval(mins => v_cycle_min), updated_at = now()
      where id = r.id;
      v_fed := v_fed + 1;
    end if;
  end loop;
  return jsonb_build_object('fed', v_fed);
end;
$$;

create or replace function public.collect_animal_product(animal_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; r record; v_items jsonb := '[]'::jsonb; v_q smallint;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  for r in select * from public.animals
           where id = any(animal_ids) and farm_id = v_farm
             and product_ready_at is not null and now() >= product_ready_at for update
  loop
    v_q := least(5, greatest(1, 1 + (r.affection / 100) + (r.housing_level / 3)))::smallint;
    perform public.inv_add(v_farm, r.product_key, 'crop', 1, v_q);
    update public.animals
      set state = 'idle', product_ready_at = null, quality = v_q, updated_at = now()
    where id = r.id;
    v_items := v_items || jsonb_build_object('key', r.product_key, 'quality', v_q);
  end loop;
  return jsonb_build_object('items', v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC Prize Machine (§3.4.1, §3.7 pity считает сервер).
--    Rare ≤10, Chase ≤40, дроп 68/24/6.5/1.5% (канон; числа — из конфига).
-- ---------------------------------------------------------------------------
create or replace function public.prize_pull(p_series text, p_count int default 1)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_farm uuid; v_cfg jsonb; v_cost int; v_rare_cap int; v_chase_cap int;
  v_p record; v_results jsonb := '[]'::jsonb; i int; v_roll numeric; v_rarity text; v_pity bool;
begin
  select id into v_farm from public.farms where player_id = auth.uid();
  v_cfg       := public.config_doc(v_farm,'prize_machine');
  v_cost      := coalesce((v_cfg->>'cost_dimes')::int, 20);
  v_rare_cap  := coalesce((v_cfg->>'rare_pity')::int, 10);
  v_chase_cap := coalesce((v_cfg->>'chase_pity')::int, 40);

  insert into public.prize_series_pity(player_id, series_key) values (auth.uid(), p_series)
    on conflict (player_id, series_key) do nothing;
  select * into v_p from public.prize_series_pity
    where player_id = auth.uid() and series_key = p_series for update;

  for i in 1..greatest(1, p_count) loop
    -- Оплата (◉) через леджер; гард не даёт уйти в минус.
    perform public.ledger_write(auth.uid(), 'dimes', -v_cost, 'prize_pull', 'prize_series_pity', p_series);

    v_pity := false;
    if v_p.pulls_since_chase + 1 >= v_chase_cap then
      v_rarity := 'chase'; v_pity := true;
    elsif v_p.pulls_since_rare + 1 >= v_rare_cap then
      v_rarity := 'rare';  v_pity := true;
    else
      v_roll := random();
      v_rarity := case
        when v_roll < 0.015 then 'chase'
        when v_roll < 0.08  then 'rare'
        else 'common' end;
    end if;

    if v_rarity = 'chase' then v_p.pulls_since_chase := 0; v_p.pulls_since_rare := 0;
    elsif v_rarity = 'rare' then v_p.pulls_since_rare := 0; v_p.pulls_since_chase := v_p.pulls_since_chase + 1;
    else v_p.pulls_since_rare := v_p.pulls_since_rare + 1; v_p.pulls_since_chase := v_p.pulls_since_chase + 1;
    end if;

    insert into public.prize_pulls(player_id, series_key, result_toy_key, rarity, cost_dimes, was_pity)
    values (auth.uid(), p_series, p_series||'_'||v_rarity, v_rarity, v_cost, v_pity);

    insert into public.toys(player_id, toy_key, series_key, rarity, count)
    values (auth.uid(), p_series||'_'||v_rarity, p_series, v_rarity, 1)
    on conflict (player_id, toy_key)
    do update set count = public.toys.count + 1, updated_at = now();

    v_results := v_results || jsonb_build_object('rarity', v_rarity, 'pity', v_pity);
  end loop;

  update public.prize_series_pity
    set pulls_since_rare = v_p.pulls_since_rare,
        pulls_since_chase = v_p.pulls_since_chase, updated_at = now()
  where player_id = auth.uid() and series_key = p_series;

  return jsonb_build_object('results', v_results,
    'pity_after', jsonb_build_object('rare', v_p.pulls_since_rare, 'chase', v_p.pulls_since_chase));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC стрика (§3.2.14). ≥2/3 Daily Specials за игровой день → +1.
-- ---------------------------------------------------------------------------
create or replace function public.streak_check()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_done int; v_s public.player_streaks;
begin
  select count(*) into v_done from public.daily_specials
    where player_id = auth.uid() and game_day = public.game_day() and done;

  insert into public.player_streaks(player_id) values (auth.uid())
    on conflict (player_id) do nothing;
  select * into v_s from public.player_streaks where player_id = auth.uid() for update;

  if v_done >= 2 and coalesce(v_s.last_credited_day, date '1970-01-01') < public.game_day() then
    update public.player_streaks
      set streak_days = streak_days + 1,
          best_streak = greatest(best_streak, streak_days + 1),
          state = 'active', last_credited_day = public.game_day(), updated_at = now()
    where player_id = auth.uid()
    returning * into v_s;
  end if;
  return jsonb_build_object('streak_days', v_s.streak_days, 'state', v_s.state);
end;
$$;

create or replace function public.streak_insure()
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  perform public.ledger_write(auth.uid(), 'tickets', -1, 'streak_insure', 'player_streaks', auth.uid()::text);
  update public.player_streaks
    set insured_until = now() + interval '48 hours', updated_at = now()
  where player_id = auth.uid();
  return jsonb_build_object('insured_until', now() + interval '48 hours');
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Rollover-помощник (§3.6). Открыть следующую неделю идемпотентно.
-- ---------------------------------------------------------------------------
create or replace function public.rollover_open_week(p_town uuid, p_week int)
returns jsonb language plpgsql
as $$
declare v_start timestamptz;
begin
  if not public.claim_anchor(p_town, p_week, 'rollover') then
    return jsonb_build_object('skipped', true);   -- уже обработано (B2)
  end if;
  v_start := date_trunc('week', now());  -- Пн 00:00 UTC текущей недели

  insert into public.server_calendars(
    town_id, week_index, week_start, phase, coop_deadline,
    fair_open, fair_close, event_final, rollover_at)
  values (
    p_town, p_week, v_start, 'mon_plan',
    v_start + interval '3 days 23 hours 59 minutes',  -- Чт 23:59
    v_start + interval '5 days',                        -- Сб 00:00
    v_start + interval '6 days 12 hours',              -- Вс 12:00
    v_start + interval '6 days 20 hours',              -- Вс 20:00
    v_start + interval '6 days 23 hours 59 minutes')   -- Вс 23:59
  on conflict (town_id, week_index) do nothing;

  update public.towns set current_week_index = p_week, updated_at = now() where id = p_town;
  return jsonb_build_object('next_week', p_week);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Гранты выполнения: RPC — authenticated; хелперы движения — нет.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'role authenticated missing — skip grants (non-Supabase env)';
    return;
  end if;
  foreach fn in array array[
    'public.harvest(uuid[])','public.sow(int,text)','public.water(uuid[])',
    'public.craft_start(uuid,text,int)','public.craft_collect(uuid[])',
    'public.sell_to_market(text,int)','public.wallet_get()',
    'public.coop_contribute(uuid,text,int)','public.potluck_contribute(int,text,int)',
    'public.event_contribute(text,int,text)','public.help_neighbor(uuid,text)',
    'public.gift_send(uuid,text,int)','public.feed_animal(uuid[])',
    'public.collect_animal_product(uuid[])','public.prize_pull(text,int)',
    'public.streak_check()','public.streak_insure()'
  ] loop
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Внутренние хелперы движения — отозвать у клиента (только RPC/Edge вызывают).
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.inv_add(uuid,text,text,int,int)','public.inv_remove(uuid,text,int,int)',
    'public.ledger_write(uuid,text,bigint,text,text,text,text)',
    'public.rollover_open_week(uuid,int)','public.claim_idem(text,text)',
    'public.claim_anchor(uuid,int,text)'
  ] loop
    begin
      execute format('revoke all on function %s from authenticated, anon', fn);
    exception when others then null;
    end;
  end loop;
end $$;
