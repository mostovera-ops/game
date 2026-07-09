# 20 — BACKEND: Архитектура Supabase, схема Postgres, Edge Functions, Realtime, cron, анти-чит

> **Статус:** черновик спеки v0.1 · зависит от `docs/specs/00-canon.md` (канон v1.0), реализует техническую сторону всех системных спек `01`–`16`.
> **Скоуп файла:** серверная архитектура на Supabase (канон D13): **полная схема Postgres** (таблицы, колонки, типы, индексы, FK), **RLS-политики**, **Edge Functions** (контракты запрос/ответ), **Realtime-каналы**, **cron-джобы** (ролловер недели, генерация рынка, агрегация ивента, мерж-проверки), **анти-чит** (серверная валидация таймеров и инвентаря — все мутации только через RPC/Edge, клиент никогда не пишет напрямую), **версионирование конфигов** (`game_config`), **стратегия миграций** файлами в `supabase/migrations/`.
> **Не в скоупе:** игровой баланс чисел (централизуется в `docs/specs/14-economy.md`), клиентский рендер R3F, дизайн UI-экранов (в профильных спеках), выделенный тик-сервер живых кооп-смен (канон D13: только пост-v1.0). Числа-таймеры/лимиты в этом файле — технические гипотезы; игровые значения — из профильных спек.
> **Правило языка (канон §5):** русский текст; нейминги — `English (Русская локализация)` при первом упоминании; в коде/БД — только английский snake_case ключ.

---

## 1. TL;DR

- **Server-authoritative на 100% (канон D13/D14).** Клиент — тонкий рендер поверх серверного состояния. **Ни одной прямой записи из клиента**: все мутации проходят через Postgres RPC (`SECURITY DEFINER`-функции) или Edge Functions. RLS даёт клиенту `SELECT` на своё + публичное, но `INSERT/UPDATE/DELETE` на игровых таблицах — **запрещены политикой** (`USING (false)`).
- **Время — только серверное.** Таймеры грядок, станков, экспедиций, ярмарки хранят абсолютные метки `started_at`/`ready_at` (`timestamptz`), считаются от `now()` Postgres. Оффлайн-устойчивость: игрок закрыл вкладку — таймеры тикают на сервере, урожай «доходит» без него (E-канон, `02-farm.md`).
- **Недельный цикл — единый на город.** Таблица `server_calendars` описывает фазы Пн–Вс (канон §2.3); переходы фаз и три якоря (`coop_deadline` Чт 23:59, `fair_window` Сб 00:00→Вс 12:00, `event_final` Вс 20:00, `rollover` Вс 23:59) двигает **`pg_cron`**. Каждый якорь **идемпотентен** через `processed_anchors(week_index, anchor_code)`.
- **~14 доменов, ~60 таблиц.** Идентичность/соц-граф, ферма (грядки/станки/склад/рецепты), прогрессия (стафф/know-how/постройки/Farm Value), календарь, спрос, кооп/потлак/помощь/town-projects, ярмарка/конкурсы, серверный ивент/Appetite Meter/лиги, коллекции, монетизация (Route Pass/Prize Machine/покупки), удержание (Daily Specials/стрик), инфра (config/леджеры/античит/аудит).
- **Realtime — только read-broadcast.** Клиент подписывается на каналы города/стрита/ивента и получает снапшоты; писать в канал напрямую нельзя — источник событий всегда серверная транзакция (Postgres `REPLICA` → Realtime).
- **Анти-чит — серверная реконструкция.** Любая «награда за действие» пересчитывается сервером от исходного состояния (что реально созрело/скрафтилось/продалось), а не принимается на слово от клиента. Валютные движения — только через `currency_ledgers` (append-only, двойная запись), баланс — материализованная проекция.
- **Конфиг игры версионируется в БД.** `game_configs` (jsonb-документы по неймспейсам) + `config_versions` (снапшоты с `active`-флагом на город/сервер). Смена баланса — новая версия, а не `UPDATE` живых строк. Схема — миграциями в `supabase/migrations/` (timestamp-нейминг, forward-only).

---

## 2. Player Experience (как это ощущается — гарантии бэкенда игроку)

Бэкенд невидим, но игрок постоянно ощущает четыре его обещания — они прямо следуют из пилларсов P2/P3 (канон §1.1):

- **«Сервер не забывает и не обманывает».** Игрок сажает томат на 8 часов, закрывает браузер, возвращается с телефона — грядка созрела ровно вовремя, урожай тот же. Никаких «локальных таймеров, которые сбросились». Метка `ready_at` живёт в Postgres; любой клиент читает одну истину (`02-farm.md`, E-канон устойчивости к оффлайну).
- **«Откатов нет».** Пиллар P3: прогрессия монотонна. Технически это гарантия append-only-леджеров и запрета деструктивных мутаций из клиента — узел know-how нельзя «сжечь», стрик-штампы прошлого нельзя стереть (`13-progression.md`, `16-retention.md`). Даже сбой сети во время крафта не «съедает» ингредиенты: RPC атомарна — либо списала вход и создала job, либо не сделала ничего.
- **«Общий мир честный».** Appetite Meter показывает 68% — это реальная серверная сумма вклада всех, а не оптимистичная догадка клиента. Когда двое жмут «собрать» последнюю точку фуражинга одновременно, атомарная транзакция решает спор мягко: один получил продукт, другой — «только что собрали последнее» (канон F6, `08-mail-foraging.md`). Гонок и дюпов быть не может — арбитр всегда сервер.
- **«Кит не покупает победу».** Технически лиги читают `farm_value` + исторический вклад, а не сумму `◉` (канон G1). Бэкенд физически не даёт монетизации влиять на матчмейкинг: таблицы лиг и таблицы покупок не связаны причинно (`15-monetization.md`).

Для разработчика опыт — «одна истина, один шлюз»: любое игровое действие имеет ровно одну серверную точку входа (RPC или Edge Function), которую можно залогировать, отреплеить и провалидировать. Клиент нельзя «попросить не читерить» — у него просто нет прав на запись.

---

## 3. Механики (архитектура — исчерпывающе)

### 3.1 Принципы и слои

| Слой | Технология | Роль |
|---|---|---|
| Клиент | React + R3F + zustand | Рендер, оптимистичный UI поверх серверных снапшотов, **ноль авторитета**. |
| Auth | Supabase Auth (email + анонимный + OAuth) | `auth.uid()` = владелец записей; JWT в каждом запросе. |
| Data API | PostgREST (авто-REST) | Только `SELECT` для клиента (через RLS); запись — 403 по политике. |
| Мутации (быстрые) | Postgres RPC (`SECURITY DEFINER`) | Атомарные игровые действия: `harvest`, `craft_start`, `sell` — низкая латентность, всё в одной транзакции. |
| Мутации (сложные/внешние) | Edge Functions (Deno) | Логика с внешними эффектами: верификация IAP-квитанций, push, settlement ивента, rollover-оркестрация, batch. |
| Планировщик | `pg_cron` + `pg_net` | Фазовые якоря, тики пассива, агрегация, GC. |
| Realtime | Supabase Realtime (Postgres CDC + broadcast) | Read-only рассылка снапшотов подписчикам каналов. |
| Хранилище | Supabase Storage | Скриншоты Photo Mode (`ui_photo_mode`), UGC-декор — с RLS-бакетами. |

**Правило записи (канон-инвариант):** для каждой игровой таблицы RLS `WITH CHECK`-политика на `INSERT/UPDATE/DELETE` = `false` для роли `authenticated`. Запись выполняют только `SECURITY DEFINER` RPC (работают под ролью-владельцем) и Edge Functions (используют `service_role`-ключ, минуя RLS). Так «клиент никогда не пишет напрямую» — это не соглашение, а свойство схемы.

**Расширения Postgres (обязательные):** `pgcrypto` (UUID/хеши), `pg_cron` (планировщик), `pg_net` (HTTP из БД в Edge), `uuid-ossp` (fallback), `pg_stat_statements` (профилирование). Все включаются первой миграцией.

### 3.2 Полная схема Postgres

> Соглашения: PK — `id uuid default gen_random_uuid()` если не указано иное. Все таблицы имеют `created_at timestamptz not null default now()` и (где мутабельны) `updated_at timestamptz` через триггер `set_updated_at()`. FK — `on delete` указан явно. Денежные суммы — `bigint` (в минимальных единицах, без float). Валюты только `bucks|dimes|tickets|ribbons` (канон §2.1).

#### 3.2.1 Домен: Идентичность и социальный граф

**`players` (Игрок)** — 1:1 с `auth.users`.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id` (FK `on delete cascade`) |
| `handle` | `text` unique not null | ник; `citext`-уникальность |
| `town_id` | `uuid` FK→`towns.id` `on delete set null` | текущий город (шард) |
| `street_id` | `uuid` FK→`streets.id` `on delete set null` | текущий стрит |
| `created_week` | `int` not null | `week_index` регистрации (для Grand Opening ×2) |
| `farm_value` | `bigint` not null default 0 | денормализованный агрегат (`mech_farm_value`), пересчёт сервером |
| `farm_level` | `int` not null default 1 | 1–60 (`13-progression.md`) |
| `xp` | `bigint` not null default 0 | накопленный опыт |
| `locale` | `text` not null default `'ru'` | язык UI |
| `tz_offset_min` | `int` default 0 | для тихих часов пушей (`16-retention.md`) |
| `last_seen_at` | `timestamptz` | обновляется хартбитом |
| `vacation_until` | `timestamptz` | `mech_gone_fishin` активен если > now() |
| `status` | `text` not null default `'active'` | `active\|vacation\|merging\|banned` |

Индексы: `(town_id)`, `(street_id)`, `(town_id, last_seen_at)` (DAU), `(farm_value)`.

**`farms` (Ферма)** — 1:1 с `players` (вынесена из `players` ради partition-миграции при переезде, `12-migration.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` unique | |
| `town_id` | `uuid` FK→`towns.id` | дублирует для партиционирования по городу |
| `layout` | `jsonb` not null default `'{}'` | сетка A-слотов (D2 канон): позиции построек/грядок |
| `grand_opening_until` | `timestamptz` | буст ×2 (`mech_grand_opening`) |
| `config_version_id` | `uuid` FK→`config_versions.id` | версия баланса, под которой играет ферма |

Индекс: `(town_id)`, `(player_id)`.

**`towns` (Город)** — 100–200 игроков (канон §2.4).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `region_tag` | `text` | язык/регион (гипотеза — см. Открытые вопросы, `12-migration.md` O2) |
| `capacity` | `int` not null default 200 | верхняя граница |
| `dau_7d` | `int` default 0 | скользящее среднее активных (для merge-порога) |
| `current_week_index` | `int` not null | сквозной счётчик недель сервера |
| `active_config_version_id` | `uuid` FK→`config_versions.id` | активный баланс города |
| `status` | `text` default `'open'` | `open\|full\|merging\|archived` |

**`streets` (Стрит)** — 10–20 ферм (канон §2.4).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `name_key` | `text` not null | ключ из пула (канон §3.3), напр. `'maple_street'` |
| `capacity` | `int` not null default 20 | |
| `founder_id` | `uuid` FK→`players.id` | |
| `street_score` | `bigint` default 0 | агрегат вклада стрита (ивент/потлак) |

Индекс: `(town_id)`.

**`street_members` (членство)** — M:N игрок↔стрит с ролью.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `street_id` | `uuid` FK→`streets.id` `on delete cascade` | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `role` | `text` default `'member'` | `founder\|officer\|member` |
| `joined_at` | `timestamptz` default now() | |

Unique: `(player_id)` — игрок в одном стрите одновременно. Индекс: `(street_id)`.

#### 3.2.2 Домен: Ферма (производство)

**`plots` (Грядка, `Plot`)** — грядки поля (`02-farm.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `farm_id` | `uuid` FK→`farms.id` `on delete cascade` | |
| `slot_index` | `int` not null | позиция в сетке |
| `crop_key` | `text` | ключ культуры (`05-ingredients.md`); null = пусто |
| `planted_at` | `timestamptz` | серверная метка посева |
| `ready_at` | `timestamptz` | `planted_at + grow_time × modifiers` |
| `quality` | `smallint` | 1–5, вычисляется при `harvest` |
| `state` | `text` default `'empty'` | `empty\|growing\|ready\|withered_none` (увядания нет — E3) |
| `watered_until` | `timestamptz` | авто-полив Hank (`staff_hank`) |

Unique: `(farm_id, slot_index)`. Индекс: `(farm_id, state)`, `(ready_at)` (для «что созрело»).

**`buildings` (Постройка, `Building`)** — `bld_*` (канон §3.8).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `farm_id` | `uuid` FK→`farms.id` `on delete cascade` | |
| `building_key` | `text` not null | `bld_house\|bld_barn\|…` |
| `level` | `int` not null default 1 | 1–10 (`13-progression.md`); House гейтит остальные |
| `upgrade_ready_at` | `timestamptz` | если апгрейд в процессе (Vernon `staff_vernon` ускоряет) |

Unique: `(farm_id, building_key)`.

**`machines` (Станок, `Machine`)** — станки кухни/двора (`04-machines.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `farm_id` | `uuid` FK→`farms.id` `on delete cascade` | |
| `machine_key` | `text` not null | тип станка |
| `slots` | `int` not null default 1 | параллельные партии |
| `level` | `int` default 1 | |

**`machine_jobs` (Партия крафта)** — активные/готовые задания.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `machine_id` | `uuid` FK→`machines.id` `on delete cascade` | |
| `farm_id` | `uuid` FK→`farms.id` | дублирует для быстрых выборок |
| `recipe_key` | `text` not null | рецепт (`04`/`05`) |
| `batch_size` | `int` not null default 1 | Marty `staff_marty` +1 |
| `started_at` | `timestamptz` not null | |
| `ready_at` | `timestamptz` not null | с учётом Bruno `staff_bruno` −10% |
| `collected` | `bool` default false | забрано ли |
| `input_snapshot` | `jsonb` | что списано (для аудита/античита) |

Индекс: `(farm_id, collected)`, `(ready_at)`, `(machine_id)`.

**`inventory` (Склад)** — стакаемые предметы (ингредиенты, блюда, семена, расходники).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `farm_id` | `uuid` FK→`farms.id` `on delete cascade` | |
| `item_key` | `text` not null | универсальный ключ предмета |
| `item_class` | `text` not null | `crop\|dish\|seed\|consumable\|decor\|token` |
| `qty` | `int` not null default 0 check (qty ≥ 0) | |
| `quality` | `smallint` | для блюд/культур (стек на (key,quality)) |
| `expires_at` | `timestamptz` | для скоропорта (лимит Icehouse) |

Unique: `(farm_id, item_key, quality)`. Индекс: `(farm_id, item_class)`. Лимиты хранения (Silo/Icehouse) валидируются в RPC, не колонкой.

**`recipes` (Рецепт, `Recipe Card`)** — справочник + разблокировка на игрока.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `recipe_key` | `text` not null | |
| `source` | `text` | `base\|state\|secret\|narrative` (D8 канон) |
| `unlocked_at` | `timestamptz` default now() | |

Unique: `(player_id, recipe_key)`. Справочник самих рецептов (вход/выход/время) — в `game_configs`, не в реляционной таблице.

**`recipes_mastery` (Мастерство ★, `mech_mastery`)** — гринд рецепта (`04-machines.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `recipe_key` | `text` not null | |
| `stars` | `smallint` not null default 0 check (stars between 0 and 5) | |
| `progress` | `int` not null default 0 | приготовлений до следующей ★ |
| `updated_at` | `timestamptz` | |

Unique: `(player_id, recipe_key)`. Инкремент — только в RPC `craft_collect`.

#### 3.2.3 Домен: Прогрессия

**`staff_roster` (Стафф)** — 12 архетипов `staff_*` (канон §3.2).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `staff_key` | `text` not null | `staff_bruno\|…` |
| `level` | `int` not null default 1 | апгрейд жетонами |
| `hired_at` | `timestamptz` default now() | |

Unique: `(player_id, staff_key)`.

**`staff_assignments` (Назначение на пост)** — пост `Kitchen\|Field\|Counter\|Yard`.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `staff_key` | `text` not null | |
| `post` | `text` not null | `kitchen\|field\|counter\|yard` |
| `assigned_at` | `timestamptz` default now() | |

Unique: `(player_id, post)` — один стафф на пост. Индекс: `(player_id)`.

**`know_how_nodes` (Узел ноу-хау)** — 4 ветки × 15 узлов (канон §3.9, `13`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `branch` | `text` not null | `kh_agronomy\|kh_cookery\|kh_commerce\|kh_civics` |
| `node_key` | `text` not null | |
| `state` | `text` default `'researching'` | `researching\|done` |
| `research_ready_at` | `timestamptz` | таймер узла |

Unique: `(player_id, node_key)`. Отдельная колонка на игроке `know_how_points bigint` — держим в `players` расширением (см. Открытые вопросы: денормализация валюты KHP).

**`staff_tokens`/`kh_points`** — как валюты живут в `currency_ledgers` неймспейсом (см. 3.2.11), баланс — вью.

**`expeditions` (Экспедиция)** — грузовик в штаты (`07-expeditions.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `farm_id` | `uuid` FK→`farms.id` `on delete cascade` | |
| `state_key` | `text` not null | `st_illinois\|…` (канон §3.4) |
| `route_slot` | `int` | Buck `staff_buck` +1 слот |
| `departed_at` | `timestamptz` not null | |
| `return_at` | `timestamptz` not null | Gus `staff_gus` −15% |
| `payload` | `jsonb` | что привезёт (детерминировано на departure) |
| `collected` | `bool` default false | |

Индекс: `(farm_id, collected)`, `(return_at)`.

#### 3.2.4 Домен: Календарь сервера

**`server_calendars` (Серверный календарь, `server_calendar`)** — одна строка на (город, неделя) (`01-core-loop.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | сквозной |
| `week_start` | `timestamptz` not null | Пн 00:00 UTC |
| `phase` | `text` not null | `mon_plan\|tue_produce\|…\|sun_event` |
| `coop_deadline` | `timestamptz` not null | Чт 23:59 UTC |
| `fair_open` | `timestamptz` not null | Сб 00:00 UTC |
| `fair_close` | `timestamptz` not null | Вс 12:00 UTC |
| `event_final` | `timestamptz` not null | Вс 20:00 UTC |
| `rollover_at` | `timestamptz` not null | Вс 23:59 UTC |
| `season_id` | `uuid` FK→`route_pass_seasons.id` | текущий сезон (8–10 нед) |

Unique: `(town_id, week_index)`. Индекс: `(town_id, week_start)`.

**`processed_anchors` (Обработанные якоря)** — идемпотентность cron (`01-core-loop.md` §4.5).

| Колонка | Тип | Заметки |
|---|---|---|
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | |
| `anchor_code` | `text` not null | `A0\|coop_deadline\|fair_open\|fair_close\|event_final\|rollover` |
| `processed_at` | `timestamptz` default now() | |

PK составной: `(town_id, week_index, anchor_code)` — второй запуск джоба = конфликт = no-op.

#### 3.2.5 Домен: Спрос (Demand Board)

**`market_weeks` (Недельный рынок, `ui_demand_board`)** — спрос на неделю (`01`, Demand Board спека).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | |
| `demand` | `jsonb` not null | `{category: multiplier}`, ±15–30% (канон §2.3) |
| `theme_key` | `text` | тема конкурса недели (напр. `cherry_week`) |
| `generated_at` | `timestamptz` default now() | джобом Пн 00:00 |

Unique: `(town_id, week_index)`. Спрос генерируется детерминированно от seed = `hash(town_id, week_index, config_version)` для воспроизводимости и античита.

#### 3.2.6 Домен: Кооп, помощь, town-projects

**`orders` (Кооп-заказ, `ui_coop_orders`)** — 5–15 участников, дедлайн Чт (`11-town.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | |
| `title_key` | `text` | нарративный шаблон («catering_wedding») |
| `requirements` | `jsonb` not null | `[{item_key, qty}]` — микс категорий |
| `progress` | `jsonb` not null default `'{}'` | текущее заполнение (кэш) |
| `deadline` | `timestamptz` not null | = `coop_deadline` |
| `state` | `text` default `'open'` | `open\|fulfilled\|expired` |
| `reward` | `jsonb` | награда всем участникам |

Индекс: `(town_id, week_index, state)`.

**`order_contributions` (Вклад в заказ)**: `id uuid` PK · `order_id uuid` FK→orders `cascade` · `player_id uuid` FK→players · `item_key text` · `qty int` · `contributed_at timestamptz`. Индексы `(order_id)`, `(player_id)`.

**`potlucks` (Стол стрита, `ui_potluck`)** — общий стол → бафф субботы (`mech_potluck`): `id uuid` PK · `street_id uuid` FK→streets `cascade` · `week_index int` · `total_score bigint` (сумма вкладов) · `buff jsonb` (итоговый бафф стриту). Unique `(street_id, week_index)`. Вклады — `potluck_contributions(potluck_id, player_id, item_key, qty, score)`.

**`help_actions` (Помощь соседу)** — лог помощи с лимитами (`11-town.md` §4.1): `id uuid` PK · `actor_id uuid` FK→players `cascade` (кто помог) · `target_id uuid` FK→players (кому) · `action_type text` (`water\|feed\|restock\|cheer`) · `game_day date` (игровой день UTC для дневных кэпов). Индексы `(actor_id, game_day)`, `(target_id, game_day)`. Кэп ≤3 одному/день — counting-запросом в RPC.

**`gifts` (Подарки)** — с NP-кэпами: `id uuid` PK · `from_id uuid` FK→players · `to_id uuid` FK→players · `item_key text` · `qty int` · `game_day date` (дневной лимит) · `claimed bool` default false.

**`mentorships` (Менторство)** — ≤2 менти (`11-town.md` §3.6): `id uuid` PK · `mentor_id uuid` FK→players · `mentee_id uuid` FK→players **unique** (1 ментор на менти) · `state text` (`active\|graduated`) · `started_week int`. Лимит активных ≤2 у ментора — enforced counting-запросом в RPC + `assert` в тесте миграции.

**`town_projects` (Городской проект, `tp_*`)** — 6 построек (канон §3.7).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `project_key` | `text` not null | `tp_drive_in\|…` |
| `tier` | `int` default 0 | этап постройки |
| `progress` | `bigint` default 0 | накопленный вклад |
| `state` | `text` default `'building'` | `building\|complete` |
| `buff_active` | `jsonb` | постоянный бафф города |

Unique: `(town_id, project_key)`. Вклады — `town_project_contributions(project_id, player_id, currency, amount, week_index)` — для расчёта тикет-компенсации при переезде (D12 канон: «ничего не сгорает»).

**`chat_messages` (Чат)** — каналы стрита/города: `id bigint` PK identity (ordered) · `channel text` (`street:{id}\|town:{id}`) · `author_id uuid` FK→players · `body text` (≤500 симв) · `sticker_key text` · `created_at timestamptz`. Индекс `(channel, created_at desc)`. TTL-GC: сообщения >30 дней (гипотеза) чистит cron.

**`farm_visits` (Визиты)** — снапшот-визиты на чужую ферму, read-only (`11-town.md`): `id uuid` PK · `visitor_id uuid` FK→players · `host_id uuid` FK→players · `visited_at timestamptz`.

#### 3.2.7 Домен: Ярмарка

**`fair_stalls` (Прилавок ярмарки, `ui_fair_stall`)** — окно 36 ч (`09-fair.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `town_id` | `uuid` FK→`towns.id` | |
| `week_index` | `int` not null | |
| `display_slots` | `int` not null default 6 check (display_slots between 6 and 12) | апгрейд палатки |
| `opened_at` | `timestamptz` | момент «Открыть прилавок» |
| `stall_level` | `int` default 1 | `L_stall` 1.00–1.20 |

Unique: `(player_id, week_index)`. Индекс: `(town_id, week_index)`.

**`fair_lots` (Лот прилавка, `Lot`)** — {тип блюда, кол-во, цена} в слоте.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `stall_id` | `uuid` FK→`fair_stalls.id` `on delete cascade` | |
| `slot_index` | `int` not null | 0..display_slots-1 |
| `item_key` | `text` not null | блюдо |
| `quality` | `smallint` | |
| `qty_listed` | `int` not null | выставлено |
| `qty_sold` | `int` not null default 0 | продано (тик пассива) |
| `price` | `bigint` not null | ±% от референса |

Unique: `(stall_id, slot_index)`. Индекс: `(stall_id)`.

**`fair_sales` (Продажи, тик)** — журнал пассивных продаж (для лога/античита/FP).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `bigint` PK identity | |
| `lot_id` | `uuid` FK→`fair_lots.id` `on delete cascade` | |
| `player_id` | `uuid` FK→`players.id` | |
| `qty` | `int` | продано за тик |
| `revenue` | `bigint` | выручка |
| `fp` | `bigint` | Fill Points, идут в ивент |
| `tick_at` | `timestamptz` default now() | |

Индекс: `(player_id, tick_at)`.

**`contests` (Конкурс, `ct_*`)** — 3 конкурса (канон §3.6).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | |
| `contest_key` | `text` not null | `ct_pie_week\|ct_giant_veg\|ct_best_window` |
| `entry_open` | `timestamptz` | Пн 00:00 |
| `entry_close` | `timestamptz` | Пт 23:59 |
| `announce_at` | `timestamptz` | оглашение |
| `state` | `text` default `'entry'` | `entry\|voting\|judged` |

Unique: `(town_id, week_index, contest_key)`.

**`contest_entries` (Заявка)** — 1 на игрока на конкурс.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `contest_id` | `uuid` FK→`contests.id` `on delete cascade` | |
| `player_id` | `uuid` FK→`players.id` | |
| `payload` | `jsonb` | {item_key, quality, mastery, metric} |
| `npc_score` | `numeric` | заполняет судья-джоб |
| `vote_count` | `int` default 0 | денорм |
| `final_score` | `numeric` | `W_npc×NPC + W_vote×VoteShare` |
| `rank` | `int` | по дивизиону |

Unique: `(contest_id, player_id)`.

**`contest_votes` (Голос)** — голос = 1 балл: `id uuid` PK · `contest_id uuid` FK→contests `cascade` · `voter_id uuid` FK→players · `entry_id uuid` FK→contest_entries. **Unique `(contest_id, voter_id)`** — один голос на конкурс от игрока (античит накрутки).

#### 3.2.8 Домен: Серверный ивент

**`event_weeks` (Недельный ивент, `sun_event`)** — Appetite Meter (`10-server-event.md`).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `town_id` | `uuid` FK→`towns.id` `on delete cascade` | |
| `week_index` | `int` not null | |
| `theme_key` | `text` not null | `ev_glutton\|ev_big_festival\|…` (канон §3.5) |
| `meter_fp` | `bigint` not null default 0 | суммарный Fill Points |
| `goal_100` | `bigint` not null | цель 100% (масштаб под 40–60 DAU) |
| `phase_state` | `jsonb` | капризы Гримсби / категории фестиваля |
| `settled` | `bool` default false | финал проведён |

Unique: `(town_id, week_index)`. Инкремент `meter_fp` — атомарно в RPC/Edge (`event_contribute`), проверка пересечения вех — в той же транзакции.

**`event_contributions` (Вклад в котёл, `cauldron`)**.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `bigint` PK identity | |
| `event_week_id` | `uuid` FK→`event_weeks.id` `on delete cascade` | |
| `player_id` | `uuid` FK→`players.id` | |
| `channel` | `text` | `passive_sell\|contrib_donate` |
| `fp` | `bigint` | вклад в FP |
| `category` | `text` | для фаз/фестиваля |
| `at` | `timestamptz` default now() | |

Индекс: `(event_week_id, player_id)`, `(player_id, at)`.

**`event_milestones_claimed` (Вехи выданы)** — идемпотентность наград вех: `event_week_id uuid` FK→event_weeks `cascade` · `milestone_key text` (`ms_25\|ms_50\|ms_75\|ms_100\|ms_125\|ms_150`) · `player_id uuid` FK→players · `reward_key text`. **PK `(event_week_id, milestone_key, player_id)`** — веха выдаётся каждому активному один раз (канон EV8).

**`personal_contributions` (Личный FP)** — для сундуков и лиг: `id uuid` PK · `event_week_id uuid` FK→event_weeks `cascade` · `player_id uuid` FK→players · `personal_fp bigint` (сумма `FP_dish` за уикенд) · `chests_claimed jsonb` (какие пороги открыты). Unique `(event_week_id, player_id)`.

**`event_leagues` (Лига, `event_league`)** — брекет по историческому FP за сезон: `id uuid` PK · `player_id uuid` FK→players `cascade` · `season_id uuid` FK→route_pass_seasons · `league_score bigint` (накопленный `personal_fp` за сезон) · `division text` (`sprout\|…`). Unique `(player_id, season_id)`. На стыке сезонов переносится 25% (soft reset) — джобом сезона.

**`versus_matches` (Versus, `ev_state_fair_showdown`)** — город vs город: `id uuid` PK · `week_index int` · `town_a uuid` / `town_b uuid` FK→towns · `score_a bigint` / `score_b bigint` · `outcome text` (`a\|b\|tie\|pending`).

#### 3.2.9 Домен: Коллекции и престиж

**`collections` (Коллекция, `Collection is Identity`)** — прогресс наборов (P4 канон): `id uuid` PK · `player_id uuid` FK→players `cascade` · `collection_key text` (`toy_highway_dinos\|cos_googie\|region_south\|…`) · `items jsonb` (`{item_key: owned_bool/count}`) · `completed_at timestamptz` (полный сет → бафф). Unique `(player_id, collection_key)`.

**`toys` (Игрушки, `ui_toy_shelf`)** — Prize Machine дропы (5 серий, канон §3.10): `id uuid` PK · `player_id uuid` FK→players `cascade` · `toy_key text` · `series_key text` (`toy_cosmos_57\|…`) · `rarity text` (`common\|rare\|chase`) · `count int` (дубли → скрап). Unique `(player_id, toy_key)`.

**`ribbons_wall` (Стена лент, `ui_ribbon_wall`)** — Blue Ribbon за конкурсы (prestige `🎀`): `id uuid` PK · `player_id uuid` FK→players `cascade` · `contest_key text` · `week_index int` · `ribbon_type text` (`blue\|…`) · `awarded_at timestamptz`.

**`postcards` (Открытки, `ui_postcards`, `mech_greetings_postcard`)** — 1 за штат/ивент: `id uuid` PK · `player_id uuid` FK→players `cascade` · `postcard_key text` (штат/ивент) · `region text` (для сет-баффа региона). Unique `(player_id, postcard_key)`.

**`farm_value_snapshots` (Снапшоты Farm Value)** — история для лиг/статуса: `id bigint` PK identity · `player_id uuid` FK→players `cascade` · `farm_value bigint` · `week_index int` · `breakdown jsonb` (вклад 4 осей + коллекций). Индекс `(player_id, week_index)`.

#### 3.2.10 Домен: Монетизация

**`route_pass_seasons` (Сезон Route Pass)** — 8–10 недель (`15-monetization.md`): `id uuid` PK · `season_index int` unique · `theme_key text` · `start_week int` · `end_week int`.

**`route_pass_progress` (Прогресс паса, `ui_route_pass`)**.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `season_id` | `uuid` FK→`route_pass_seasons.id` | |
| `miles` | `bigint` default 0 | накопленные Miles |
| `level` | `int` default 0 | 0–50 |
| `premium` | `bool` default false | куплен ли платный трек (`◉`/реал) |
| `claimed_levels` | `jsonb` default `'[]'` | какие награды забраны |

Unique: `(player_id, season_id)`. Начисление Miles — RPC/джобом; премиум-анлок — только через `purchases` (верифицированную).

**`prize_series_pity` (Pity серии, `ui_prize_machine`)** — открытый счётчик (канон G2).

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `series_key` | `text` not null | |
| `pulls_since_rare` | `int` default 0 | гарантия Rare каждые 10 |
| `pulls_since_chase` | `int` default 0 | гарантия Chase на 40 |

Unique: `(player_id, series_key)`. Pity per-series, не переносится (§3.3.3).

**`prize_pulls` (Круты Prize Machine)** — журнал (аудит/античит pity): `id bigint` PK identity · `player_id uuid` FK→players `cascade` · `series_key text` · `result_toy_key text` · `rarity text` · `cost_dimes int` (0 для дневного фри-пулла) · `was_pity bool` · `at timestamptz`.

**`regulars_club` (Клуб завсегдатаев, `ui_regulars_club`)** — уровень от активности, НЕ от спенда: `player_id uuid` PK FK→players `cascade` · `club_points bigint` (от стриков/активности) · `tier int` (Old-Timer и т.д.).

**`boosters_daily` (Дневные бусты)** — кэпы бустеров (канон гардрейл): `id uuid` PK · `player_id uuid` FK→players `cascade` · `booster_key text` (`fertilizer\|…`) · `game_day date` · `used int` (против дневного кэпа). Unique `(player_id, booster_key, game_day)`.

**`purchases` (Покупки)** — единственный источник `◉` за реал; верифицированные IAP.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `sku` | `text` not null | пакет Dimes / бандл |
| `provider` | `text` | `stripe\|apple\|google\|paddle` |
| `provider_txn_id` | `text` unique not null | дедуп квитанции |
| `dimes_granted` | `bigint` | |
| `amount_cents` | `bigint` | реал-сумма |
| `currency_iso` | `text` | `USD\|…` |
| `state` | `text` default `'pending'` | `pending\|verified\|granted\|refunded` |
| `verified_at` | `timestamptz` | |

Unique: `(provider, provider_txn_id)` — жёсткий дедуп (античит дюпа покупок). Начисление `◉` — только после `verified`, одной транзакцией в `currency_ledgers`.

#### 3.2.11 Домен: Инфраструктура, валюты, античит, аудит

**`currency_ledgers` (Валютный леджер)** — append-only, единственный путь движения валют.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `bigint` PK identity | |
| `player_id` | `uuid` FK→`players.id` `on delete cascade` | |
| `currency` | `text` not null | `bucks\|dimes\|tickets\|ribbons\|scrap\|kh_points\|staff_tokens\|miles` |
| `delta` | `bigint` not null | +/− |
| `reason` | `text` not null | `harvest_sell\|craft\|fair_sale\|event_reward\|purchase\|route_reward\|…` |
| `ref_type` | `text` | таблица-источник |
| `ref_id` | `uuid`/`text` | id источника |
| `idempotency_key` | `text` | для наград: `(player,week,reward_key)` |
| `balance_after` | `bigint` | снапшот баланса валюты после (для быстрого чтения) |
| `at` | `timestamptz` default now() | |

Индексы: `(player_id, currency, at)`, unique `(idempotency_key)` where not null. Баланс кошелька — вью `wallet_balances` = last `balance_after` per (player, currency); либо материализованная таблица `wallets(player_id, currency, balance)` обновляемая триггером на леджер. **Ни одна RPC не меняет баланс мимо леджера** — это ядро античита экономики.

> Примечание: `scrap` (`⚙`), `kh_points`, `staff_tokens`, `miles` — технические под-валюты (не каноничные §2.1). Помечены `(нейминг-кандидат, требует канона)` — см. Открытые вопросы.

**`game_configs` (Конфиг игры)** — версионируемые балансные документы.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `namespace` | `text` not null | `crops\|recipes\|prices\|timers\|demand\|event\|route_pass\|prize_machine\|drops\|staff` |
| `version_id` | `uuid` FK→`config_versions.id` | |
| `doc` | `jsonb` not null | сам конфиг (цены, таймеры, кривые) |

Unique: `(namespace, version_id)`. Клиенту доступен `SELECT` активной версии (read-only); игровые RPC читают конфиг по `config_version_id` фермы/города.

**`config_versions` (Версия конфига)**.

| Колонка | Тип | Заметки |
|---|---|---|
| `id` | `uuid` PK | |
| `label` | `text` | напр. `1.4.0-balance` |
| `state` | `text` default `'draft'` | `draft\|active\|retired` |
| `activated_at` | `timestamptz` | |
| `notes` | `text` | changelog |

Активация — Edge Function `config-activate` (ставит `active` версии, обновляет `towns.active_config_version_id`). Живущие фермы могут донашивать старую версию до ролловера (стабильность недели), новые — сразу на новой.

**`device_fingerprints` (Отпечатки устройств)** — смурф-детект (`11-town.md`): `id uuid` PK · `player_id uuid` FK→players `cascade` · `fingerprint_hash text` (хеш device/IP-сигнала, privacy: только хеш) · `first_seen timestamptz`. Индекс `(fingerprint_hash)`. Матчмейкинг ментора/помощи исключает аккаунты с общим отпечатком.

**`audit_logs` (Аудит мутаций)** — журнал критичных серверных действий: `id bigint` PK identity · `actor_id uuid` (игрок или `system`) · `action text` (имя RPC/Edge) · `payload_hash text` · `result text` (`ok\|rejected\|error`) · `reject_reason text` · `at timestamptz`. Индексы `(actor_id, at)`, `(action, at)`. Пишется в каждой RPC/Edge (особенно на `rejected` — античит-телеметрия).

**`rate_limits` (Лимиты запросов)** — троттлинг мутаций: `player_id uuid` · `bucket text` (`harvest\|craft\|help\|chat\|pull`) · `window_start timestamptz` · `count int`. PK `(player_id, bucket, window_start)`.

### 3.3 RLS-политики (Row Level Security)

RLS включён (`ENABLE ROW LEVEL SECURITY`) на **всех** таблицах. Общий паттерн по группам:

| Группа таблиц | SELECT (роль `authenticated`) | INSERT/UPDATE/DELETE |
|---|---|---|
| Приватные игрока (`inventory`, `plots`, `machine_jobs`, `recipes*`, `staff_*`, `know_how_nodes`, `route_pass_progress`, `prize_*`, `boosters_daily`, `regulars_club`, `farm_value_snapshots`) | `player_id = auth.uid()` (или через `farm→player`) | **`false`** — только RPC/Edge |
| Публичные-в-городе (`towns`, `streets`, `street_members`, `server_calendars`, `market_weeks`, `town_projects`, `contests`, `event_weeks`, `versus_matches`) | `town_id in (select town_id from players where id=auth.uid())` | **`false`** |
| Соседские (read) (`farms.layout` соседа, `farm_visits`, `ribbons_wall`, `toys`, `collections` — витринные) | членство в том же городе/стрите | **`false`** |
| Кооп/вклад (`orders`, `order_contributions`, `potlucks`, `event_contributions`, `contest_entries`, `contest_votes`) | город/стрит игрока | **`false`** (вклад — через RPC) |
| Чат (`chat_messages`) | `channel` игрока (стрит/город) | INSERT — через RPC `chat_post` (модерация/рейт-лимит); прямой INSERT `false` |
| Валюты/покупки (`currency_ledgers`, `purchases`, `wallets`) | `player_id = auth.uid()` (только чтение своего) | **`false`** — движение только Edge/RPC |
| Инфра (`game_configs` активные, `config_versions` active) | активная версия — read всем | **`false`** |
| Служебные (`audit_logs`, `device_fingerprints`, `rate_limits`, `processed_anchors`, `idempotency`) | **`false`** (даже SELECT) | **`false`** — только `service_role` |

Ключевой инвариант: **нет ни одной `WITH CHECK (true)` политики записи для `authenticated`**. `SECURITY DEFINER` RPC выполняются под ролью-владельцем функции (обходят RLS осознанно и валидируют сами); Edge Functions ходят под `service_role`.

### 3.4 Edge Functions (контракты запрос/ответ)

Быстрые атомарные действия — **Postgres RPC** (ниже, §3.4.1). Функции с внешними эффектами/оркестрацией — **Edge (Deno)** (§3.4.2). Все возвращают `{ ok: bool, data?, error?: {code, message} }`. Все идемпотентны там, где выдают награды.

#### 3.4.1 RPC (Postgres, `SECURITY DEFINER`) — «горячий путь»

| RPC | Вход | Выход | Валидация (античит) |
|---|---|---|---|
| `harvest(plot_ids uuid[])` | список грядок | `{items:[{key,qty,quality}]}` | для каждой: `state='ready' AND now()≥ready_at AND farm∈auth.uid()`; иначе строка пропущена, не ошибка |
| `sow(slot int, seed_key text)` | грядка+семя | `{plot}` | семя есть на складе; слот пуст; списывает семя, ставит `planted_at=now()`, `ready_at` из конфига×модификаторы |
| `water(plot_ids uuid[])` | грядки | `{watered:int}` | владелец/сосед (help-кэп); ставит `watered_until` |
| `craft_start(machine_id, recipe_key, batch int)` | станок+рецепт | `{job}` | рецепт разблокирован; вход есть на складе; слот свободен; **списывает вход атомарно**, ставит `ready_at` c учётом стаффа/know-how |
| `craft_collect(job_ids uuid[])` | задания | `{items, mastery_delta}` | `now()≥ready_at AND NOT collected`; инкремент `recipes_mastery`; кладёт выход на склад (проверка лимита) |
| `sell_to_market(item_key, qty)` | продажа NPC-рынку | `{revenue}` | qty≤склад; цена из `market_weeks.demand`×конфиг; движение `bucks` через леджер |
| `fair_list(stall, lots jsonb)` | выкладка лотов | `{stall}` | окно ярмарки открыто; qty≤склад; цена в допустимом ±% коридоре; резервирует сток |
| `fair_open(stall_id)` | открыть прилавок | `{opened_at}` | ставит `opened_at=now()` (старт пассива) |
| `contest_enter(contest_key, payload)` | заявка | `{entry}` | `now()∈[entry_open,entry_close]`; 1 заявка/игрок; предмет есть |
| `contest_vote(contest_id, entry_id)` | голос | `{ok}` | 1 голос/конкурс/игрок; не за себя (гипотеза) |
| `coop_contribute(order_id, item_key, qty)` | вклад в заказ | `{progress}` | `now()<deadline`; qty≤склад; списывает, инкрементит `progress` атомарно |
| `potluck_contribute(week, item_key, qty)` | вклад в потлак | `{total_score}` | стрит игрока; списывает сток |
| `event_contribute(item_key, qty, channel)` | донат/пассив в котёл | `{meter_pct, personal_fp, milestones_hit[]}` | окно ивента; конвертит в FP по конфигу; **атомарно инкрементит `meter_fp` и ловит пересечение вех** (канон EV8) |
| `help_neighbor(target_id, action_type)` | помощь | `{ok}` | лимит ≤3/target/day и дневной кэп actor; не самому себе; не смурф |
| `gift_send(to_id, item_key, qty)` | подарок | `{ok}` | NP-кэп; ≤3 одному/день; списывает сток |
| `research_start(node_key)` | старт узла know-how | `{node}` | предки изучены; хватает `kh_points`; ≤1 активный слот (2-й за `dimes`) |
| `staff_assign(staff_key, post)` | назначить пост | `{assignment}` | стафф нанят; пост валиден; заменяет прежнего |
| `staff_upgrade(staff_key)` | апгрейд жетонами | `{level}` | хватает `staff_tokens` |
| `building_upgrade(building_key)` | апгрейд постройки | `{upgrade_ready_at}` | House-гейт; хватает `bucks`; ставит таймер |
| `expedition_start(state_key, route_slot)` | старт экспедиции | `{expedition}` | штат открыт; слот свободен; payload детерминирован seed'ом |
| `expedition_collect(exp_ids)` | забрать груз | `{items}` | `now()≥return_at AND NOT collected` |
| `prize_pull(series_key, count int)` | круты Prize Machine | `{results[], pity_after}` | списывает `dimes` (или дневной фри); **pity считается сервером** от `prize_series_pity`; результат — серверный RNG с seed |
| `chat_post(channel, body, sticker_key)` | сообщение | `{message}` | членство в канале; рейт-лимит; фильтр |
| `wallet_get()` | баланс | `{balances}` | только свой |
| `streak_check()` | тик стрика | `{streak_days, state}` | считает ≥2/3 Daily Specials за игровой день UTC |

#### 3.4.2 Edge Functions (Deno, внешние эффекты/оркестрация)

| Function | Триггер | Вход | Выход | Суть |
|---|---|---|---|---|
| `iap-verify` | клиент после оплаты | `{provider, receipt, sku}` | `{purchase_id, dimes}` | верифицирует квитанцию у провайдера, дедуп `provider_txn_id`, начисляет `◉` через леджер |
| `event-settle` | cron `event_final` Вс 20:00 | `{town_id, week_index}` | `{settled:true}` | идемпотентный финал: серверные вехи → личные сундуки → StreetScore/вымпелы → лиги/промо → versus → тик Route Pass; ключ `(player,week,reward_key)` |
| `week-rollover` | cron `rollover` Вс 23:59 | `{town_id, week_index}` | `{next_week}` | атомарная смена мира: закрыть неделю (архив, расчёты) → открыть новую (сброс Demand/Specials/слотов); идемпотентно по `processed_anchors` |
| `market-generate` | cron Пн 00:00 | `{town_id, week_index}` | `{demand}` | детерминированная генерация спроса (seed), запись `market_weeks`, `contests`, `coop orders`, тема недели |
| `push-dispatch` | cron/событие | `{player_id, template, vars}` | `{sent}` | пуши через внешний провайдер с тихими часами (`16-retention.md`) и кэпами |
| `fair-tick` | cron каждые 15 мин | `{town_id}` | `{sales:int}` | пассивная симуляция продаж прилавков по `SellRate`, запись `fair_sales`, FP в ивент (`09-fair.md`) |
| `contest-judge` | cron после `entry_close` | `{contest_id}` | `{ranked}` | считает `npc_score`, агрегирует голоса, `final_score`, ранги, выдаёт Blue Ribbon |
| `merge-check` | cron ежедневно | `{}` | `{proposals[]}` | сканирует города ниже DAU-порога, предлагает Town Merge / Street Caravan (`12-migration.md`) |
| `migrate-farm` | голосование/выбор игрока | `{player_id, target_town}` | `{ok}` | атомарный перенос строк фермы между city-партициями; тикет-компенсация town-projects (D12) |
| `config-activate` | админ | `{version_id}` | `{active}` | активирует версию конфига, обновляет города |
| `farm-value-recalc` | после апгрейда/батч | `{player_id}` | `{farm_value}` | пересчёт агрегата 4 осей + коллекций, снапшот |
| `photo-upload` | клиент | `{image}` | `{url}` | приём скриншота Photo Mode в Storage с RLS |

### 3.5 Realtime-каналы (подписки клиента)

Realtime — **только рассылка**; писать в канал клиент не может, источник — серверная транзакция (Postgres CDC/broadcast). Подписки:

| Канал | Что транслирует | Источник | Спека |
|---|---|---|---|
| `town:{town_id}:calendar` | смена фазы, якоря, таймеры недели | `server_calendars` UPDATE | `01-core-loop.md` |
| `town:{town_id}:event` | `meter_pct`, вехи, фазы Гримсби | `event_weeks` UPDATE | `10-server-event.md` |
| `town:{town_id}:foraging` | появление/исчезновение точек фуражинга | пул точек | `08-mail-foraging.md` |
| `town:{town_id}:projects` | прогресс town-projects | `town_projects` | `11-town.md` |
| `town:{town_id}:fair` | лидерборд/лог продаж ярмарки | `fair_sales`/`contests` | `09-fair.md` |
| `town:{town_id}:versus` | versus-скорборд | `versus_matches` | `10-server-event.md` |
| `street:{street_id}:chat` | сообщения стрита | `chat_messages` INSERT | `11-town.md` |
| `town:{town_id}:chat` | городской чат | `chat_messages` | `11-town.md` |
| `street:{street_id}:board` | вклад в потлак/кооп, помощь | agg-таблицы | `11-town.md` |
| `player:{player_id}:inbox` | личные: награды, груз вернулся, урожай, стрик, пуш-зеркало | приватные события | все |

Presence (кто онлайн в городе/стрите) — Realtime Presence, эфемерно, не в БД. Троттлинг broadcast: агрегированные апдейты (напр. `meter_pct`) шлём не чаще 1/сек на канал.

### 3.6 Cron-джобы (`pg_cron` + Edge через `pg_net`)

Все джобы **идемпотентны** (пишут в `processed_anchors`/используют idempotency-ключи) и **догоняющие** (при задержке сверяют `now()` с якорем и доигрывают пропущенное по порядку — канон C1).

| Джоб | Расписание (UTC, гипотеза) | Действие | Идемпотентность |
|---|---|---|---|
| `phase_tick` | `*/5 * * * *` (каждые 5 мин) | сверяет `now()` с окнами, двигает `server_calendars.phase`, шлёт broadcast | по `(week,phase)` |
| `market_generate` | `0 0 * * 1` (Пн 00:00) | Edge `market-generate` на все города | `(town,week,'A0')` |
| `coop_deadline` | `59 23 * * 4` (Чт 23:59) | закрыть кооп-заказы, раздать награды | `(town,week,'coop_deadline')` |
| `fair_open` | `0 0 * * 6` (Сб 00:00) | открыть прилавки/смены | `(town,week,'fair_open')` |
| `fair_tick` | `*/15 * * * *` в окне | Edge `fair-tick` пассив продаж | по `(lot, tick_window)` |
| `contest_judge` | `0 0 * * 6` (после entry_close) | Edge `contest-judge` | `(contest,'judged')` |
| `fair_close` | `0 12 * * 0` (Вс 12:00) | закрыть ярмарку, финализ лотов | `(town,week,'fair_close')` |
| `event_settle` | `0 20 * * 0` (Вс 20:00) | Edge `event-settle` финал ивента | `(town,week,'event_final')` |
| `week_rollover` | `59 23 * * 0` (Вс 23:59) | Edge `week-rollover` | `(town,week,'rollover')` |
| `season_rollover` | на границе сезона | soft-reset лиг (25% перенос), новый Route Pass сезон | `(season,'rolled')` |
| `merge_check` | `0 6 * * *` (ежедневно) | Edge `merge-check` DAU-сканы | `(day,'merge')` |
| `dau_recalc` | `0 1 * * *` | пересчёт `towns.dau_7d`, `last_seen` агрегаты | по дню |
| `chat_gc` | `0 3 * * *` | чистка `chat_messages` >30 дн, `fair_sales`/`audit_logs` >90 дн (гипотеза) | idem |
| `push_daily` | `0 * * * *` (ежечасно) | Edge `push-dispatch` для due-триггеров с тихими часами | по `(player,template,day)` |
| `streak_freeze` | `0 0 * * *` (00:00 игрового дня) | перевести невыполненные стрики в `frozen` (E2) | `(player,day)` |

### 3.7 Анти-чит (серверная валидация)

Модель угроз и защита. Базовый принцип: **клиент присылает намерение, сервер реконструирует результат**.

| Вектор | Защита |
|---|---|
| **Ускорение таймеров** (грядки/станки/экспедиции) | Все таймеры — серверные `ready_at`; действие сбора проверяет `now()≥ready_at`. Клиентское время игнорируется полностью. Нельзя «собрать раньше». |
| **Дюп предметов** | Списание входа и создание выхода — в одной SQL-транзакции RPC. `qty≥0` check-constraint. Нет пути изменить `inventory` мимо RPC (RLS write=false). |
| **Инфляция валют** | Все движения — через `currency_ledgers` (append-only, двойная запись, `balance_after`). Баланс = проекция леджера. Прямой `UPDATE` кошелька невозможен (RLS + триггер-гард). |
| **Накрутка наград ивента/вех** | Idempotency-ключ `(player,week,reward_key)` unique в леджере; `event_milestones_claimed` PK — веха раз на игрока. Повторный settlement — no-op. |
| **Дубль покупок** | `purchases (provider, provider_txn_id)` unique; начисление `◉` только после провайдер-верификации в `iap-verify`. |
| **Подмена pity Prize Machine** | `pulls_since_chase/rare` считает сервер в `prize_series_pity`; RNG-результат генерит сервер (seed), клиент лишь анимирует. Клиент не может «объявить» дроп. |
| **Накрутка голосов конкурса** | `contest_votes (contest_id, voter_id)` unique — 1 голос/игрок. |
| **Фарм помощи/менторства смурфами** | `device_fingerprints`: матч исключает общий отпечаток; дневные кэпы `help_actions`/`gifts`; ментор ≤2 менти. |
| **Спам мутациями** | `rate_limits` bucket-троттлинг на RPC (harvest/craft/pull/chat); превышение → `rejected` + `audit_logs`. |
| **Читерский спрос/дропы** | Спрос и payload экспедиций — детерминированы seed'ом `hash(town,week,config_version)`; клиент не влияет на генерацию. |
| **Продажа несуществующего стока на ярмарке** | `fair_list` резервирует сток из `inventory` (списывает/помечает) в момент выкладки; пассив продаёт только зарезервированное. |
| **Подделка Farm Value для лиг** | `farm_value` пересчитывает только `farm-value-recalc` (Edge/service_role); клиент не пишет. Лиги читают `farm_value`+вклад, не спенд (канон G1). |

Каждый `rejected` пишется в `audit_logs` с `reject_reason` — телеметрия для выявления паттернов абьюза (без банов-автоматом на MVP; ручной ревью).

### 3.8 Версионирование конфигов игры

- **Конфиг — данные в БД, не код.** Все балансные величины (цены тиров, таймеры циклов, кривые XP, ставки продаж, pity-числа, спрос-диапазоны) живут в `game_configs.doc` (jsonb) по неймспейсам, привязанные к `config_versions`.
- **Смена баланса = новая версия**, а не `UPDATE` живых строк. Черновик (`draft`) правится, затем `config-activate` переводит его в `active` и ретаярит прежний. Это даёт откат (переактивировать старую версию) и аудит (`config_versions.notes` = changelog).
- **Стабильность недели.** Ферма привязана к `config_version_id`; активная версия города — `towns.active_config_version_id`. Живущие фермы донашивают версию, под которой начали неделю, до ролловера — чтобы правка баланса в среду не сломала уже запущенные таймеры/цены. Новые фермы и следующая неделя — на новой версии.
- **Клиент читает конфиг** активной версии (`SELECT`, read-only) для отображения цен/таймеров, но **никогда не доверяет ему для расчёта наград** — расчёт всегда серверный по той же версии.
- **Сиды конфига** — часть миграций (seed-миграция `..._seed_config_v1.sql`), чтобы окружения (local/staging/prod) поднимались с идентичным балансом.

### 3.9 Стратегия миграций

- **Файлы в `supabase/migrations/`**, нейминг `<UTC-timestamp>_<slug>.sql` (напр. `20260710120000_init_extensions.sql`) — лексикографический порядок = порядок применения. **Forward-only** (откат — новой миграцией, не reverse), кроме локальной разработки.
- **Порядок первичных миграций:** (1) extensions; (2) домены-таблицы по группам §3.2; (3) индексы/FK; (4) триггеры (`set_updated_at`, гард-триггеры леджера); (5) RPC (`SECURITY DEFINER`) §3.4.1; (6) RLS-политики §3.3; (7) `pg_cron`-джобы §3.6; (8) seed `game_configs` v1.
- **Edge Functions** — в `supabase/functions/<name>/index.ts`, деплой отдельно от SQL-миграций (`supabase functions deploy`), версионируются гитом.
- **CI-гейт:** `supabase db diff` не должен показывать дрейф схемы vs миграции; линт RLS (нет таблицы без политики); тест «клиент не может писать» (integration-тест под `anon`/`authenticated` ключом — все INSERT/UPDATE в игровые таблицы возвращают 403/0 строк).
- **Прод-применение:** `supabase db push` через CI на защищённой ветке; ручной `apply_migration` в MCP — только для staging-экспериментов.

---

## 4. Данные и формулы (таблицы)

### 4.1 Сводка индексов (горячие пути)

| Таблица | Индекс | Запрос |
|---|---|---|
| `plots` | `(farm_id, state)`, `(ready_at)` | «что созрело на ферме», батч-сбор |
| `machine_jobs` | `(farm_id, collected)`, `(ready_at)` | активные партии, «что готово» |
| `inventory` | `(farm_id, item_class)`, unique `(farm_id, item_key, quality)` | склад, стек |
| `server_calendars` | unique `(town_id, week_index)` | текущая фаза города |
| `event_contributions` | `(event_week_id, player_id)`, `(player_id, at)` | личный/общий FP |
| `fair_sales` | `(player_id, tick_at)` | лог продаж, FP-агрегация |
| `currency_ledgers` | `(player_id, currency, at)`, unique `(idempotency_key)` | баланс, дедуп наград |
| `purchases` | unique `(provider, provider_txn_id)` | дедуп IAP |
| `contest_votes` | unique `(contest_id, voter_id)` | 1 голос |
| `help_actions` | `(actor_id, game_day)`, `(target_id, game_day)` | дневные кэпы |
| `players` | `(town_id, last_seen_at)` | DAU города |

### 4.2 Технические лимиты и таймеры (гипотезы)

| Параметр | Значение (гипотеза) | Обоснование |
|---|---|---|
| Realtime broadcast throttle | 1 msg/сек/канал | сглаживание нагрузки |
| `fair-tick` период | 15 мин | компромисс гладкость/стоимость крона (`09-fair.md` OQ) |
| `phase_tick` период | 5 мин | точность фаз без спама |
| RPC rate-limit `harvest` | 60/мин/игрок | норм-геймплей ≪ лимита |
| RPC rate-limit `prize_pull` | 20/мин/игрок | защита от скрипт-круток |
| `chat_post` rate-limit | 10/мин/игрок | антиспам |
| Chat TTL (GC) | 30 дней | объём хранения |
| `fair_sales`/`audit_logs` TTL | 90 дней | аудит-окно |
| Макс. размер `game_configs.doc` | 1 MB/namespace | jsonb-производительность |
| `help_actions` кэп/target | ≤3/день | канон (`11-town.md`) |
| Ментор ≤ менти | 2 | канон (`11-town.md`) |
| Moving Truck кулдаун | 2 недели | `mech_moving_truck` (канон §3.13) |
| League soft-reset перенос | 25% | `10-server-event.md` §8 |

### 4.3 Ключевые идемпотентность-ключи

| Действие | Ключ | Таблица-гард |
|---|---|---|
| Награда вехи ивента | `(event_week_id, milestone_key, player_id)` | `event_milestones_claimed` (PK) |
| Любая наградная выплата валюты | `(player_id, week_index, reward_key)` | `currency_ledgers.idempotency_key` (unique) |
| Cron-якорь фазы/ролловера | `(town_id, week_index, anchor_code)` | `processed_anchors` (PK) |
| Покупка IAP | `(provider, provider_txn_id)` | `purchases` (unique) |
| Тик пассива лота | `(lot_id, tick_window)` | вычислимо из `fair_sales` |

### 4.4 Матрица «мутация → шлюз» (никогда не клиент)

| Игровое действие | Шлюз | Тип |
|---|---|---|
| Сбор/посев/полив | `harvest`/`sow`/`water` | RPC |
| Крафт старт/сбор | `craft_start`/`craft_collect` | RPC |
| Продажа рынку/ярмарке | `sell_to_market`/`fair_list`/`fair_open` | RPC |
| Кооп/потлак/ивент вклад | `coop_contribute`/`potluck_contribute`/`event_contribute` | RPC |
| Помощь/подарок | `help_neighbor`/`gift_send` | RPC |
| Прогрессия | `research_start`/`staff_*`/`building_upgrade`/`expedition_*` | RPC |
| Гача/пас | `prize_pull` / (пас — джоб+`iap-verify`) | RPC/Edge |
| Покупка `◉` | `iap-verify` | Edge |
| Недельные переходы | cron-джобы §3.6 | Edge/cron |

---

## 5. UI-точки (какой бэкенд питает какой экран)

| Экран (канон §3.12) | Чтение | Запись (шлюз) | Realtime |
|---|---|---|---|
| `ui_demand_board` (Доска спроса) | `market_weeks` | — | `town:calendar` |
| `ui_coop_orders` (Кооп-заказы) | `orders`,`order_contributions` | `coop_contribute` | `street:board` |
| `ui_recipe_box` (Коробка рецептов) | `recipes`,`recipes_mastery`,конфиг | `craft_start`/`collect` | `player:inbox` |
| `ui_fair_stall` (Прилавок ярмарки) | `fair_stalls`,`fair_lots`,`fair_sales` | `fair_list`/`fair_open` | `town:fair` |
| `ui_shift` (Смена у прилавка) | конфиг смены | RPC итога смены (валидация) | — |
| `ui_appetite_meter` (Аппетитометр) | `event_weeks` | `event_contribute` | `town:event` |
| `ui_prize_machine` (Автомат) | `prize_series_pity`,`prize_pulls` | `prize_pull` | `player:inbox` |
| `ui_route_pass` (Route Pass) | `route_pass_progress` | джоб Miles / `iap-verify` premium | `player:inbox` |
| `ui_toy_shelf` (Полка игрушек) | `toys`,`collections` | — (дроп из `prize_pull`) | — |
| `ui_ribbon_wall` (Стена лент) | `ribbons_wall` | — (Edge `contest-judge`) | — |
| `ui_postcards` (Открытки) | `postcards`,`collections` | — (экспедиции/ивент) | — |
| `ui_daily_specials` (Спецблюда) | сгенерированные задачи | `streak_check` | `player:inbox` |
| `ui_regulars_club` (Клуб) | `regulars_club` | джоб от активности | — |
| `ui_potluck` (Стол стрита) | `potlucks` | `potluck_contribute` | `street:board` |
| `ui_expeditions` (Экспедиции) | `expeditions` | `expedition_start`/`collect` | `player:inbox` |
| `ui_moving_truck` (Переезд) | предложения | Edge `migrate-farm` | `street:board` |
| Городская карта (`11-town.md`) | `farms.layout` соседей (снапшот) | — | `town:*` presence |
| Кошелёк/HUD валют | `wallets` вью | — | `player:inbox` |

---

## 6. Зависимости от других систем (ссылки на спеки)

| Система | Файл | Что реализует этот бэкенд |
|---|---|---|
| Канон | `docs/specs/00-canon.md` | валюты §2.1, календарь §2.3, соц-структура §2.4, D13/D14, нейминг-ключи всех таблиц |
| Недельный цикл | `docs/specs/01-core-loop.md` | `server_calendars`, `processed_anchors`, cron-якоря, `week-rollover`, идемпотентность §4.5, синхронизация часов |
| Ферма | `docs/specs/02-farm.md` | `plots`, серверные таймеры `planted_at/ready_at`, оффлайн-устойчивость |
| Животные | `docs/specs/03-animals.md` | таймеры кормления/продукции (аналог `machine_jobs`), склад |
| Станки | `docs/specs/04-machines.md` | `machines`,`machine_jobs`,`recipes_mastery`, `craft_*` RPC |
| Ингредиенты | `docs/specs/05-ingredients.md` | справочник `item_key`/культур в конфиге |
| Экспедиции | `docs/specs/07-expeditions.md` | `expeditions`, серверный `return_at`, детерминированный payload |
| Почта/фуражинг | `docs/specs/08-mail-foraging.md` | Realtime `town:foraging`, атомарный пул точек (F6), `mech_mail_catalog` |
| Ярмарка | `docs/specs/09-fair.md` | `fair_stalls/lots/sales`, `contests`, `fair-tick`, `contest-judge` |
| Серверный ивент | `docs/specs/10-server-event.md` | `event_weeks`, `event_contribute`, `event-settle`, лиги, идемпотентность наград |
| Город/соц | `docs/specs/11-town.md` | `orders`,`potlucks`,`help_actions`,`gifts`,`mentorships`,`town_projects`,`chat`,`farm_visits`, смурф-детект |
| Переезды | `docs/specs/12-migration.md` | `migrate-farm`, `merge-check`, city-партиции, тикет-компенсация (D12) |
| Прогрессия | `docs/specs/13-progression.md` | `staff_*`,`know_how_nodes`,`buildings`,`farm-value-recalc`, XP/уровень |
| Экономика | `docs/specs/14-economy.md` | источник всех балансных чисел в `game_configs` |
| Монетизация | `docs/specs/15-monetization.md` | `purchases`,`iap-verify`,`route_pass*`,`prize_*`,`regulars_club`, гардрейлы G1/G2 |
| Удержание | `docs/specs/16-retention.md` | Daily Specials-генерация, `streak_check`,`streak_freeze`, `push-dispatch`, тихие часы |
| Мультиплеер-синк | `docs/specs/17-multiplayer-sync.md` *(планируется)* | детали шардинга городов, партиций, Realtime-протокола |

---

## 7. Edge cases

| # | Ситуация | Поведение бэкенда |
|---|---|---|
| B1 | **Cron-якорь не сработал вовремя** (лаг инфры) | Джоб догоняющий: сверяет `now()` с якорями, доигрывает пропущенные фазы по порядку; игрок при первом чтении `server_calendars` видит корректную фазу (канон C1). |
| B2 | **Двойной запуск rollover/settle** (ретрай cron) | `processed_anchors` PK / idempotency-ключ → второй прогон no-op; награды не дублируются (канон C2/EV8). |
| B3 | **Гонка за последнюю точку фуражинга/сток** | Атомарное списание в транзакции; проигравший получает мягкое «уже собрали последнее», без ошибки/отката UI (канон F6). |
| B4 | **Клиент шлёт `harvest` до `ready_at`** | Строка пропускается (не ошибка): собирается только реально созревшее; клиентское время игнорируется. |
| B5 | **Клиент пытается прямой INSERT в `inventory`/`currency_ledgers`** | RLS write=`false` → 403/0 строк; попытка логируется как `rejected` в `audit_logs`. |
| B6 | **Дубль IAP-квитанции** (двойной колбэк провайдера) | unique `(provider, provider_txn_id)` → повторная верификация не начисляет `◉` второй раз. |
| B7 | **Игрок в отпуске (`vacation_until`)** | Таймеры «замораживаются» логически: RPC-действия помечают ферму `vacation`; сосед-смотритель имеет ограниченные права помощи (E6). |
| B8 | **Переполнение склада при сборе** | `craft_collect`/`harvest` проверяют лимит Silo/Icehouse; излишек предлагается в подарок/потлак, а не теряется (E3). |
| B9 | **Апгрейд конфига в середине недели** | Ферма донашивает `config_version_id` начала недели до ролловера; новая версия — со следующей недели (стабильность §3.8). |
| B10 | **Переезд игрока между городами** | `migrate-farm` — атомарный перенос строк между city-партициями; `street_members`/`server_calendars` целевого города; тикет-компенсация town-projects (D12, «ничего не сгорает»). |
| B11 | **Смурф качает основной аккаунт** | `device_fingerprints` матч → исключение из ментор/помощь-матчинга; дневные кэпы всё равно применяются. |
| B12 | **Клиент «объявляет» дроп Prize Machine** | Игнорируется: результат генерит сервер по seed'у + `prize_series_pity`; клиент только анимирует выданное. |
| B13 | **Разные таймзоны игроков** | Все якоря — UTC; окно ярмарки 36 ч и мягкие дедлайны покрывают пояса (канон E11); тихие часы пушей — по `tz_offset_min` игрока. |
| B14 | **Rollover застаёт незавершённый крафт/экспедицию** | Активные таймеры переносятся как есть (метки абсолютные); ролловер сбрасывает только недельные сущности (Demand/Specials/кооп-слоты), не личные незавершённые job'ы. |
| B15 | **Голосование за собственную заявку конкурса** | Отклоняется в `contest_vote` (гипотеза: нельзя за себя); unique-гард против повтора. |

---

## 8. Открытые вопросы

1. **Технические под-валюты вне канона §2.1.** `scrap` (`⚙`), `kh_points` (Know-How Points), `staff_tokens`, `miles` (Route Pass) используются как валюты в `currency_ledgers`, но не входят в 4 каноничные (`bucks/dimes/tickets/ribbons`). Нужен PR в канон §2.1/§3.13: закрепить их как «служебные под-валюты» или вынести из леджера в отдельные счётчики. Сейчас помечены `(нейминг-кандидат, требует канона)`.
2. **Шардинг городов по региону/языку.** `towns.region_tag` введён гипотезой (нужен для Town Browser, `12-migration.md` O2), но канон не фиксирует региональное шардирование. Все города в одном пуле или партиционируются по региону? Влияет на `migrate-farm` (кросс-регион переезд) и матчмейкинг versus.
3. **Партиционирование по городу.** Предполагается партиция крупных таблиц (`inventory`,`fair_sales`,`event_contributions`,`chat_messages`) по `town_id` ради `migrate-farm` и масштаба. На каком пороге DAU включать декларативные партиции Postgres — нужен нагрузочный тест (гипотеза: >5k активных ферм).
4. **Тик пассива ярмарки 15 мин vs event-driven.** `fair-tick` крон каждые 15 мин (`09-fair.md` OQ) — компромисс. Альтернатива: ленивое вычисление продаж при чтении прилавка (без крона). Согласовать стоимость Supabase-крона vs латентность лога продаж.
5. **Финал ивента 20:00 UTC vs пиковый онлайн.** Канон §8.1 держит вопрос открытым (20:00 UTC гипотеза или привязка к пику города). Бэкенд поддержит оба (якорь — колонка `event_final`), но нужен ответ канона для дефолта cron-расписания.
6. **Пуш-провайдер и тихие часы.** `push-dispatch` требует внешний провайдер (Web Push/FCM/APNs); тихие часы — по таймзоне клиента (`tz_offset_min`) или серверные? (`16-retention.md` OQ). Влияет на планировщик `push_daily`.
7. **Материализация кошелька.** `wallets` как триггер-обновляемая таблица vs вью поверх `currency_ledgers` (last `balance_after`). Таблица быстрее на чтение, но требует строгого триггер-гарда против рассинхрона. Решить по нагрузке HUD-запросов.
8. **Число постов стаффа (Yard).** Канон §8.5 держит открытым 4-й пост `Yard`. Схема `staff_assignments.post` допускает 4 значения; если канон свернёт `Yard`, миграция сузит enum.
9. **Формула pity Prize Machine — точные числа.** Канон §8.6 просит зафиксировать открытую цифру pity. Схема хранит счётчики (`pulls_since_rare/chase`), но пороги (10/40) — из `15-monetization.md` (гипотеза), финал — в `game_configs`. Согласовать с каноном.
10. **RNG-детерминизм для аудита.** Prize Machine и генерация спроса используют серверный seed. Нужно решить: хранить ли seed каждой круты в `prize_pulls` для полной воспроизводимости аудита (privacy/объём) — или достаточно результата. Гипотеза: хранить seed только при спорных кейсах.
11. **Дедлайн Co-op Orders vs окно экспедиций.** Канон §8.4 держит открытым возможный конфликт дедлайна Чт 23:59 с окном экспедиций (Ср). Схема нейтральна (`orders.deadline` = якорь), но при изменении канона поменяется генерация в `market-generate`.
12. **Storage-квоты Photo Mode.** `photo-upload` в Supabase Storage — нужен лимит на игрока (гипотеза: 50 скриншотов, авто-GC старых) и модерация UGC. Не покрыто каноном.
