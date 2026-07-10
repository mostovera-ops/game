-- ============================================================================
-- 0013_server_social.sql — Sunnyside · Социальный слой (RPC, SECURITY DEFINER)
-- Реализует 20-backend.md §3.2.6 (чат/помощь/менторство/визиты), §3.2.15
--   (переезды/Vacation/Neighbor Sitter), §3.4.1 («горячий путь» RPC), §3.7
--   (сервер реконструирует результат; клиентские числа игнорируются).
-- Спеки-эталоны: 11-town.md (чат/менторство/potluck/town-map), 12-migration.md
--   (Moving Van / Street Caravan / Town Merge — кулдауны/кворумы/компенсация),
--   18-onboarding.md (мини-неделя t_day_1..7 → FTUE → Grand Opening).
-- Конвенции 0006: p_-префикс, идемпотентность по request_id (шлюз), движение
--   валюты — только через public.ledger_write (триггер-гард 0006 §2), сток —
--   только через inv_add/inv_remove. Все RPC пиннят search_path = public.
-- Домены НЕ пересекаются с 0006 (ферма/крафт/ивент/prize base) — prize_pull
--   здесь ПЕРЕОПРЕДЕЛЯЕТСЯ (донастройка pity/free-pull, §9).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Данные-заготовки под домен.
-- ---------------------------------------------------------------------------

-- 0.1 Модерация чата: словарь банвордов (мягкий фильтр, 11-town §3.9 / P3).
--     Читается через config_doc(farm,'moderation')->'banwords'. Версия словаря —
--     chat_filter_wordlist_version (23-telemetry §4). Список — заглушка-каркас;
--     финал ведёт Trust & Safety через game_config (не хардкод в коде).
do $$
declare v_ver uuid;
begin
  select id into v_ver from public.config_versions
    where id = '00000000-0000-0000-0000-0000000c0f19' or state = 'active'
    order by (id = '00000000-0000-0000-0000-0000000c0f19') desc, activated_at desc nulls last
    limit 1;
  if v_ver is null then
    raise notice 'no active config version — skip moderation seed';
    return;
  end if;
  insert into public.game_configs(namespace, version_id, doc)
  values ('moderation', v_ver, $json$
  {
    "chat_filter_wordlist_version": 1,
    "reserved_handles": ["sheriff","mayor","calloway","whittaker","staff","admin"],
    "banwords": ["badword1", "badword2", "slur_placeholder"]
  }$json$::jsonb)
  on conflict (namespace, version_id) do update set doc = excluded.doc, updated_at = now();
end $$;

-- 0.2 Prize Machine хранит 4 редкости (canon K2: common/uncommon/rare/chase).
--     Таблица toys (0004) допускала только common/rare/chase — расширяем под
--     дроп-таблицу конфига (68/24/6.5/1.5), иначе uncommon-игрушка не пишется.
do $$
begin
  alter table public.toys drop constraint if exists toys_rarity_check;
  alter table public.toys
    add constraint toys_rarity_check
    check (rarity in ('common','uncommon','rare','chase'));
exception when others then
  raise notice 'toys rarity constraint reshape skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 1. chat_post (11-town §3.9). Каналы town/street игрока; rate-limit из caps;
--    мягкий фильтр банвордов; длина ≤500 (совпадает с CHECK chat_messages.body).
-- ---------------------------------------------------------------------------
create or replace function public.chat_post(
  p_channel_kind text, p_body text default null, p_sticker_key text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_town uuid; v_street uuid; v_farm uuid;
  v_channel text; v_limit int; v_win timestamptz; v_cnt int;
  v_ban jsonb; v_word text; v_clean text;
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

  -- Rate-limit (окно = минута; лимит из caps.chat_rate_per_min, дефолт 10).
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
  v_clean := p_body;
  if v_clean is not null then
    v_ban := coalesce(public.config_doc(v_farm,'moderation')->'banwords', '[]'::jsonb);
    for v_word in select jsonb_array_elements_text(v_ban) loop
      if v_word is not null and char_length(v_word) > 0 then
        v_clean := regexp_replace(v_clean, v_word, '***', 'gi');
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
-- 2. migration_propose (12-migration §3.2). Игрок инициирует Street Caravan
--    своего стрита в открытый город со свободной улицей. Town Merge —
--    системная механика (job_merge_check 0008), игроку недоступна.
-- ---------------------------------------------------------------------------
create or replace function public.migration_propose(
  p_kind text, p_target_town uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_street uuid; v_town uuid; v_free boolean; v_id uuid;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_kind = 'town_merge' then raise exception 'system_only'; end if;   -- §3.3, только cron
  if p_kind <> 'street_caravan' then raise exception 'bad_kind'; end if;

  select street_id, town_id into v_street, v_town from public.players where id = v_uid;
  if v_street is null then raise exception 'no_street'; end if;
  if p_target_town is null or p_target_town = v_town then raise exception 'bad_target'; end if;

  -- Цель открыта?
  if not exists (select 1 from public.towns where id = p_target_town and status = 'open') then
    raise exception 'target_closed';
  end if;

  -- Есть ли свободная улица (пустой слот) или ёмкость под новую (≤12 улиц, 11-town §3.1).
  v_free := exists (
      select 1 from public.streets s
      where s.town_id = p_target_town
        and (select count(*) from public.street_members m where m.street_id = s.id) = 0)
    or (select count(*) from public.streets where town_id = p_target_town) < 12;
  if not v_free then raise exception 'no_free_street'; end if;

  -- Анти-спам: если недавнее (7 дней) предложение по этому стриту провалилось — рано (§3.2.1).
  if exists (
    select 1 from public.migration_proposals
    where scope_id = v_street and kind = 'street_caravan'
      and state = 'failed' and updated_at > now() - interval '7 days') then
    perform public.log_audit(v_uid, 'migration_propose', 'rejected', 'reproposal_cooldown');
    raise exception 'reproposal_cooldown';
  end if;

  -- Одно активное голосование на стрит — enforced частичным unique-индексом (0002).
  insert into public.migration_proposals(kind, scope_id, target_town_id, opened_at, closes_at, state)
  values ('street_caravan', v_street, p_target_town, now(), now() + interval '72 hours', 'voting')
  returning id into v_id;

  perform public.log_audit(v_uid, 'migration_propose', 'ok');
  return jsonb_build_object('proposal', v_id, 'closes_at', now() + interval '72 hours');
exception when unique_violation then
  perform public.log_audit(v_uid, 'migration_propose', 'rejected', 'already_voting');
  raise exception 'already_voting';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. migration_vote (12-migration §3.2.1/§3.3.3). 1 голос/предложение/игрок
--    (unique 0002). Кворум: caravan 60% состава стрита, merge 50% активных
--    жителей города (Vacation — вне числителя и знаменателя, §3.3.3). Достигнут
--    кворум → 'passed'; исполнение переезда — фаза ролловера (Deploy-домен).
-- ---------------------------------------------------------------------------
create or replace function public.migration_vote(p_proposal uuid, p_vote text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.migration_proposals;
  v_eligible boolean; v_yes int; v_total int; v_quorum numeric; v_state text;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_vote not in ('yes','no') then raise exception 'bad_vote'; end if;

  select * into v_p from public.migration_proposals where id = p_proposal for update;
  if v_p.id is null then raise exception 'no_proposal'; end if;
  if v_p.state <> 'voting' then raise exception 'not_voting'; end if;
  if now() >= v_p.closes_at then
    update public.migration_proposals set state = 'failed', updated_at = now() where id = v_p.id;
    raise exception 'vote_closed';
  end if;

  -- Право голоса: член стрита (caravan) / житель города (merge); не в отпуске.
  if v_p.kind = 'street_caravan' then
    v_eligible := exists (select 1 from public.players
      where id = v_uid and street_id = v_p.scope_id and status <> 'vacation');
    v_quorum := coalesce((public.config_doc(
      (select id from public.farms where player_id = v_uid),'caps')->>'quorum_caravan_pct')::numeric, 60);
  else
    v_eligible := exists (select 1 from public.players
      where id = v_uid and town_id = v_p.scope_id and status <> 'vacation');
    v_quorum := coalesce((public.config_doc(
      (select id from public.farms where player_id = v_uid),'caps')->>'quorum_merge_pct')::numeric, 50);
  end if;
  if not v_eligible then raise exception 'not_eligible'; end if;

  -- Запись/смена голоса (до закрытия менять можно).
  insert into public.migration_votes(proposal_id, player_id, vote)
  values (p_proposal, v_uid, p_vote)
  on conflict (proposal_id, player_id) do update set vote = excluded.vote, at = now();

  -- Пересчёт кворума. Знаменатель — активные (не Vacation/banned) в scope.
  select count(*) filter (where mv.vote = 'yes') into v_yes
    from public.migration_votes mv where mv.proposal_id = p_proposal;
  if v_p.kind = 'street_caravan' then
    select count(*) into v_total from public.players
      where street_id = v_p.scope_id and status not in ('vacation','banned');
  else
    select count(*) into v_total from public.players
      where town_id = v_p.scope_id and status not in ('vacation','banned');
  end if;

  v_state := v_p.state;
  if v_total > 0 and (100.0 * v_yes / v_total) >= v_quorum then
    update public.migration_proposals set state = 'passed', updated_at = now() where id = v_p.id;
    v_state := 'passed';
  end if;

  perform public.log_audit(v_uid, 'migration_vote', 'ok');
  return jsonb_build_object('yes', v_yes, 'eligible', v_total, 'quorum_pct', v_quorum, 'state', v_state);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. migration_move — Moving Van (12-migration §3.1). Личный переезд в открытый
--    город: кулдаун 14 дн (last_migrated_at), мин. срок 3 дня (town_joined_at),
--    цель ≠ текущий. Переносит ферму 1:1 (меняем town_id), выходит из стрита,
--    конвертирует личный вклад в Town Projects старого города → 🎟 (курс 50:1,
--    кэп 500/переезд, §3.4/§4.4). Скип за ◉ невозможен (12-O1).
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

  -- Цель открыта и со свободной ёмкостью (< town_capacity жителей).
  select (t.status = 'open'
          and (select count(*) from public.players p where p.town_id = t.id)
              < coalesce((v_caps->>'town_capacity')::int, t.capacity))
    into v_free
    from public.towns t where t.id = p_target_town;
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
-- 5. Vacation Mode — Gone Fishin' (12-migration §3.1.2; 11-town E6/T12).
--    vacation_start: консервирует ферму (status/vacation_until). vacation_end:
--    возвращает в активные. Переезд/голосование во время отпуска заблокированы.
-- ---------------------------------------------------------------------------
create or replace function public.vacation_start(p_days int default 14)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_until timestamptz; v_days int;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  v_days  := least(greatest(coalesce(p_days,14), 1), 60);   -- 1..60 дней
  v_until := now() + make_interval(days => v_days);
  update public.players
    set status = 'vacation', vacation_until = v_until, updated_at = now()
  where id = v_uid and status <> 'banned';
  if not found then raise exception 'no_player'; end if;
  perform public.log_audit(v_uid, 'vacation_start', 'ok');
  return jsonb_build_object('vacation_until', v_until);
end;
$$;

create or replace function public.vacation_end()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  update public.players
    set status = 'active', vacation_until = null, updated_at = now()
  where id = v_uid and status = 'vacation';
  perform public.log_audit(v_uid, 'vacation_end', 'ok');
  return jsonb_build_object('status', 'active');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. neighbor_sit (11-town §3.10 E6/T12; 0002 uq_neighbor_sits_host_day).
--    Присмотр за фермой соседа-в-отпуске: 1 оплачиваемая награда/ферма/день —
--    первый смотритель (unique-индекс), анти-манекен. Награда 🎟 капается.
-- ---------------------------------------------------------------------------
create or replace function public.neighbor_sit(p_host uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_host public.players; v_reward int := 1;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_host = v_uid then raise exception 'self_sit'; end if;

  select * into v_host from public.players where id = p_host;
  if v_host.id is null then raise exception 'no_host'; end if;
  if v_host.status <> 'vacation' then raise exception 'host_not_vacation'; end if;
  -- Только сосед по городу (витрина/помощь — в пределах города, 11-town §3.10).
  if v_host.town_id is distinct from (select town_id from public.players where id = v_uid) then
    raise exception 'not_same_town';
  end if;

  -- Первый смотритель дня получает награду; повтор — no-op без начисления.
  insert into public.neighbor_sits(host_id, sitter_id, game_day)
  values (p_host, v_uid, public.game_day())
  on conflict (host_id, game_day) do nothing;
  if not found then
    return jsonb_build_object('sat', true, 'rewarded', false);   -- уже присмотрели сегодня
  end if;

  perform public.ledger_write(v_uid, 'tickets', v_reward, 'neighbor_sit', 'player', p_host::text);
  perform public.log_audit(v_uid, 'neighbor_sit', 'ok');
  return jsonb_build_object('sat', true, 'rewarded', true, 'tickets', v_reward);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Менторство (11-town §3.7). mentor_invite: ветеран (ферма ≥8) берёт менти
--    (≤2 активных, caps.mentor_max_mentees), смурф-фильтр по отпечатку.
--    mentor_complete: веха адаптации менти → 🎟 обоим (кап), выпуск на lvl5.
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

create or replace function public.mentor_complete(p_mentee uuid, p_milestone text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_m public.mentorships; v_reward int; v_grad boolean := false;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  select * into v_m from public.mentorships
    where mentor_id = v_uid and mentee_id = p_mentee for update;
  if v_m.id is null then raise exception 'no_mentorship'; end if;
  if v_m.state <> 'active' then raise exception 'not_active'; end if;

  -- Награда 🎟 обоим по вехе (капы соц-🎟 — 11-town §3.4.1; здесь скромный фикс).
  v_reward := case p_milestone
    when 'first_fair_sale'  then 2
    when 'first_coop'       then 2
    when 'first_potluck'    then 1
    when 'reached_level_5'  then 1
    else 1 end;

  perform public.ledger_write(v_uid,      'tickets', v_reward, 'mentor_milestone', 'mentorship', v_m.id::text);
  perform public.ledger_write(p_mentee,   'tickets', v_reward, 'mentee_milestone', 'mentorship', v_m.id::text);

  -- Выпуск на достижении уровня 5 (§3.7): менторство → graduated.
  if p_milestone = 'reached_level_5' then
    update public.mentorships set state = 'graduated' where id = v_m.id;
    v_grad := true;
  end if;

  perform public.log_audit(v_uid, 'mentor_complete', 'ok', p_milestone);
  return jsonb_build_object('milestone', p_milestone, 'tickets_each', v_reward, 'graduated', v_grad);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Косметика витрины (11-town §3.10). decor_set: разместить/убрать декор
--    (только владелец предмета). neon_save: неон-вывеска фермы (ui_neon_builder).
--    Оба — самовыражение (P4), не влияют на силу; сервер лишь валидирует владение.
-- ---------------------------------------------------------------------------
create or replace function public.decor_set(
  p_decor_key text, p_slot text default null, p_placed boolean default true, p_layout jsonb default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_farm uuid; v_owned boolean;
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_decor_key is null then raise exception 'bad_decor'; end if;
  if p_slot is not null and p_slot not in ('interior','yard','facade') then
    raise exception 'bad_slot';
  end if;

  select id into v_farm from public.farms where player_id = v_uid;

  -- Владение: уже есть строка декора ИЛИ декор лежит на складе (item_class='decor').
  v_owned := exists (select 1 from public.player_decor where player_id = v_uid and decor_key = p_decor_key)
          or exists (select 1 from public.inventory
                     where farm_id = v_farm and item_key = p_decor_key and item_class = 'decor' and qty > 0);
  if not v_owned then
    perform public.log_audit(v_uid, 'decor_set', 'rejected', 'not_owned');
    raise exception 'decor_not_owned';
  end if;

  insert into public.player_decor(player_id, decor_key, slot, placed, layout)
  values (v_uid, p_decor_key, p_slot, coalesce(p_placed, true), p_layout)
  on conflict (player_id, decor_key)
  do update set slot = coalesce(excluded.slot, public.player_decor.slot),
                placed = excluded.placed,
                layout = coalesce(excluded.layout, public.player_decor.layout),
                updated_at = now();

  perform public.log_audit(v_uid, 'decor_set', 'ok');
  return jsonb_build_object('decor_key', p_decor_key, 'placed', coalesce(p_placed, true));
end;
$$;

create or replace function public.neon_save(p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'no_auth'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'bad_config'; end if;
  if length(p_config::text) > 8192 then raise exception 'config_too_large'; end if;   -- анти-абуз объёма

  insert into public.player_neon_sign(player_id, config, updated_at)
  values (v_uid, p_config, now())
  on conflict (player_id) do update set config = excluded.config, updated_at = now();

  perform public.log_audit(v_uid, 'neon_save', 'ok');
  return jsonb_build_object('saved', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. prize_pull — донастройка pity/free-pull (15-monetization; canon K2/§2.9).
--    ПЕРЕОПРЕДЕЛЯЕТ 0006: (a) 4 редкости из config drop_rates_pct (68/24/6.5/1.5),
--    (b) дневной free-pull (free_pull_daily, cost 0, не списывает ◉),
--    (c) pity Rare≤10/Chase≤40 из конфига, (d) дубли → scrap (dupes_to_scrap).
--    Сервер считает исход и pity (§3.7); клиентские числа игнорируются.
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
-- 10. onboarding_step (18-onboarding §3.2/§3.3). Продвигает мини-неделю
--     t_day_1..7 (гейт действием, не временем; монотонно). Финал → FTUE
--     complete + Grand Opening ×2 на 7×24ч (farms.grand_opening_until, R1).
--     Skip-путь (p_flag='skip') для квалифицированных (§3.7): сразу FTUE+GO.
-- ---------------------------------------------------------------------------
create or replace function public.onboarding_step(
  p_step int default null, p_flag text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_st public.onboarding_state; v_complete boolean;
begin
  if v_uid is null then raise exception 'no_auth'; end if;

  insert into public.onboarding_state(player_id) values (v_uid)
    on conflict (player_id) do nothing;
  select * into v_st from public.onboarding_state where player_id = v_uid for update;

  -- Монотонное продвижение t_day (0..7); флаги — накопительный merge.
  if p_step is not null then
    v_st.t_day := greatest(v_st.t_day, least(p_step, 7));
  end if;
  if p_flag is not null then
    v_st.flags := coalesce(v_st.flags, '{}'::jsonb) || jsonb_build_object(p_flag, true);
  end if;

  -- FTUE complete: дошёл до t_day_7, либо явный skip/ftue_complete флаг.
  v_complete := v_st.ftue_complete
             or v_st.t_day >= 7
             or p_flag in ('skip','ftue_complete');

  update public.onboarding_state
    set t_day = v_st.t_day,
        flags = v_st.flags,
        ftue_complete = v_complete,
        skipped = coalesce(v_st.skipped, false) or (p_flag = 'skip'),
        updated_at = now()
  where player_id = v_uid;

  -- Grand Opening ×2 (7×24ч) при первом завершении FTUE (E8; core-loop §3.10).
  if v_complete and not coalesce(v_st.ftue_complete, false) then
    update public.farms
      set grand_opening_until = now() + interval '7 days', updated_at = now()
    where player_id = v_uid and grand_opening_until is null;
  end if;

  perform public.log_audit(v_uid, 'onboarding_step', 'ok');
  return jsonb_build_object('t_day', v_st.t_day, 'ftue_complete', v_complete);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Гранты выполнения: соц-RPC — authenticated (опираются на auth.uid()).
--     REVOKE от anon — в 0014 (хардненинг). Внутренние хелперы не трогаем.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'role authenticated missing — skip grants (non-Supabase env)';
    return;
  end if;
  foreach fn in array array[
    'public.chat_post(text,text,text)',
    'public.migration_propose(text,uuid)',
    'public.migration_vote(uuid,text)',
    'public.migration_move(uuid)',
    'public.vacation_start(int)',
    'public.vacation_end()',
    'public.neighbor_sit(uuid)',
    'public.mentor_invite(uuid)',
    'public.mentor_complete(uuid,text)',
    'public.decor_set(text,text,boolean,jsonb)',
    'public.neon_save(jsonb)',
    'public.onboarding_step(int,text)'
  ] loop
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
