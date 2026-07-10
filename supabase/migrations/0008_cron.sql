-- ============================================================================
-- 0008_cron.sql — Sunnyside · Cron-обвязка недельного цикла (20-backend.md §3.6).
--
-- Дизайн: авторитетная логика фазовых якорей и оркестрации живёт в SQL-джобах
-- public.job_* (SECURITY DEFINER, обходят RLS, валидируют сами). pg_cron дёргает
-- их напрямую (надёжно, без внешнего HTTP). Те же джобы вызывают одноимённые
-- Edge-функции (market-generate/week-rollover/event-settle/fair-tick/contest-
-- judge) как HTTP-обёртки (для ручного/админ-триггера и расписания Supabase Cron)
-- — Edge просто форвардит в этот же job_*, поэтому двойной вызов идемпотентен
-- (processed_anchors / idempotency / event_milestones_claimed).
--
-- Секреты НЕ хардкодятся: HTTP-мост читает URL/секрет из private.edge_config,
-- который наполняется отдельным (не коммитимым) SQL-исполнением из env.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. private.edge_config — конфиг HTTP-моста pg_cron → Edge (без секретов в файле)
-- ---------------------------------------------------------------------------
create schema if not exists private;
create table if not exists private.edge_config (
  k text primary key,
  v text not null
);
revoke all on private.edge_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Детерминированный ГПСЧ [0,1) из строкового seed (античит: воспроизводимо).
-- ---------------------------------------------------------------------------
create or replace function public.rand01(p_seed text)
returns numeric language sql immutable as $$
  select (('x' || substr(md5(p_seed), 1, 8))::bit(32)::bigint & 2147483647)::numeric
         / 2147483647.0
$$;

-- ---------------------------------------------------------------------------
-- 2. ensure_calendar — идемпотентно создаёт server_calendars(town,week) c якорями.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_calendar(p_town uuid, p_week int, p_start timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.server_calendars(
    town_id, week_index, week_start, phase, coop_deadline,
    fair_open, fair_close, event_final, rollover_at)
  values (
    p_town, p_week, p_start, 'mon_plan',
    p_start + interval '3 days 23 hours 59 minutes',  -- Чт 23:59
    p_start + interval '5 days',                       -- Сб 00:00
    p_start + interval '6 days 12 hours',              -- Вс 12:00
    p_start + interval '6 days 20 hours',              -- Вс 20:00
    p_start + interval '6 days 23 hours 59 minutes')   -- Вс 23:59
  on conflict (town_id, week_index) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. job_phase_tick — двигает server_calendars.phase по now() (каждые 5 мин).
--    Идемпотентно: просто присваивает фазу от isodow (CDC → Realtime).
-- ---------------------------------------------------------------------------
create or replace function public.job_phase_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.server_calendars sc
    set phase = case extract(isodow from now())::int
        when 1 then 'mon_plan'  when 2 then 'tue_produce' when 3 then 'wed_route'
        when 4 then 'thu_coop'  when 5 then 'fri_prep'    when 6 then 'sat_fair'
        else 'sun_event' end,
        updated_at = now()
  from public.towns t
  where sc.town_id = t.id and sc.week_index = t.current_week_index
    and now() >= sc.week_start and now() < sc.rollover_at
    and sc.phase is distinct from (case extract(isodow from now())::int
        when 1 then 'mon_plan'  when 2 then 'tue_produce' when 3 then 'wed_route'
        when 4 then 'thu_coop'  when 5 then 'fri_prep'    when 6 then 'sat_fair'
        else 'sun_event' end);
  get diagnostics v_n = row_count;
  return jsonb_build_object('phases_moved', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. job_market_generate — Пн 00:00: спрос/конкурсы/кооп по всем городам.
--    Идемпотентно по processed_anchors (town,week,'A0').
-- ---------------------------------------------------------------------------
create or replace function public.job_market_generate()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r_town record; v_week int; v_start timestamptz; v_seed text;
  v_cats jsonb; v_cat text; v_demand jsonb; v_gen int := 0; v_mult numeric;
begin
  v_start := date_trunc('week', now());  -- Пн 00:00 текущей недели
  for r_town in select id, current_week_index from public.towns loop
    v_week := r_town.current_week_index;
    if not public.claim_anchor(r_town.id, v_week, 'A0') then continue; end if;
    perform public.ensure_calendar(r_town.id, v_week, v_start);

    -- Детерминированный спрос: множитель по каждой категории ∈ [0.85, 1.30].
    v_cats := coalesce(public.config_doc(
      (select id from public.farms where town_id = r_town.id limit 1), 'demand')
      ->'categories', '["produce","grain","dairy","meat","baked","preserved","luxury"]'::jsonb);
    v_demand := '{}'::jsonb;
    for v_cat in select jsonb_array_elements_text(v_cats) loop
      v_seed := r_town.id::text || ':' || v_week::text || ':' || v_cat;
      v_mult := round(0.85 + public.rand01(v_seed) * 0.45, 2);
      v_demand := v_demand || jsonb_build_object(v_cat, v_mult);
    end loop;

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

-- ---------------------------------------------------------------------------
-- 5. job_week_rollover — Вс 23:59: закрыть неделю, открыть следующую.
--    Идемпотентно по processed_anchors (town, current_week, 'rollover').
-- ---------------------------------------------------------------------------
create or replace function public.job_week_rollover()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r_town record; v_next int; v_next_start timestamptz; v_n int := 0;
begin
  for r_town in select id, current_week_index from public.towns loop
    if not public.claim_anchor(r_town.id, r_town.current_week_index, 'rollover') then continue; end if;
    v_next := r_town.current_week_index + 1;
    -- Начало следующей недели: следующий Пн 00:00 UTC.
    v_next_start := date_trunc('week', now()) + interval '7 days';
    perform public.ensure_calendar(r_town.id, v_next, v_next_start);
    update public.towns set current_week_index = v_next, updated_at = now()
      where id = r_town.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('towns_rolled', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. job_fair_open / job_fair_close (Сб 00:00 / Вс 12:00).
-- ---------------------------------------------------------------------------
create or replace function public.job_fair_open()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select sc.town_id, sc.week_index from public.server_calendars sc
           join public.towns t on t.id = sc.town_id and t.current_week_index = sc.week_index
           where now() >= sc.fair_open loop
    if public.claim_anchor(r.town_id, r.week_index, 'fair_open') then v_n := v_n + 1; end if;
  end loop;
  return jsonb_build_object('fairs_opened', v_n);
end;
$$;

-- Возврат непроданного стока в склад (B16) + финализация лотов.
create or replace function public.job_fair_close()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; lot record; v_farm uuid; v_returned int := 0;
begin
  for r in select sc.town_id, sc.week_index from public.server_calendars sc
           join public.towns t on t.id = sc.town_id and t.current_week_index = sc.week_index
           where now() >= sc.fair_close loop
    if not public.claim_anchor(r.town_id, r.week_index, 'fair_close') then continue; end if;
    for lot in
      select fl.id, fl.item_key, fl.quality, (fl.qty_listed - fl.qty_sold) as unsold, fs.player_id
      from public.fair_lots fl
      join public.fair_stalls fs on fs.id = fl.stall_id
      where fs.town_id = r.town_id and fs.week_index = r.week_index
        and fl.qty_listed > fl.qty_sold
    loop
      select id into v_farm from public.farms where player_id = lot.player_id;
      if v_farm is not null and lot.unsold > 0 then
        perform public.inv_add(v_farm, lot.item_key, 'dish', lot.unsold, coalesce(lot.quality,0));
        update public.fair_lots set qty_sold = qty_listed where id = lot.id;
        v_returned := v_returned + lot.unsold;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('unsold_returned', v_returned);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. job_coop_deadline — Чт 23:59: закрыть кооп-заказы, наградить участников.
-- ---------------------------------------------------------------------------
create or replace function public.job_coop_deadline()
returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; req record; v_ok bool; v_reward_bucks bigint; c record; v_closed int := 0;
begin
  for o in select * from public.orders where state = 'open' and now() >= deadline loop
    -- Выполнен, если по каждому требованию progress >= qty.
    v_ok := true;
    for req in select * from jsonb_to_recordset(o.requirements) as x(item_key text, qty int) loop
      if coalesce((o.progress->>req.item_key)::int, 0) < req.qty then v_ok := false; end if;
    end loop;

    if v_ok then
      update public.orders set state = 'fulfilled', updated_at = now() where id = o.id;
      v_reward_bucks := coalesce((o.reward->>'bucks')::bigint, 100);
      -- Награда каждому уникальному контрибьютору (идемпотентно по ключу заказа).
      for c in select distinct player_id from public.order_contributions where order_id = o.id loop
        perform public.ledger_write(c.player_id, 'bucks', v_reward_bucks, 'coop_reward',
          'orders', o.id::text, 'coop:'||o.id::text||':'||c.player_id::text);
      end loop;
    else
      update public.orders set state = 'expired', updated_at = now() where id = o.id;
    end if;
    v_closed := v_closed + 1;
  end loop;
  return jsonb_build_object('orders_closed', v_closed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. job_contest_open_voting (Сб 00:00) / job_contest_judge (Вс 12:00).
-- ---------------------------------------------------------------------------
create or replace function public.job_contest_open_voting()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.contests set state = 'voting', updated_at = now()
    where state = 'entry' and now() >= entry_close and now() >= voting_open;
  get diagnostics v_n = row_count;
  return jsonb_build_object('contests_voting', v_n);
end;
$$;

create or replace function public.job_contest_judge()
returns jsonb language plpgsql security definer set search_path = public as $$
declare co record; e record; v_total_votes int; v_npc numeric; v_final numeric;
        v_rank int; v_judged int := 0;
begin
  for co in select * from public.contests where state = 'voting' and now() >= voting_close loop
    if not public.claim_idem('contest_judge', co.id::text) then continue; end if;

    select count(*) into v_total_votes from public.contest_votes where contest_id = co.id;

    -- npc_score детерминированно из payload; final = 0.5*NPC + 0.5*VoteShare.
    for e in select ce.*, (select count(*) from public.contest_votes v where v.entry_id = ce.id) as votes
             from public.contest_entries ce where ce.contest_id = co.id loop
      v_npc := round(public.rand01(e.id::text || ':npc') * 100, 2);
      v_final := round(0.5 * v_npc + 0.5 * (100.0 * e.votes / nullif(v_total_votes,0)), 2);
      update public.contest_entries
        set npc_score = v_npc, vote_count = e.votes, final_score = coalesce(v_final, v_npc)
      where id = e.id;
    end loop;

    -- Ранги по дивизиону (город) и Blue Ribbon победителю.
    v_rank := 0;
    for e in select id, player_id from public.contest_entries
             where contest_id = co.id order by final_score desc nulls last loop
      v_rank := v_rank + 1;
      update public.contest_entries set rank = v_rank where id = e.id;
      if v_rank = 1 then
        insert into public.ribbons_wall(player_id, contest_key, week_index, ribbon_type)
        values (e.player_id, co.contest_key, co.week_index, 'blue')
        on conflict do nothing;
        perform public.ledger_write(e.player_id, 'ribbons', 1, 'contest_win',
          'contests', co.id::text, 'ribbon:'||co.id::text||':'||e.player_id::text);
      end if;
    end loop;

    update public.contests set state = 'judged', updated_at = now() where id = co.id;
    v_judged := v_judged + 1;
  end loop;
  return jsonb_build_object('contests_judged', v_judged);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. job_fair_tick — пассив продаж лотов (каждые 15 мин в окне).
--    Идемпотентно по idempotency(scope='fair_tick', key=lot:tick_window).
-- ---------------------------------------------------------------------------
create or replace function public.job_fair_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare lot record; v_window text; v_sell int; v_rev bigint; v_fp bigint;
        v_town uuid; v_week int; v_sold int := 0;
begin
  v_window := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
              || ':' || (extract(minute from now())::int / 15)::text;
  for lot in
    select fl.*, fs.player_id, fs.town_id, fs.week_index
    from public.fair_lots fl
    join public.fair_stalls fs on fs.id = fl.stall_id
    join public.server_calendars sc
      on sc.town_id = fs.town_id and sc.week_index = fs.week_index
    where fs.opened_at is not null
      and now() >= sc.fair_open and now() < sc.fair_close
      and fl.qty_listed > fl.qty_sold
  loop
    if not public.claim_idem('fair_tick', lot.id::text || ':' || v_window) then continue; end if;
    -- SellRate: детерминированно 0..2 ед./тик от seed(лот,окно), не больше остатка.
    v_sell := least(lot.qty_listed - lot.qty_sold,
      floor(public.rand01(lot.id::text || v_window) * 3)::int);
    if v_sell <= 0 then continue; end if;

    v_rev := v_sell * lot.price;
    v_fp  := v_sell;  -- FP пропорционально проданному (баланс — event-конфиг)
    update public.fair_lots set qty_sold = qty_sold + v_sell where id = lot.id;
    insert into public.fair_sales(lot_id, player_id, qty, revenue, fp)
      values (lot.id, lot.player_id, v_sell, v_rev, v_fp);
    perform public.ledger_write(lot.player_id, 'bucks', v_rev, 'fair_sale',
      'fair_lots', lot.id::text);

    -- FP в котёл ивента (атомарно).
    update public.event_weeks set meter_fp = meter_fp + v_fp, updated_at = now()
      where town_id = lot.town_id and week_index = lot.week_index and not settled;
    v_sold := v_sold + v_sell;
  end loop;
  return jsonb_build_object('units_sold', v_sold);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. job_event_settle — Вс 20:00: финал ивента, вехи, награды (идемпотентно).
-- ---------------------------------------------------------------------------
create or replace function public.job_event_settle()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ew record; ms record; p record; v_cfg jsonb; v_settled int := 0;
begin
  for ew in
    select e.* from public.event_weeks e
    join public.towns t on t.id = e.town_id and t.current_week_index = e.week_index
    join public.server_calendars sc on sc.town_id = e.town_id and sc.week_index = e.week_index
    where not e.settled and now() >= sc.event_final
  loop
    if not public.claim_anchor(ew.town_id, ew.week_index, 'event_final') then continue; end if;
    v_cfg := public.config_doc((select id from public.farms where town_id = ew.town_id limit 1), 'event');

    -- Вехи: для каждой достигнутой (meter_fp >= goal*pct/100) — награда активным.
    for ms in select key as ms_key, (value)::text::numeric as pct
              from jsonb_each_text(coalesce(v_cfg->'milestone_pct','{}'::jsonb)) loop
      if ew.meter_fp >= ew.goal_100 * ms.pct / 100.0 then
        for p in select player_id from public.personal_contributions where event_week_id = ew.id loop
          -- Идемпотентность вехи на игрока (PK) + идемпотентность выплаты в леджере.
          insert into public.event_milestones_claimed(event_week_id, milestone_key, player_id, reward_key)
          values (ew.id, ms.ms_key, p.player_id, 'tickets_'||ms.ms_key)
          on conflict do nothing;
          if found then
            perform public.ledger_write(p.player_id, 'tickets', 1, 'event_reward',
              'event_weeks', ew.id::text,
              p.player_id::text || ':' || ew.week_index::text || ':' || ms.ms_key);
          end if;
        end loop;
      end if;
    end loop;

    update public.event_weeks set settled = true, updated_at = now() where id = ew.id;
    v_settled := v_settled + 1;
  end loop;
  return jsonb_build_object('events_settled', v_settled);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Ежедневные джобы.
-- ---------------------------------------------------------------------------
-- Заморозка стриков (не обнуление, E2): active → frozen, если день пропущен.
create or replace function public.job_streak_freeze()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.player_streaks
    set state = 'frozen', updated_at = now()
  where state = 'active'
    and coalesce(last_credited_day, date '1970-01-01') < public.game_day()
    and (insured_until is null or insured_until < now());
  get diagnostics v_n = row_count;
  return jsonb_build_object('frozen', v_n);
end;
$$;

-- Респавн пулов фуражинга (06:00): гарантирует 4 типа точек на город, полнит пул.
create or replace function public.job_foraging_respawn()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r_town record; t text; v_n int := 0;
begin
  for r_town in select id from public.towns loop
    if not public.claim_idem('forage_respawn', r_town.id::text || ':' || public.game_day()::text) then
      continue;
    end if;
    foreach t in array array['mushroom','berry','fishing','wild_beehive'] loop
      insert into public.foraging_points(town_id, point_type, pool_remaining, pool_max, respawn_at)
      values (r_town.id, t, 40, 40, now() + interval '1 day')
      on conflict (town_id, point_type)
      do update set pool_remaining = public.foraging_points.pool_max,
                    respawn_at = now() + interval '1 day';
      v_n := v_n + 1;
    end loop;
  end loop;
  return jsonb_build_object('points_respawned', v_n);
end;
$$;

-- GC: чат >30 дн, fair_sales/audit_logs >90 дн, idempotency >90 дн.
create or replace function public.job_chat_gc()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_chat int; v_sales int; v_audit int;
begin
  delete from public.chat_messages where created_at < now() - interval '30 days';
  get diagnostics v_chat = row_count;
  delete from public.fair_sales where tick_at < now() - interval '90 days';
  get diagnostics v_sales = row_count;
  delete from public.audit_logs where at < now() - interval '90 days';
  get diagnostics v_audit = row_count;
  delete from public.idempotency where at < now() - interval '90 days';
  return jsonb_build_object('chat', v_chat, 'sales', v_sales, 'audit', v_audit);
end;
$$;

-- Пересчёт towns.dau_7d (только ftue_complete игроки — чистота метрик, 18-onboarding).
create or replace function public.job_dau_recalc()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.towns t set dau_7d = sub.cnt, updated_at = now()
  from (
    select p.town_id, count(distinct p.id)::int as cnt
    from public.players p
    left join public.onboarding_state o on o.player_id = p.id
    where p.last_seen_at >= now() - interval '7 days'
      and coalesce(o.ftue_complete, false)
    group by p.town_id
  ) sub
  where t.id = sub.town_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('towns_updated', v_n);
end;
$$;

-- Недельный каталог почты (детерминированный, Пн 00:00).
create or replace function public.job_mail_generate()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r_town record; v_week int; v_items jsonb; v_n int := 0;
begin
  for r_town in select id, current_week_index from public.towns loop
    v_week := r_town.current_week_index;
    v_items := jsonb_build_array(
      jsonb_build_object('item_key','seed_tomato','price',10,'stock',20,'rarity','common'),
      jsonb_build_object('item_key','decor_lamp','price',120,'stock',1,'rarity','decor'),
      jsonb_build_object('item_key','tool_wateringcan','price',40,'stock',5,'rarity','tools'));
    insert into public.mail_catalog_weeks(town_id, week_index, items)
    values (r_town.id, v_week, v_items)
    on conflict (town_id, week_index) do nothing;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('catalogs', v_n);
end;
$$;

-- Win-back скан (05:00): игроки, не заходившие 3–7 дней, без свежей волны.
create or replace function public.job_winback_scan()
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; v_n int := 0;
begin
  for p in
    select pl.id, ps.best_streak from public.players pl
    left join public.player_streaks ps on ps.player_id = pl.id
    left join public.winback_state w on w.player_id = pl.id
    where pl.last_seen_at < now() - interval '3 days'
      and pl.last_seen_at >= now() - interval '7 days'
      and (w.player_id is null or w.wave_sent_at < now() - interval '3 days')
  loop
    if not public.claim_idem('winback', p.id::text || ':w3') then continue; end if;
    insert into public.winback_state(player_id, last_wave, wave_sent_at, best_streak_snapshot)
    values (p.id, 'w3', now(), coalesce(p.best_streak, 0))
    on conflict (player_id)
    do update set last_wave = 'w3', wave_sent_at = now(),
                  best_streak_snapshot = coalesce(p.best_streak, 0);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('winback_queued', v_n);
end;
$$;

-- Merge-check (ежедневно): города ниже DAU-порога → предложение town_merge.
create or replace function public.job_merge_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_target uuid; v_n int := 0;
begin
  if not public.claim_idem('merge_check', public.game_day()::text) then
    return jsonb_build_object('skipped', true);
  end if;
  for r in select id, dau_7d from public.towns
           where status = 'open' and dau_7d < 15
             and not exists (select 1 from public.migration_proposals mp
                             where mp.scope_id = towns.id and mp.state = 'voting') loop
    select id into v_target from public.towns
      where id <> r.id and status = 'open' order by dau_7d desc limit 1;
    if v_target is null then continue; end if;
    insert into public.migration_proposals(kind, scope_id, target_town_id, opened_at, closes_at, state)
    values ('town_merge', r.id, v_target, now(),
            date_trunc('week', now()) + interval '7 days', 'voting');
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('merge_proposals', v_n);
end;
$$;

-- Ротация сезона лиг (soft-reset 25%) — вызывается на границе сезона.
create or replace function public.job_season_rollover()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; v_n int := 0;
begin
  for s in select id from public.route_pass_seasons where end_week <= (
             select max(current_week_index) from public.towns) loop
    if not public.claim_idem('season_rollover', s.id::text) then continue; end if;
    update public.event_leagues set league_score = floor(league_score * 0.25)
      where season_id = s.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('seasons_reset', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. HTTP-мост pg_cron → Edge (опционально; читает private.edge_config).
--     Не обязателен для работы cron (джобы вызываются напрямую), но даёт путь
--     «Supabase Cron → Edge Function». Секрет — из edge_config, не из файла.
-- ---------------------------------------------------------------------------
create or replace function public.call_edge(p_fn text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_base text; v_secret text; v_req bigint;
begin
  select v into v_base   from private.edge_config where k = 'functions_base_url';
  select v into v_secret from private.edge_config where k = 'cron_secret';
  if v_base is null or v_secret is null then
    return null;  -- мост не сконфигурирован — тихо пропускаем (джобы идут напрямую)
  end if;
  select net.http_post(
    url := v_base || '/' || p_fn,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body := p_body
  ) into v_req;
  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Расписание pg_cron. Идемпотентно: снимаем прежние job'ы, ставим заново.
-- ---------------------------------------------------------------------------
do $$
declare j text;
begin
  foreach j in array array[
    'sunny_phase_tick','sunny_market_generate','sunny_week_rollover',
    'sunny_fair_open','sunny_fair_close','sunny_fair_tick',
    'sunny_coop_deadline','sunny_contest_open_voting','sunny_contest_judge',
    'sunny_event_settle','sunny_streak_freeze','sunny_foraging_respawn',
    'sunny_chat_gc','sunny_dau_recalc','sunny_mail_generate',
    'sunny_winback_scan','sunny_merge_check','sunny_season_rollover'
  ] loop
    begin perform cron.unschedule(j); exception when others then null; end;
  end loop;
end $$;

select cron.schedule('sunny_phase_tick',        '*/5 * * * *',   $$ select public.job_phase_tick(); $$);
select cron.schedule('sunny_fair_tick',          '*/15 * * * *',  $$ select public.job_fair_tick(); $$);
select cron.schedule('sunny_market_generate',    '0 0 * * 1',     $$ select public.job_market_generate(); $$);
select cron.schedule('sunny_mail_generate',      '0 0 * * 1',     $$ select public.job_mail_generate(); $$);
select cron.schedule('sunny_coop_deadline',      '59 23 * * 4',   $$ select public.job_coop_deadline(); $$);
select cron.schedule('sunny_fair_open',          '0 0 * * 6',     $$ select public.job_fair_open(); $$);
select cron.schedule('sunny_contest_open_voting','0 0 * * 6',     $$ select public.job_contest_open_voting(); $$);
select cron.schedule('sunny_contest_judge',      '0 12 * * 0',    $$ select public.job_contest_judge(); $$);
select cron.schedule('sunny_fair_close',         '0 12 * * 0',    $$ select public.job_fair_close(); $$);
select cron.schedule('sunny_event_settle',       '0 20 * * 0',    $$ select public.job_event_settle(); $$);
select cron.schedule('sunny_week_rollover',      '59 23 * * 0',   $$ select public.job_week_rollover(); $$);
select cron.schedule('sunny_streak_freeze',      '0 0 * * *',     $$ select public.job_streak_freeze(); $$);
select cron.schedule('sunny_dau_recalc',         '0 1 * * *',     $$ select public.job_dau_recalc(); $$);
select cron.schedule('sunny_chat_gc',            '0 3 * * *',     $$ select public.job_chat_gc(); $$);
select cron.schedule('sunny_winback_scan',       '0 5 * * *',     $$ select public.job_winback_scan(); $$);
select cron.schedule('sunny_foraging_respawn',   '0 6 * * *',     $$ select public.job_foraging_respawn(); $$);
select cron.schedule('sunny_merge_check',        '0 6 * * *',     $$ select public.job_merge_check(); $$);
select cron.schedule('sunny_season_rollover',    '0 2 * * 1',     $$ select public.job_season_rollover(); $$);
