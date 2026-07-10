-- ============================================================================
-- 0014_hardening.sql — Sunnyside · Хардненинг по замечаниям Supabase Advisors
-- Закрывает WARN/INFO из APPLIED.md §«Замечания Supabase Advisors»:
--   (1) function_search_path_mutable — пиннит search_path на ВСЕХ функциях
--       public, где он ещё не зафиксирован (invoker-хелперы/триггеры; SECURITY
--       DEFINER-функции 0006/0013 уже пиннят его инлайн — они пропускаются).
--   (2) anon_security_definer_function_executable — REVOKE EXECUTE от anon на
--       мутационных RPC, требующих аккаунта (опираются на auth.uid(); для
--       анонима выродились бы в no_auth). authenticated-грант сохраняется.
--   (3) RLS-заплатка — повторный сплошной ENABLE RLS на всех таблицах public
--       (ловит таблицы, добавленные после 0005: 0008/0009 и т.д.); служебные
--       таблицы остаются deny-all (RLS без SELECT-политики, §3.3).
-- Идемпотентно: ALTER ... SET (повторно — no-op), REVOKE (повторно — no-op),
--   ENABLE RLS (повторно — no-op). Правок в 0001–0013 не вносит.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Пин search_path на всех функциях public без него (advisor: mutable path).
--    Не переопределяем тела — только ALTER FUNCTION ... SET (безопасно, точечно).
--    Пропускаем C-функции (расширения) и функции, где search_path уже задан.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and l.lanname <> 'c'                               -- не расширенческие C-функции
      and p.prokind in ('f')                             -- обычные функции (вкл. триггерные)
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search_path=%')
  loop
    begin
      execute format('alter function %s set search_path = public', r.sig);
    exception when others then
      raise notice 'skip pin search_path on %: %', r.sig, sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. REVOKE EXECUTE от anon на RPC, требующих аккаунта (auth.uid()).
--    Список = мутационный шлюз 0006 + соц-шлюз 0013. Ошибки (отсутствующая
--    подпись в редкой среде) — глушим, чтобы миграция оставалась идемпотентной.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'role anon missing — skip anon revokes (non-Supabase env)';
    return;
  end if;
  foreach fn in array array[
    -- 0006 — ферма/крафт/продажа/соц-вклад/животные/prize/стрик.
    'public.harvest(uuid[])','public.sow(int,text)','public.water(uuid[])',
    'public.craft_start(uuid,text,int)','public.craft_collect(uuid[])',
    'public.sell_to_market(text,int)','public.wallet_get()',
    'public.coop_contribute(uuid,text,int)','public.potluck_contribute(int,text,int)',
    'public.event_contribute(text,int,text)','public.help_neighbor(uuid,text)',
    'public.gift_send(uuid,text,int)','public.feed_animal(uuid[])',
    'public.collect_animal_product(uuid[])','public.prize_pull(text,int)',
    'public.streak_check()','public.streak_insure()',
    -- 0013 — соц-слой.
    'public.chat_post(text,text,text)','public.migration_propose(text,uuid)',
    'public.migration_vote(uuid,text)','public.migration_move(uuid)',
    'public.vacation_start(int)','public.vacation_end()',
    'public.neighbor_sit(uuid)','public.mentor_invite(uuid)',
    'public.mentor_complete(uuid,text)','public.decor_set(text,text,boolean,jsonb)',
    'public.neon_save(jsonb)','public.onboarding_step(int,text)'
  ] loop
    begin
      execute format('revoke execute on function %s from anon', fn);
    exception when others then
      raise notice 'skip anon revoke on %: %', fn, sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. RLS-заплатка: сплошной ENABLE RLS на всех таблицах public (§3.3).
--    Ловит таблицы, добавленные после 0005 (0008 private.* — вне public, не
--    затрагивается; служебные public-таблицы без SELECT-политики → deny-all).
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select format('%I.%I', schemaname, tablename) as t
    from pg_tables where schemaname = 'public'
  loop
    begin
      execute format('alter table %s enable row level security', r.t);
    exception when others then
      raise notice 'skip enable RLS on %: %', r.t, sqlerrm;
    end;
  end loop;
end $$;
