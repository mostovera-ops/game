-- ===========================================================================
-- 0015_followups.sql — «server-verdicts»: доводка серверных механик до канона.
--   Применяется через scripts/db-apply.mjs (одна транзакция begin/commit — обёртка
--   скрипта; здесь без явных begin/commit). Всё транзакционно-безопасно, включая
--   cron.schedule (тот же паттерн, что 0008_cron.sql).
--
--   (1) Стартовый кошелёк новичка → $150 / ◉5 (18-onboarding §3.1). Правим
--       game_configs.onboarding НА СЕРВЕРЕ (единый источник) — паритет с локальным
--       адаптером (net/local/world.ts) обеспечивается отдельно на клиенте.
--   (2) job_migration_execute — прошедшие голосования караванов/мерджей реально
--       исполняются недельной джобой: перенос игроков/стрита, компенсация вкладов
--       тикетами (50:1, кэп 500 — §4.4), Grand Reopening флаг (§3.3.4). + cron.
--   (3) job_farm_value_recompute — пересчёт players.farm_value по мастер-формуле
--       13-progression §3.4.1/§4.5 (веса W_bld/стафф/know-how/грядки/рецепты),
--       кап косметики/коллекций 15% (§3.4.1, DECISIONS-B 13-ОВ7/8). + cron.
--   (4) chat_post — экранирование regex-метасимволов банвордов (иначе banword с
--       '.'/'('/'*' и т.п. вёл бы себя как регэксп, а не как литерал).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- (1) Онбординг: стартовый кошелёк $150 / ◉5 (18-onboarding §3.1).
--     Обновляем ВСЕ версии onboarding-дока (config_ns_active берёт активную).
--     Существующие игроки не затрагиваются (кошелёк уже начислен через леджер);
--     правило действует для новых бутстрапов (ensure_bootstrap читает этот док).
-- ---------------------------------------------------------------------------
update public.game_configs
   set doc = jsonb_set(jsonb_set(doc, '{start_bucks}', '150'::jsonb), '{start_dimes}', '5'::jsonb),
       updated_at = now()
 where namespace = 'onboarding';

-- ---------------------------------------------------------------------------
-- (2a) Grand Reopening флаг на городе (12-migration §3.3.4/§4.3). Баннер на 7 дней
--      обоим городам при слиянии; читается клиентом как GrandReopeningState.
-- ---------------------------------------------------------------------------
alter table public.towns add column if not exists grand_reopening_until timestamptz;

-- ---------------------------------------------------------------------------
-- (2b) Хелпер: перенос одного игрока в целевой город/стрит с компенсацией вклада
--      в Town Projects старого города → 🎟 (курс 50:1, кэп 500 за переезд, §4.4).
--      Возвращает число начисленных тикетов. Логика зеркалит migration_move (0013).
-- ---------------------------------------------------------------------------
create or replace function public._migrate_player_to(
  p_player uuid, p_old_town uuid, p_target_town uuid, p_target_street uuid)
returns bigint language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_contrib bigint; v_tickets bigint;
begin
  select id into v_farm from public.farms where player_id = p_player;

  -- Персональный вклад в tp_* старого города (только bucks) → тикеты (50:1, кэп 500).
  select coalesce(sum(tpc.amount), 0) into v_contrib
    from public.town_project_contributions tpc
    join public.town_projects tp on tp.id = tpc.project_id
    where tpc.player_id = p_player and tp.town_id = p_old_town and tpc.currency = 'bucks';
  v_tickets := least(floor(v_contrib / 50)::bigint, 500);
  if v_tickets > 0 then
    perform public.ledger_write(p_player, 'tickets', v_tickets, 'migrate_compensation',
      'town', p_old_town::text);
  end if;

  -- Перенос фермы и игрока; смена/выход стрита; кулдаун/срок в городе — как личный переезд.
  if v_farm is not null then
    update public.farms set town_id = p_target_town, updated_at = now() where id = v_farm;
  end if;
  update public.players
    set town_id = p_target_town, street_id = p_target_street,
        last_migrated_at = now(), town_joined_at = now(), updated_at = now()
  where id = p_player;

  delete from public.street_members where player_id = p_player;
  if p_target_street is not null then
    insert into public.street_members(street_id, player_id, role)
      values (p_target_street, p_player, 'member')
      on conflict (player_id) do update set street_id = excluded.street_id;
  end if;

  return v_tickets;
end;
$$;

-- ---------------------------------------------------------------------------
-- (2c) Хелпер: перенос целого стрита в целевой город (караван §3.2 / стрит мерджа
--      §3.3.4 п.2). Занимает свободную улицу приёмника (без жителей); если такой
--      нет — создаёт новую с прежним name_key (§3.2.2, конфликт имён → новый пул
--      имён приёмника не моделируем, оставляем прежнее имя). Возвращает число
--      перенесённых игроков. Список игроков снимается в массив ДО мутаций
--      (street_members меняется внутри — нельзя итерировать курсором по ней).
-- ---------------------------------------------------------------------------
create or replace function public._migrate_street_to(p_street uuid, p_target_town uuid)
returns int language plpgsql security definer set search_path = public
as $$
declare
  v_old_town uuid; v_name text; v_target_street uuid;
  v_players uuid[]; v_pid uuid; v_n int := 0;
begin
  select town_id, name_key into v_old_town, v_name from public.streets where id = p_street;
  if v_old_town is null then return 0; end if;

  select s.id into v_target_street from public.streets s
    where s.town_id = p_target_town
      and not exists (select 1 from public.street_members sm where sm.street_id = s.id)
    order by s.created_at limit 1;
  if v_target_street is null then
    insert into public.streets(town_id, name_key) values (p_target_town, v_name)
      returning id into v_target_street;
  end if;

  select array_agg(player_id) into v_players
    from public.street_members where street_id = p_street;
  if v_players is not null then
    foreach v_pid in array v_players loop
      perform public._migrate_player_to(v_pid, v_old_town, p_target_town, v_target_street);
      v_n := v_n + 1;
    end loop;
  end if;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- (2d) job_migration_execute — исполнение прошедших голосований (state='passed').
--      Караван: переносит стрит целиком. Мердж: переносит все стриты угасающего
--      города + бесхозных жителей, ставит Grand Reopening обоим городам на 7 дней,
--      архивирует угасающий город. Компенсация вкладов — внутри переноса игрока.
--      Идемпотентно на игровой день (claim_idem). Дёргается недельным cron (Пн 00:00
--      UTC — граница недели, §3.3.4 п.1) и, при желании, Edge-мостом.
-- ---------------------------------------------------------------------------
create or replace function public.job_migration_execute()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[]; v_pid uuid; v_p public.migration_proposals;
  s record; v_target_street uuid; v_streetless uuid[]; m uuid;
  v_n_car int := 0; v_n_mrg int := 0;
begin
  if not public.claim_idem('migration_execute', public.game_day()::text) then
    return jsonb_build_object('skipped', true);
  end if;

  select array_agg(id order by opened_at) into v_ids
    from public.migration_proposals where state = 'passed';
  if v_ids is null then
    return jsonb_build_object('caravans', 0, 'merges', 0);
  end if;

  foreach v_pid in array v_ids loop
    select * into v_p from public.migration_proposals where id = v_pid for update;
    if v_p.state <> 'passed' then continue; end if;         -- защита от повторного захода

    if v_p.target_town_id is null then
      update public.migration_proposals set state = 'failed', updated_at = now() where id = v_p.id;
      continue;
    end if;

    if v_p.kind = 'street_caravan' then
      perform public._migrate_street_to(v_p.scope_id, v_p.target_town_id);
      v_n_car := v_n_car + 1;

    elsif v_p.kind = 'town_merge' then
      -- Все стриты угасающего города → приёмник.
      for s in select id from public.streets where town_id = v_p.scope_id loop
        perform public._migrate_street_to(s.id, v_p.target_town_id);
      end loop;

      -- Бесхозные (без street_members) жители, оставшиеся в старом городе.
      select array_agg(id) into v_streetless
        from public.players where town_id = v_p.scope_id;
      if v_streetless is not null then
        select s.id into v_target_street from public.streets s
          where s.town_id = v_p.target_town_id order by s.created_at limit 1;
        if v_target_street is null then
          insert into public.streets(town_id, name_key) values (v_p.target_town_id, 'street_maple')
            returning id into v_target_street;
        end if;
        foreach m in array v_streetless loop
          if exists (select 1 from public.players where id = m and town_id = v_p.scope_id) then
            perform public._migrate_player_to(m, v_p.scope_id, v_p.target_town_id, v_target_street);
          end if;
        end loop;
      end if;

      -- Grand Reopening обоим городам на 7 дней (§3.3.4 п.4); угасающий → archived.
      update public.towns
        set grand_reopening_until = now() + interval '7 days', updated_at = now()
        where id in (v_p.scope_id, v_p.target_town_id);
      update public.towns set status = 'archived', updated_at = now() where id = v_p.scope_id;
      v_n_mrg := v_n_mrg + 1;
    end if;

    update public.migration_proposals set state = 'executed', updated_at = now() where id = v_p.id;
  end loop;

  return jsonb_build_object('caravans', v_n_car, 'merges', v_n_mrg);
end;
$$;

-- ---------------------------------------------------------------------------
-- (3) job_farm_value_recompute — пересчёт players.farm_value по мастер-формуле
--     13-progression §3.4.1/§4.5. core_fv (производственная мощь) + косметика/
--     коллекции с капом 15%. Оси, не смоделированные серверно (orchard-грядки,
--     animal_fv, decor_score), берутся 0 — паритет с локальным адаптером
--     (net/adapters/local.ts::recomputeFarmValue), «не выдумываем».
--       core_fv    = Σ(level^1.5 × W_bld) + Σ(staff.level)×40 + know_how_done×60
--                    + plots×15 + Σ(mastery★)×10
--       cosmetic   = toys×20 + ribbons×100 + postcards×15
--       capped     = min(cosmetic, core × 0.15/0.85)   (доля косметики в total ≤ 15%)
--       farm_value = round(core + capped)
-- ---------------------------------------------------------------------------
create or replace function public.job_farm_value_recompute()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_build numeric; v_staff numeric; v_kh numeric; v_plots numeric; v_rec numeric;
  v_core numeric; v_soft numeric; v_capped numeric; v_total bigint; v_n int := 0;
begin
  if not public.claim_idem('farm_value_recompute', public.game_day()::text) then
    return jsonb_build_object('skipped', true);
  end if;

  for r in select p.id as pid, f.id as fid
             from public.players p join public.farms f on f.player_id = p.id loop
    -- Постройки: Σ level^1.5 × W_bld (§3.4.1; bld_apiary без веса → 0).
    select coalesce(sum(power(b.level, 1.5) * case b.building_key
             when 'bld_house'    then 120 when 'bld_diner'  then 100
             when 'bld_kitchen'  then 100 when 'bld_garage' then 80
             when 'bld_barn'     then 70  when 'bld_coop'   then 50
             when 'bld_silo'     then 40  when 'bld_icehouse' then 40
             else 0 end), 0)
      into v_build from public.buildings b where b.farm_id = r.fid;

    select coalesce(sum(sr.level), 0) * 40 into v_staff
      from public.staff_roster sr where sr.player_id = r.pid;

    select coalesce(count(*), 0) * 60 into v_kh
      from public.know_how_nodes n where n.player_id = r.pid and n.state = 'done';

    select coalesce(count(*), 0) * 15 into v_plots
      from public.plots pl where pl.farm_id = r.fid;

    select coalesce(sum(greatest(rm.stars, 0)), 0) * 10 into v_rec
      from public.recipes_mastery rm where rm.player_id = r.pid;

    select coalesce((select count(*) from public.toys        t  where t.player_id  = r.pid), 0) * 20
         + coalesce((select count(*) from public.ribbons_wall rw where rw.player_id = r.pid), 0) * 100
         + coalesce((select count(*) from public.postcards    pc where pc.player_id = r.pid), 0) * 15
      into v_soft;

    v_core   := v_build + v_staff + v_kh + v_plots + v_rec;   -- animals/orchard/decor = 0 (не смоделированы серверно)
    v_capped := least(v_soft, v_core * 0.15 / 0.85);          -- кап косметики 15% total (§3.4.1)
    v_total  := round(v_core + v_capped)::bigint;

    update public.players set farm_value = v_total, updated_at = now() where id = r.pid;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('recomputed', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- (4) chat_post — экранирование regex-метасимволов банвордов. Прежняя версия
--     подставляла банворд прямо в regexp_replace как ПАТТЕРН: banword с '.', '(',
--     '*', '[' и т.п. интерпретировался как регэксп (мог не сматчиться / сматчить
--     лишнее / бросить ошибку невалидного паттерна). Теперь каждый банворд
--     экранируется (все не-буквенно-цифровые символы префиксуются '\') перед
--     подстановкой. Остальная логика идентична 0013 (мягкий фильтр, P3).
-- ---------------------------------------------------------------------------
create or replace function public.chat_post(
  p_channel_kind text, p_body text default null, p_sticker_key text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_town uuid; v_street uuid; v_farm uuid;
  v_channel text; v_limit int; v_win timestamptz; v_cnt int;
  v_ban jsonb; v_word text; v_pat text; v_clean text;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_channel_kind not in ('town','street') then raise exception 'bad_channel'; end if;
  if (p_body is null or char_length(btrim(p_body)) = 0) and p_sticker_key is null then
    raise exception 'empty_message';
  end if;
  if p_body is not null and char_length(p_body) > 500 then raise exception 'too_long'; end if;

  select town_id, street_id into v_town, v_street from public.players where id = v_uid;
  select id into v_farm from public.farms where player_id = v_uid;

  if p_channel_kind = 'town' then
    if v_town is null then raise exception 'no_town'; end if;
    v_channel := 'town:' || v_town::text;
  else
    if v_street is null then raise exception 'no_street'; end if;
    v_channel := 'street:' || v_street::text;
  end if;

  v_limit := coalesce((public.config_doc(v_farm,'caps')->>'chat_rate_per_min')::int, 10);
  v_win := date_trunc('minute', now());
  insert into public.rate_limits(player_id, bucket, window_start, count)
  values (v_uid, 'chat', v_win, 1)
  on conflict (player_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_cnt;
  if v_cnt > v_limit then
    perform public.log_audit(v_uid, 'chat_post', 'rejected', 'rate_limited');
    raise exception 'rate_limited';
  end if;

  -- Мягкий фильтр банвордов: маскируем '***', сообщение не блокируем (P3).
  -- Банворд экранируется как ЛИТЕРАЛ (все не-alnum символы → '\'+символ), чтобы
  -- regex-метасимволы внутри словаря не меняли поведение и не роняли паттерн.
  v_clean := p_body;
  if v_clean is not null then
    v_ban := coalesce(public.config_doc(v_farm,'moderation')->'banwords', '[]'::jsonb);
    for v_word in select jsonb_array_elements_text(v_ban) loop
      if v_word is not null and char_length(v_word) > 0 then
        v_pat := regexp_replace(v_word, '([^[:alnum:]])', '\\\1', 'g');
        v_clean := regexp_replace(v_clean, v_pat, '***', 'gi');
      end if;
    end loop;
  end if;

  insert into public.chat_messages(channel, author_id, body, sticker_key)
  values (v_channel, v_uid, v_clean, p_sticker_key);

  perform public.log_audit(v_uid, 'chat_post', 'ok',
    case when v_clean is distinct from p_body then 'filtered' else null end);
  return jsonb_build_object('channel', v_channel, 'filtered', v_clean is distinct from p_body);
end;
$$;

-- ---------------------------------------------------------------------------
-- (5) Cron-регистрация новых недельных джоб. Идемпотентно: снимаем прежние, ставим
--     заново (паттерн 0008 §13). migration_execute — Пн 00:00 UTC (граница недели,
--     §3.3.4); farm_value_recompute — Пн 00:10 UTC (после переносов).
-- ---------------------------------------------------------------------------
do $$
declare j text;
begin
  foreach j in array array['sunny_migration_execute','sunny_farm_value_recompute'] loop
    begin perform cron.unschedule(j); exception when others then null; end;
  end loop;
end $$;

select cron.schedule('sunny_migration_execute',   '0 0 * * 1',  $$ select public.job_migration_execute(); $$);
select cron.schedule('sunny_farm_value_recompute', '10 0 * * 1', $$ select public.job_farm_value_recompute(); $$);
