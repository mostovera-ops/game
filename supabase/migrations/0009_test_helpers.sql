-- ============================================================================
-- 0009_test_helpers.sql — Sunnyside · DEV-хелперы для облачной верификации (C4).
--
-- НАЗНАЧЕНИЕ: интеграционные сьюты против РЕАЛЬНОГО проекта не могут «ждать»
-- реальные таймеры грядок/станков (T1-цикл 5–15 мин). Эта миграция добавляет
-- безопасную dev-функцию ускорения таймеров фермы — сдвигает серверные метки
-- назад во времени, чтобы `now() >= ready_at` наступило немедленно.
--
-- БЕЗОПАСНОСТЬ (важно): функция доступна ТОЛЬКО service_role (Edge/SQL-канал).
--   - EXECUTE отозван у public/anon/authenticated, выдан только service_role;
--   - плюс раннер-гард: любой вызов под клиентской ролью (anon/authenticated)
--     завершается `forbidden` до каких-либо мутаций.
-- Клиент через RPC вызвать её не может (нет EXECUTE + гард). Прод-баланс не
-- затрагивается: это отдельная миграция, функция никем из RPC/cron не зовётся.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- test_advance_timers(p_farm, p_minutes): сдвигает ВСЕ серверные таймеры фермы
-- на p_minutes назад (grow/craft/animal/expedition) и промоутит созревшие
-- грядки growing→ready. Возвращает сводку затронутого. Идемпотентна по эффекту
-- (повторный вызов просто ещё сдвигает — тест контролирует величину).
-- ---------------------------------------------------------------------------
create or replace function public.test_advance_timers(p_farm uuid, p_minutes int)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.role', true), '');
  v_int  interval;
  v_plots int; v_jobs int; v_animals int; v_exps int;
begin
  -- Гард: только service_role. Клиентские роли (anon/authenticated) — отказ.
  if current_user in ('anon', 'authenticated')
     or v_role in ('anon', 'authenticated') then
    raise exception 'forbidden: test_advance_timers is service_role/dev only'
      using errcode = 'insufficient_privilege';
  end if;
  if p_minutes <= 0 then
    raise exception 'bad_minutes: must be > 0';
  end if;

  v_int := make_interval(mins => p_minutes);

  update public.plots
    set planted_at    = planted_at - v_int,
        ready_at      = ready_at   - v_int,
        watered_until = case when watered_until is not null then watered_until - v_int end,
        state         = case
                          when state = 'growing' and now() >= (ready_at - v_int)
                          then 'ready' else state end,
        updated_at    = now()
  where farm_id = p_farm and ready_at is not null;
  get diagnostics v_plots = row_count;

  update public.machine_jobs
    set started_at = started_at - v_int,
        ready_at   = ready_at   - v_int
  where farm_id = p_farm and collected = false;
  get diagnostics v_jobs = row_count;

  update public.animals
    set fed_at            = case when fed_at is not null then fed_at - v_int end,
        product_ready_at  = case when product_ready_at is not null then product_ready_at - v_int end,
        updated_at        = now()
  where farm_id = p_farm;
  get diagnostics v_animals = row_count;

  update public.expeditions
    set departed_at = departed_at - v_int,
        return_at   = return_at   - v_int
  where farm_id = p_farm and collected = false;
  get diagnostics v_exps = row_count;

  return jsonb_build_object(
    'advanced_min', p_minutes,
    'farm', p_farm,
    'plots', v_plots, 'jobs', v_jobs, 'animals', v_animals, 'expeditions', v_exps);
end;
$$;

-- EXECUTE: только service_role. Отозвать у всех клиентских ролей.
do $$
begin
  execute 'revoke all on function public.test_advance_timers(uuid,int) from public';
  begin execute 'revoke all on function public.test_advance_timers(uuid,int) from anon, authenticated'; exception when others then null; end;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.test_advance_timers(uuid,int) to service_role';
  end if;
end $$;
