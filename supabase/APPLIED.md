# APPLIED — Sunnyside · применение миграций к Supabase

- **Проект:** `pvautnecztynbnzrrdra` («farm-truck-game»)
- **Дата применения:** 2026-07-10 (UTC)
- **Канал:** `POST https://api.supabase.com/v1/projects/<ref>/database/query` через `curl -4` (node fetch виснет на IPv6 к api.supabase.com — подтверждено).
- **Инструмент:** `scripts/db-apply.mjs` (проверен на `--status`, работает; каждая миграция = одна транзакция `begin/commit`).
- **Реестр применённого:** таблица `public._sunnyside_migrations` (создаётся скриптом).
- **Спека-эталон:** `docs/specs/20-backend.md`.

## Итог

**Все 7 миграций применены по порядку с первого прохода. SQL-ошибок — 0. Правок в файлах миграций — 0.**

| # | Файл | Статус | applied_at (UTC) |
|---|------|--------|------------------|
| 1 | `0001_core.sql` | OK | 2026-07-10 06:48:26 |
| 2 | `0002_social.sql` | OK | 2026-07-10 06:48:27 |
| 3 | `0003_week.sql` | OK | 2026-07-10 06:48:30 |
| 4 | `0004_meta.sql` | OK | 2026-07-10 06:48:32 |
| 5 | `0005_rls.sql` | OK | 2026-07-10 06:48:33 |
| 6 | `0006_functions.sql` | OK | 2026-07-10 06:48:36 |
| 7 | `0007_seed.sql` | OK | 2026-07-10 06:48:37 |

## Доступ / токен (важно для последующих запусков)

- Keychain-сервис **`"Supabase CLI"` виснет** при чтении (`security find-generic-password -s "Supabase CLI" -w` не возвращается — вероятно ACL с GUI-подтверждением, которое некому нажать). Прямой вызов `security ... "Supabase CLI"` заблокировал даже команду с `curl --max-time`.
- **Рабочий источник токена — запасной сервис `"Supabase Sunnyside PAT"`:** `security find-generic-password -s "Supabase Sunnyside PAT" -w` → `sbp_…` (rc=0, мгновенно).
- Чтобы `db-apply.mjs` не трогал зависающий keychain, запускать с уже добытым токеном в env:
  `SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase Sunnyside PAT" -w) node scripts/db-apply.mjs`

## Верификация (сверка с 20-backend.md)

- **Расширения (§3.1):** `pgcrypto`, `pg_cron`, `pg_net`, `uuid-ossp`, `pg_stat_statements` — все включены (+ `plpgsql`, `supabase_vault` штатно). ✅
- **Таблицы:** 80 игровых таблиц в `public` (+ служебная `_sunnyside_migrations`). Спека — «~75 таблиц, ~17 доменов». ✅ Присутствуют ключевые: `players/farms/towns/streets/street_members`, `plots/buildings/machines/machine_jobs/inventory/recipes/recipes_mastery`, `animals/holding_pen`, `staff_*`, `know_how_nodes/player_know_how/player_state_counters`, `expeditions`, `server_calendars/processed_anchors`, `market_weeks`, `orders/order_contributions/potlucks/help_actions/gifts/mentorships/town_projects/chat_messages/farm_visits`, `fair_*`, `contests/contest_entries/contest_votes`, `event_*`, `collections/toys/ribbons_wall/postcards/farm_value_snapshots`, `route_pass_*`, `purchases/wallets/currency_ledgers`, `idempotency/audit_logs/rate_limits/device_fingerprints`.
- **RLS:** включён на **всех** таблицах `public` (0005 п.2 — сплошной цикл `enable row level security`, поэтому RLS попал и на `_sunnyside_migrations`). ✅
- **Политики:** 75 штук, **все `SELECT`** для роли `authenticated`. Политик `INSERT/UPDATE/DELETE` — **нет ни одной** → запись для клиента запрещена default-deny. ✅ (см. «Отклонения»).
- **Функции:** 35 в `public`; из них **22 `SECURITY DEFINER`** — RPC-шлюз мутаций и auth-хелперы: `sow, water, harvest, promote_ready, craft_start, craft_collect, sell_to_market, collect_animal_product, feed_animal, coop_contribute, potluck_contribute, event_contribute, help_neighbor, gift_send, prize_pull, streak_check, streak_insure, wallet_get, owns_farm, current_town_id, current_street_id, same_town_player`. ✅ Все SECURITY DEFINER пиннят `search_path`.
- **Инвариант валют (§2.1, K11):** `currency_ledgers` имеет CHECK `currency = ANY('bucks','dimes','tickets','ribbons')` — ровно 4 валюты. ✅
- **Сиды (0007):** `game_configs` = 13 строк, `config_versions` = 1. `route_pass_seasons`/`towns` = 0 (создаются в рантайме — ожидаемо). ✅

### Smoke-тесты (service-ключ `sb_secret_…`, REST `/rest/v1/`)

- `INSERT towns` → 201, дефолты по спеке (`capacity=200, dau_7d=0, status='open'`). ✅
- `INSERT streets` (FK на town) → 201, `capacity=20, street_score=0`. ✅
- Проверка запрета записи клиенту: `INSERT towns` под **publishable**-ключом → `42501 new row violates row-level security policy`. ✅
- Очистка: `DELETE streets` (204), `DELETE towns` (204), повторный SELECT — пусто. **Тестовых данных не осталось.** ✅

## Разбор: publishable-ключ даёт 401 на `/rest/v1/`

**Причина — формат заголовков, а не настройка Data API.** Новый ключ `sb_publishable_…` PostgREST принимает **в заголовке `apikey`**. Симптом 401 воспроизводится, когда ключ шлют **только** как `Authorization: Bearer <publishable>` без `apikey` — тогда шлюз пытается провалидировать его как пользовательский JWT и отклоняет.

Проверено на `GET /rest/v1/towns?select=id&limit=1`:

| Заголовки | Код |
|---|---|
| `apikey: <publishable>` | **200** ✅ |
| `apikey: <publishable>` + `Authorization: Bearer <publishable>` | **200** ✅ |
| только `Authorization: Bearer <publishable>` | **401** ❌ |
| `apikey: <secret>` + `Authorization: Bearer <secret>` | 200 ✅ |

**Фикс (клиент):** всегда слать `apikey: <publishable_key>` (это то, что `supabase-js` делает автоматически при `createClient(url, publishableKey)` — он кладёт ключ и в `apikey`, и в `Authorization`). Никаких изменений настроек проекта (Data API / экспозиция схемы) не требуется — Data API с новым `sb_publishable`-ключом работает штатно.

## Отклонения от файлов миграций

**Правок в `0001…0007` не вносилось — всё применилось как есть.** Смысловых расхождений со спекой нет. Пункты «по форме, не по сути»:

1. **Запрет записи реализован через default-deny, а не через `WITH CHECK (false)`-политики.** Спека (§3.1) формулирует инвариант как «`WITH CHECK`-политика на запись = `false`». Файл `0005_rls.sql` вместо явных false-политик **не создаёт write-политик вовсе** (при включённом RLS это тот же эффект: любая запись клиента отклоняется). Это осознанный дизайн самих файлов (комментарии в 0005 пп. 1–4), а не расхождение с эффектом спеки. Подтверждено smoke-тестом (`42501`).
2. **RLS включён и на `_sunnyside_migrations`** — побочный эффект сплошного цикла `enable RLS` в 0005 п.2. Безвредно: у таблицы нет политик, а Management API / `service_role` / `postgres` обходят RLS, поэтому реестр пишется/читается нормально.

## Замечания Supabase Advisors (security) — все ожидаемы, блокеров нет

- **INFO `rls_enabled_no_policy`** (6 таблиц: `_sunnyside_migrations, audit_logs, device_fingerprints, idempotency, processed_anchors, rate_limits`) — намеренно: служебные таблицы без клиентского SELECT (только `service_role`/SECURITY DEFINER). Соответствует 0005 п.4.
- **WARN `function_search_path_mutable`** — на SECURITY INVOKER-хелперах/триггерах (`set_updated_at, attach_updated_at, ensure_select_policy, game_day, claim_idem, claim_anchor, log_audit, config_doc, inv_add, inv_remove, trg_ledger_apply, ledger_write, rollover_open_week`). Все SECURITY **DEFINER**-функции `search_path` уже пиннят; на этих — опциональное хардненинг-улучшение (можно добить `set search_path = public` в отдельной миграции-хардненинге).
- **WARN `anon/authenticated_security_definer_function_executable`** — RPC-шлюз (`harvest, craft_start, …`) исполним для `anon`/`authenticated`. Это **и есть** заложенная архитектура «одна серверная точка входа». Рекомендация на будущее (не блокер, файлы не трогал): `REVOKE EXECUTE … FROM anon` на мутационных RPC (они всё равно опираются на `auth.uid()` и для анонима выродятся в no-op/ошибку).

## Как воспроизвести верификацию

```sh
TOK=$(security find-generic-password -s "Supabase Sunnyside PAT" -w)
curl -4 -s -X POST \
  https://api.supabase.com/v1/projects/pvautnecztynbnzrrdra/database/query \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  --data '{"query":"select name, applied_at from public._sunnyside_migrations order by name"}'
```
