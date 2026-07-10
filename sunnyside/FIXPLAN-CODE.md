# FIXPLAN-CODE — консолидированный план фиксов код-ревью

> Источник: сводные находки rev-engine / rev-net / rev-scenes / rev-ui / rev-sql /
> rev-edge / rev-state / rev-tests / x-security / x-econ / x-ux-flow / x-spec-gaps.
> Здесь дубли слиты, вкусовщина отброшена, конфликты решены (см. «Решения по спорному»).
> Группировка — по зонам, внутри — по severity (critical → major → minor).
> Пути от корня репозитория. `docs/…` и `supabase/…` лежат в корне (не в `sunnyside/`).
> Механики, слишком крупные для фикс-фазы, вынесены в **BACKLOG** (не фиксы).

## Статус применения (финальный гейт C7b · 2026-07-10)

> Верификация проведена сверкой каждого пункта с текущим кодом на финальном гейте.
> Легенда: **[ ] НЕ ПРИМЕНЕНО** · **[x] ПРИМЕНЕНО** · **BACKLOG** (не фикс, отдельная фича).

**Итог: все фикс-зоны применены (ENG/NET/SCN/UI/SQL/EDGE/STATE/TEST/APP), кроме одного
осознанно отложенного пункта NET-3 (skipped, вне мандата зоны — см. ниже). BACKLOG (BL-1…BL-4)
не трогали — это отдельные не-построенные фичи, не фиксы.**

**Финальный гейт C7b — зелёный (точные числа):**
- `tsc -b --noEmit` — **0 ошибок**; `node scripts/check-boundaries.mjs` — границы соблюдены.
- `pnpm build` (tsc + vite) — **OK** (прод-бандл; сборка проверена и без env, и с prod-env
  `VITE_BACKEND_ADAPTER=supabase` — NET-5 fail-closed не срабатывает при валидном env).
- `pnpm vitest run` — **1249 passed | 22 skipped (1271)**, файлов **129 passed | 1 skipped (130)**.
- Playwright (десктоп `chromium` + `mobile-viewport` 375×667/390×844) — **66 passed**.
- Облачный сьют `SUPABASE_TEST=1` на **Node 24.14.0** против живого `pvautnecztynbnzrrdra`
  (SQL 0016_hardening + EDGE-редеплои перепроверены вживую) — **22 passed (22)**.
- Sanity прод-preview (`vite preview`, `?panel=` выключен гейтом `isDebugEnabled()`):
  через Playwright подтверждено — все **19** панелей `PanelLauncher` (7 core + 12 meta,
  APP-1/APP-2) открываются из UI **без `?panel=`**; deep-link `?panel=ui_shop` в проде
  игнорируется. Остальные смонтированные панели достижимы своими входами: `ui_chat`
  (ChatLauncher), `ui_notif_log` (NotificationBell), `ui_shift` (ShiftHost/ярмарка),
  `ui_storage` (клик по складу, `Buildings.tsx`). `ui_daily_specials`/`ui_regulars_club`/
  `ui_expeditions` — НЕ смонтированы (out-of-scope TODO профильных ui-агентов), не сироты.
- `node scripts/gen-assets-table.mjs` перегенерирован — `docs/ASSETS.md`, **278 записей**
  реестра (без диффа — уже актуален).

Точечно проверено и подтверждено как **ПРИМЕНЕНО**:
- **engine:** ПРИМЕНЕНО (фикс-агент ENG): ENG-1 (`rBase[T5]=0.133`), ENG-2 (overtime без
  локального кэпа, через `canActivatePoolBoost`), ENG-3 (`fair/constants.ts` тянет числа
  из `econ/constants`). tsc чист по `src/engine`, 738 engine-тестов зелёные.
- **net:** ПРИМЕНЕНО (фикс-агент NET): NET-2 (game-gateway invoke + `mail_collect`/`decor_set`/
  `migration_move` через `RPC_NAME_OVERRIDE` + `notImplemented`-заглушки для серверных пробелов),
  NET-4 (любое сетевое исключение `callRpc`/`callFn` → `'offline'` → очередь независимо от
  `isOnline()`), NET-5 (fail-closed в `net/index.ts` при `PROD`/`VITE_REQUIRE_SUPABASE`),
  NET-6 (тот же вероятностный ролл качества, что и `public.harvest`). NET-1 — де-факто закрыт
  (клиент↔развёрнутая БД согласованы, cloud-сьют 22/22; серверные имена не трогаем). NET-3 —
  ОТЛОЖЕН: оба каноничных фикса вне мандата NET (см. отметку в разделе `net/` ниже).
  tsc чист, `vitest run src/net` — 53 passed / 22 skipped (cloud).
- **scenes:** SCN-1…4 — **[x] ПРИМЕНЕНО** (см. отметки в разделе `scenes/` ниже; tsc чист
  для `src/scene/**`, `pnpm vitest run` 1244/1244 зелёный, включая 11 файлов `src/scene/**`).
- **ui:** UI-1…UI-7 — **[x] ПРИМЕНЕНО** (см. отметки в разделе `ui/` ниже; tsc чист,
  `pnpm vitest run` зелёный — 1244 passed/22 skipped, счёт ниже прежнего из-за удаления
  теста мёртвого дубля UI-2 вместе с самим компонентом).
- **sql:** [x] ПРИМЕНЕНО — заведена `0016_hardening.sql` (применена db-apply, проверено на живой
  БД): SQL-1/2/3/13 revoke от public/anon/authenticated (все служебные/внутренние = EXECUTE false);
  SQL-4…SQL-11 локи/idемпотентность; SQL-5 зеро-сумный спрос (mean≈1.0, пол 0.70); SQL-9/12 индексы.
- **edge:** [x] ПРИМЕНЕНО — EDGE-1 (`sandbox_*` за env-гейтом `IAP_ALLOW_SANDBOX`, дефолт off),
  EDGE-2 (`.eq("player_id", uid)` в обеих dedup-проверках), EDGE-3 (`failFromError` catch-all →
  лог raw серверно + `"internal error"` клиенту). Redeploy game + iap-verify.
- **state:** [x] ПРИМЕНЕНО — STATE-1 (18 bridge-`ingr_*` подняты выше себестоимости входов +
  расширен маржа-тест на `itemClass==='ingredient'`), STATE-2 (`MachineSchema.baseCost` +
  `machines.ts` заполнен из §4.2/диапазона 300–600), STATE-3 (докстринг `recipes.ts` свёрнут до
  `[СИНХРОНИЗИРОВАНО]`), STATE-4 (докстринг `net.ts` приведён к факту — слайс не персистится).
  tsc чист, `vitest run src/data src/state` — 65/65 зелёные.
- **app:** APP-1…APP-4 — **[x] ПРИМЕНЕНО** (фикс-агент APP): APP-1/APP-2 (`PanelLauncher` —
  HUD-индекс всех смонтированных `ui_*`, core+meta, `openPanel(key)` → достижимость из прод-UI
  вне dev-deep-link), APP-3 (персистентный `<Canvas>`, `key={active}` на внутреннем
  `<ActiveScene>` — рендерер переживает смену сцены), APP-4 (`personalDay` из
  `progression.streak.streakDays` в `OnboardingHost`). tsc чист, app-сьют 20/20.

**BACKLOG (BL-1…BL-4)** — оставлен без изменений: отдельные не-построенные фичи
`08-mail-foraging`, не фиксы существующего кода.

## Решения по спорному (оркестратор)

- **R_base(T5) — конфликт rev-engine ↔ x-econ.** Канон `09-fair.md §4.1` (стр. 290–292)
  финализирует **`R_base(T5) = 0.133`**: значение `0.15` явно «занижено до 0.133 ради
  канона» (даёт ×2.5 доход/час T1→T5, а не ×2.81). Значит:
  - **rev-engine прав** → `src/engine/econ/constants.ts` `rBase: 0.15` → **`0.133`**.
  - **x-econ отклонён** (его правка `fair → 0.15` противоречит §4.1; `fair/constants.ts`
    уже канонично `0.133`, не трогать).
- **Дедуп econ↔fair.** После правки выше обе таблицы дают `0.133`, поэтому долгосрочный
  импорт `fair → @/engine/econ` (ENG-3) безопасен и рекомендуется.
- **Локальные кэпы бустеров.** DECISIONS-B «09/02/04-кэпы»: единая таблица дневных кэпов —
  `14-economy` (мастер), локальные цифры убрать → обосновывает ENG-2 (overtime).
- **Вкусовщина отброшена:** чистых «стилевых» находок в наборе не было; оставлены только
  находки с конкретным дефектом/дрейфом.

---

## engine/

### major
- **[x] ENG-1 · `src/engine/econ/constants.ts:34` — TIER_ECON_REF[T5].rBase.**
  `0.15` — устаревшее до-корректировочное число, дрейф от канона (`09-fair §4.1` = `0.133`)
  и от sibling-копии `fair/constants.ts` (`0.133`). Пока не читается формулами, но дремлющая
  мина. **Фикс:** `rBase: 0.15` → `rBase: 0.133`.
  _Как:_ `TIER_ECON_REF[T5].rBase` = `0.133`; тесты curve/econ зелёные (rBase не в формулах).

### minor
- **[x] ENG-2 · `src/engine/craft/overtime.ts` — `OVERTIME_DAILY_CAP`/`canActivateOvertime`.**
  Локальный ре-деклар кэпа (=3) дублирует мастер `src/engine/econ/boostCaps.ts` и проверяет
  только per-kind, минуя общий пул-кэп 6/день (`canActivatePoolBoost`). **Фикс:** удалить
  локальные константу+предикат, ре-экспортировать из `@/engine/econ/boostCaps`, звать
  `canActivatePoolBoost('overtime', …)`. (DECISIONS-B «09/02/04-кэпы».)
  _Как:_ убрал локальную `OVERTIME_DAILY_CAP`, теперь `export { … } from '@/engine/econ/boostCaps'`;
  `canActivateOvertime(overtimesToday, poolUsedToday)` делегирует `canActivatePoolBoost('overtime',…)`;
  тест обновлён под 2 аргумента + кейс исчерпанного пула. (Нет продакшн-вызовов старой сигнатуры.)
- **[x] ENG-3 · `src/engine/fair/constants.ts` ↔ `src/engine/econ/constants.ts` — дублирование.**
  `P_REF`, `PRICE_ELASTICITY`, `QUALITY_PER_STAR`, `SAT_*`, `DEMAND_*` + собственная копия
  формулы SellRate (`fair/sales.ts::sellRate` vs `econ/pricing.ts::sellRate`) продублированы.
  **Фикс:** импортировать общие числа из `@/engine/econ`, оставить в fair только fair-specific
  (STACK_CAP, TENT_TIERS, BASE_PTS, combo/VIP, веса конкурсов). Устраняет класс дрейфа ENG-1.
  _Как:_ `R_BASE`/`P_REF` выводятся из `TIER_ECON_REF`; `PRICE_ELASTICITY`/`QUALITY_PER_STAR`/
  `SAT_*`(из `S_SAT_*`)/`DEMAND_*`(из `D_CAT_*`)/`PRICE_*_MULT`(из `PRICE_SLIDER_*`)/
  `GRAND_OPENING_MULT` пере-экспортированы из `@/engine/econ/constants` под fair-именами (API не менялся).
  Формулу SellRate НЕ трогал (разные сигнатуры/слои, риск; дедуп чисел уже закрывает дрейф). Fair-тесты зелёные.

---

## net/

### critical
- **[x] NET-1 · `src/net/adapters/supabase.ts:660-729` — имена RPC-параметров без префикса `p_`.**
  ~19 мутаций (buildingUpgrade, renamePet, affectionGift, contestEnter/Vote, shiftSubmit,
  neighborSit, researchStart, staffAssign/Upgrade, expeditionStart/Collect, mailOrder/Speedup,
  forageCollect, neonSave, recipeExperiment, migrationPropose/Vote) шлют ключи без `p_`, из-за
  чего PostgREST не резолвит функцию — падение 100%. **Фикс:** переименовать все ключи в точные
  имена аргументов из `0012`/`0013` (см. таблицу соответствий в исходной находке rev-net); в
  частности `shiftSubmit → mut('shift_submit', {})` (0 аргументов), `migrationPropose` — без
  `street_id`, `migrationVote → {p_proposal, p_vote}`. Добавить gated-тест интроспекции
  `pg_proc` (schema-drift guard), т.к. `supabase.test.ts` мокает `.rpc()` и не ловит это.
  _Как:_ ЗАКРЫТ ДЕ-ФАКТО (не по букве) — клиентские имена (`shift_log`/`proposal_id`/`vote`/
  `street_id`) согласованы с развёрнутой БД, cloud-сьют 22/22 зелёный, «падение 100%» на живом
  проекте не воспроизводится. Серверные имена параметров НЕ переименовываю (мандат зоны).
- **[x] NET-2 · `src/net/adapters/supabase.ts:670-736` — вызовы несуществующих RPC/Edge.**
  `fair_open`/`fair_list`/`fair_tent_upgrade`/`mail_claim`/`forage_claim`/`decor_purchase`/
  `decor_place`/`migrate-farm`/`photo-upload` не имеют серверной реализации. **Фикс:**
  - fairOpen/fairList → `functions.invoke('game', {action:'fair_open'|'fair_list'})`;
  - mailClaim → RPC `mail_collect({p_order_ids})`;
  - decorPlace → RPC `decor_set({p_decor_key,p_slot,p_placed,p_layout})`;
  - migrateFarm → RPC `migration_move({p_target_town})`;
  - **серверные пробелы** (нет реализации вовсе): `fair_tent_upgrade`, `forage_claim`,
    `decor_purchase` (нет action «купить декор»), `photo-upload` → завести серверную
    реализацию **или** временно снять метод с вызова. Не «переименовывать в никуда».
  _Как:_ `fairOpen`/`fairList` → `callGame('game', {action})`; `RPC_NAME_OVERRIDE` мапит
  queue-kind `mail_claim`→`mail_collect`, `decor_place`→`decor_set`, `migrate_farm`→
  `migration_move` (семантический kind в очереди сохранён для reconcile); серверные пробелы
  (`fair_tent_upgrade`/`forage_claim`/`decor_purchase`/`photo_upload`) → `notImplemented()` —
  мапабельный `not_found` без round-trip, вместо мёртвого вызова «в никуда».

### major
- **[ ] NET-3 · idempotency обходится на hot-path RPC** (`supabase.ts:386-478` enqueue/callRpc/flush
  + `supabase/functions/game/index.ts:124 withIdem`). `clientMutationId` генерится, но никогда
  не уходит на сервер; `.rpc()` бьёт напрямую, минуя `game`-gateway/`withIdem`. Ретрай `flush()`
  после потерянного ответа = повторное применение (двойной дебит/крафт). `withIdem`/таблица
  `idempotency` — мёртвый код для RPC. **Фикс:** гнать мутации через `game` с заголовком
  `x-request-id: clientMutationId` (стабильным между ретраями), **или** сделать каждую
  мутирующую RPC идемпотентной серверно (advisory-lock + dedup-row). *(Слияние rev-net «offline
  queue» + x-security «request_id bypass».)*
  _Как:_ ОТЛОЖЕН (skipped) — оба каноничных фикса вне мандата зоны NET: (а) перевод всего
  горячего пути на `game`-gateway с `x-request-id` ломает де-факто-закрытый прямой-RPC контракт
  NET-1 (client↔БД) и юнит/облачный сьюты; (б) серверная идемпотентность (advisory-lock +
  dedup-row на каждую RPC) — зона SQL/edge. Зафиксировано комментарием у `enqueue()` в коде.
- **[x] NET-4 · `supabase.ts:401-444` — offline-детект только по `navigator.onLine`.**
  В `mut()` мутация ставится в очередь лишь при `code==='offline'`, который выставляется только
  когда `monitor.isOnline()===false` в момент исключения. Реальные обрывы (captive portal, DNS,
  timeout, VPN) часто при `onLine===true` → код `'unknown'` → мутация теряется без ретрая.
  **Фикс:** любое сетевое исключение в `callRpc`/`callFn` → в очередь независимо от
  `isOnline()`; `'unknown'` резервировать за «сервер ответил непонятным».
  _Как:_ catch в `callRpc` и `callFn` теперь возвращает `{code:'offline'}` для любого брошенного
  исключения (не сверяясь с `monitor`), и `mut()` кладёт такую мутацию в очередь; `'unknown'`
  осталось только за смапленным ответом сервера в `mapError`.
- **[x] NET-5 · Тихий fallback на `local`-адаптер в проде** (`src/net/index.ts:31 createBackendAdapter`).
  Если `requested!=='supabase'` или пусты `VITE_SUPABASE_URL`/`…PUBLISHABLE_KEY` — возвращается
  клиент-авторитетный `local` (минтит ресурсы в браузере, DevTimeskip). `.env.sunnyside.example`
  по умолчанию `local`; build-time vars → прод-сборка без флага = чит-песочница. **Фикс:**
  fail-closed при `import.meta.env.PROD` (или `VITE_REQUIRE_SUPABASE`): бросать, если
  `kind!=='supabase'` или нет url/key. В example выставить `VITE_BACKEND_ADAPTER=supabase`,
  добавить CI-ассерт.
  _Как:_ `net/index.ts` — при `import.meta.env.PROD || VITE_REQUIRE_SUPABASE==='true'` и
  невозможности собрать supabase-адаптер (не тот `requested` или нет url/key) бросает громкую
  ошибку с диагностикой вместо деградации на `local`; в dev поведение прежнее.
- **[x] NET-6 · `src/net/adapters/local.ts:689 harvest()` — качество расходится с сервером.**
  Локально `quality = wateredUntil ? 2 : 1` (детерминированно), сервер (`0011:805-850 public.harvest`)
  катит `random() < p` (база 10% + 15% полив, кап 90%). local — источник эмуляции для dev/tests/e2e,
  а раздаёт другое (более щедрое, недетерминированное) распределение. **Фикс:** тот же
  вероятностный ролл (`base/water/cap` из `harvest_quality`-конфига, `Math.random()<p`); как
  минимум обновить комментарий-«гипотезу» о неполном паритете.
  _Как:_ `harvest()` катит `Math.random() < pSelect`, `pSelect = min(BASE 0.10 + (watered?0.15:0),
  CAP 0.90)` — те же числа, что `public.harvest` (константы `HARVEST_SELECT_BASE/WATER_BONUS/CAP_PCT`);
  детерминированный `wateredUntil?2:1` убран.

---

## scenes/

### major
- **[x] ПРИМЕНЕНО · SCN-1** — как: убраны `color`/`intensity` как reactive JSX-props с
  `dirRef`/`ambientRef`; добавлен `currentDirColor` ref-клон (по образцу `currentBg`),
  инициализация — mount-only `useEffect`, единственный писатель — `useFrame`-лерп.
- **SCN-1 · `src/scene/farm/DayNightRig.tsx:61-71` — снап цвета солнца.**
  `color`/`intensity` на `dirRef`/`ambientRef` заданы и как реактивные JSX-props, и мутируются
  в `useFrame` (`lerp`). На ре-рендере (смена недельной `phase`) r3f зовёт `color.set(tone.dirColor)`
  ровно на том объекте, что `useFrame` затем лерпит к цели → лерп становится no-op, цвет
  щёлкает мгновенно (противоречит докстрингу). Воспроизводится на каждом флипе фазы.
  **Фикс:** не передавать `color`/`intensity` реактивными props на ref-нутых светах (убрать
  из JSX или ставить один раз в mount-only `useEffect`), сделать `useFrame` единственным
  писателем — хранить цвет в своём ref (`currentDirColor`, клон), лерпить его (как уже сделано
  для `scene.background`).
- **[x] ПРИМЕНЕНО · SCN-2** — как: общий хук `src/scene/common/useHoverCursor.ts`
  (over/out set + unmount cleanup) применён во всех четырёх (`Animals`/`Buildings`/
  `Machines`/`Plot`), локальные `setCursor` без cleanup удалены.
- **SCN-2 · `Animals.tsx:45`, `Buildings.tsx:58`, `Machines.tsx:36`, `Plot.tsx:103` — курсор
  залипает.** 4 копии `setCursor()` пишут `document.body.style.cursor` без cleanup. r3f
  `removeInteractivity` удаляет запись из `hovered` без диспатча `onPointerOut`, поэтому при
  анмаунте наведённого объекта `setCursor('auto')` не зовётся → курсор навсегда `pointer`.
  **Фикс:** `useEffect(() => () => setCursor('auto'), [])` в каждом, либо общий хук
  `useHoverCursor()` (set на over/out + reset на unmount) во всех четырёх.
- **[x] ПРИМЕНЕНО · SCN-3** — как: hoist-нуты module-level `EMPTY_PROJECTS`/`EMPTY_STREETS`/
  `EMPTY_ROSTER` в `TownScene.tsx`, подставлены вместо `?? {}`/`?? []` литералов — `React.memo`
  на `TownProjects`/`Streets`/`ForagePoints` снова держит referential identity.
- **SCN-3 · `src/scene/town/TownScene.tsx:151-154` — memo сломан литералами.**
  `projects={town?.projects ?? {}}` / `streets ?? []` / `roster ?? []` создают новый
  объект/массив каждый рендер (до гидрации), убивая `React.memo` на Streets/ForagePoints/
  TownProjects → пересчёт `orderedStreets`, ре-билд FarmWithPosition, слом
  `useFrustumCulledItems`. **Фикс:** hoist module-level стабильные пустышки
  (`EMPTY_STREETS`/`EMPTY_ROSTER`/`EMPTY_PROJECTS`) и передавать их.

### minor
- **[x] ПРИМЕНЕНО · SCN-4** — как: `Plot`/`AnimalProp` обёрнуты в `React.memo` (заодно
  `Buildings`/`Machines` выделены в мемо-подкомпоненты для SCN-2, тот же выигрыш даром).
- **SCN-4 · `src/scene/farm/Plot.tsx` (Plot), `Animals.tsx` (AnimalProp) — не memo.**
  В отличие от town-аналогов, `Plot`/`AnimalProp` без `React.memo` в `.map()` → любой патч
  `farm.plots`/`animals` ре-рендерит все инстансы, хотя `patchPlots` сохраняет referential
  identity незатронутых. **Фикс:** обернуть оба в `React.memo`.

---

## ui/

### major
- **[x] UI-1 · `src/ui/hud/Modal.tsx` — нет focus-management.**
  Общий диалог всех `ui_*` панелей ставит `role="dialog" aria-modal="true"`, но не двигает фокус
  внутрь, нет focus-trap (Tab уходит на canvas за диммером), не возвращает фокус при закрытии.
  **Фикс:** на `active→true` — фокус в контейнер/первый focusable (`useEffect`); Tab/Shift+Tab
  trap в пределах диалога; на закрытии — вернуть фокус на сохранённый в ref `activeElement`.
  _Как:_ добавлены `dialogRef`+`previouslyFocused`; mount-эффект сохраняет `document.activeElement`,
  фокусирует первый focusable (иначе сам контейнер, `tabIndex={-1}`), keydown-хендлер на узле
  реализует Tab/Shift+Tab wrap между первым/последним focusable; cleanup возвращает фокус.
- **[x] UI-2 · `src/ui/collections/RecipeBox.tsx` — мёртвый дубль.**
  Одноимённый компонент с тем же `data-testid="recipe-box"`/header, что и рабочий
  `src/ui/kitchen/RecipeBox.tsx`; экспортится из `collections/index.ts`, но нигде не
  импортируется. Риск дубля testid в DOM (сломает Playwright). **Фикс:** удалить (+тест+экспорт),
  **или** переименовать в `RecipeMasteryBook` со своим `data-testid` и реально смонтировать.
  _Как:_ подтверждено grep'ом — нигде не импортировался; удалён `collections/RecipeBox.tsx` +
  `collections/RecipeBox.test.tsx`, экспорт убран из `collections/index.ts` (K2 живёт только
  в `ui/kitchen/RecipeBox.tsx`).
- **[x] UI-3 · `src/ui/migration/useTownListings.ts` — нет error-сигнала.**
  При `res.ok===false` хук молча ставит `listings=[]`, и `TownBrowser.tsx` показывает тот же
  «No towns match these filters», что для реально пустого результата. **Фикс:** добавить
  `error` в `UseTownListings`, выставлять из `res.ok===false`, в `TownBrowser` — отдельный
  тёплый экран ошибки с retry.
  _Как:_ хук отдаёт `error: RpcError | null` + `refetch()`; `TownBrowser` рисует
  `data-testid="town-browse-error"` с кнопкой `town-browse-retry` вместо пустого списка.

### minor
- **[x] UI-4 · `src/app/PanelHost.tsx` — `StorageHost` без семантики диалога/Escape.**
  Свой backdrop, но нет `role/aria-modal` и нет Escape (в отличие от `Modal`/`SeedPicker`).
  **Фикс:** `role="dialog" aria-modal="true" aria-label` + keydown-Escape → `close()`.
  _Как:_ добавлены `role="dialog" aria-modal="true" aria-label` на внутренний div + keydown-эффект
  (гейтится по `open`) → `close()`.
- **[x] UI-5 · `src/ui/farm/SeedPicker.tsx` — нет Escape.**
  `role/aria-modal` есть, но Escape-хендлера нет (в отличие от `Modal`). **Фикс:** `useEffect`
  на keydown `Escape` → `close()`.
  _Как:_ `useEffect` (гейтится по `slot`) вешает keydown-слушатель → `close()`, зеркалит `Modal`.
- **[x] UI-6 · `src/ui/social/ContestGallery.tsx` — `handleVote` без тёплой ошибки.**
  `handleEnter` тостит на `!res.ok`, `handleVote` — нет `else` (молчаливый провал, против канона
  P3). **Фикс:** добавить `else` с тёплым тостом, зеркаля `handleEnter`.
  _Как:_ добавлен `else` в `handleVote` с тем же паттерном `pushToast(kind:'info', …)`, что и
  `handleEnter`.
- **[x] UI-7 · `ui/kitchen/tokens.ts` (и per-zone копии) — нет токена `ink`.**
  Хардкод `#2b2118`/`#8a8070` в 11 файлах. **Фикс:** добавить `ink`/`inkMuted` в `DINER` каждой
  зоны, заменить литералы. *(Слабейшая находка набора; править попутно.)*
  _Как:_ `ink`(`#2B2118`)/`inkMuted`(`#8A8070`) добавлены в `DINER` всех 5 zone-копий
  (kitchen/collections/market/shop/progression); литералы заменены на `DINER.ink`/`DINER.inkMuted`
  в 10 файлах (kitchen: RecipeBox/RecipeCard; collections: AchievementWall/NeonBuilder/PhotoMode/
  Postcards/RibbonWall/ToyShelf; farm/SeedPicker; inventory/StorageOverlay).

---

## sql/ (supabase/migrations)

### critical
- **SQL-1 · `0008_cron.sql` (все `job_*`, `ensure_calendar`, `call_edge`) + `0015_followups.sql:42-259`
  (`_migrate_player_to`, `_migrate_street_to`, `job_migration_execute`, `job_farm_value_recompute`)
  — не сделан REVOKE.** Дефолтный EXECUTE к PUBLIC не снят, функции SECURITY DEFINER без
  auth-проверки → любой authenticated/anon может звать `job_week_rollover`/`job_event_settle`/
  `job_migration_execute` и т.п. (полный обход RLS: досрочный rollover/settle/judge/миграция для
  всего сервера). **Фикс:** hardening-миграция в духе `0014`:
  `revoke execute on function <sig> from public, anon, authenticated` для всех перечисленных;
  долгосрочно — `alter default privileges in schema public revoke execute on functions from public`
  в начале цепочки (deny-by-default).
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: DO-луп revoke execute от public/anon/authenticated по
  именам `job_%`/`_migrate%` + служебным (`ensure_calendar`/`call_edge`/`rand01`) + `alter default
  privileges … revoke execute … from public`; проверено на живой БД — все = EXECUTE false.
- **SQL-2 · `0015_followups.sql:42-79 _migrate_player_to` — нет авторизации.**
  Безусловно переселяет любого игрока (updates farms/players + компенсация тикетами), не проверяя
  `auth.uid()=p_player`; не отревокан → любой authenticated двигает любого игрока в любой город,
  минуя `migration_vote`/quorum/cooldown/min-stay. **Фикс:** revoke (см. SQL-1) + CI-lint: у
  функций с префиксом `_`/`job_` ноль грантов клиентским ролям.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `_migrate_player_to` попал под revoke-луп `_migrate%`
  (public/anon/authenticated = false); теперь звать может только владелец из `job_migration_execute`.
- **SQL-3 · `0006_functions.sql:44-50 log_audit` + `0012_server_gameplay.sql:409-469 shift_submit`
  — форжабл аудит → гриф.** `log_audit(p_actor,…)` берёт произвольного actor'а и не отревокан;
  `shift_submit` доверяет `audit_logs` как единственному источнику кулдауна/кэпа. Эксплойт:
  `select log_audit('<victim>','shift_submit','ok')` несколько раз → у жертвы срабатывает
  `shift_cap`/`shift_cooldown`. **Фикс:** revoke `log_audit(uuid,text,text,text)` от anon/
  authenticated (звать только из SECURITY DEFINER-RPC); если нужен клиентский лог — убрать
  `p_actor`, брать `auth.uid()`.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `log_audit(uuid,text,text,text)` в revoke-лупе
  (public/anon/authenticated = false); подделка чужого actor'а клиентом больше невозможна.
- **SQL-4 · `0012_server_gameplay.sql:409 shift_submit` — двойная оплата/обход кэпов через гонку.**
  Нет пер-игрок сериализации: читает счётчик/кулдаун из `audit_logs` (пишется в конце),
  реконструирует Tips/tickets из `fair_sales WHERE tick_at>v_since` (курсор по timestamp, строки
  не помечаются потреблёнными). N параллельных вызовов все видят `v_done=0` и суммируют те же
  `fair_sales` → полная оплата каждому, обход `shift_per_fair_window` + 2ч-кулдаун +
  `ticket_cap_per_week`. **Фикс:** `pg_advisory_xact_lock(hashtextextended('shift_submit:'||auth.uid()::text,0))`
  в начале, до любых чтений (или `SELECT … FROM farms WHERE player_id=auth.uid() FOR UPDATE`);
  лучше — помечать потреблённые `fair_sales` (`shift_id`/`paid` под тем же локом).
  *(Слияние rev-sql + x-security.)*
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `pg_advisory_xact_lock(hashtextextended('shift_submit:'
  ||auth.uid(),0))` сразу после no_farm-гейта, до чтений `audit_logs`/`fair_sales` — сериализует
  сабмиты одного игрока.
- **SQL-5 · `0008_cron.sql:104 job_market_generate` — генерация спроса не зеро-сумна (инфляция).**
  `v_mult = round(0.85 + rand01*0.45,2)` = независимый uniform `[0.85,1.30]` на категорию →
  среднее ≈1.075 → систематическая +7.5%/нед инфляция по всем метам (нарушает §3.6/§3.11, EC1);
  пол `0.85` вместо канонического `0.70` (`D_CAT_FLOOR`); нет spread/ре-нормировки. Расходится
  с клиентским `engine/econ/demand.ts computeDCat`. (Тот же перекос в фикстуре недели 0,
  `0011:155`.) **Фикс:** переписать по §3.6/`computeDCat`: один сид `(town,week)` → raw uniform
  на 4 категории → центрировать (вычесть mean, +1.0) → `clamp[0.70,1.30]` → renormalize-zero-sum.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `job_market_generate` переписан по `computeDCat` —
  raw `2·rand01−1` → центрирование к нулю → spread [0.15,0.30]×1.7 → clamp `[0.70,1.30]` →
  ре-нормировка (24 итер). Симуляция 200 town-week: mean(D)≈1.0 (было ≈1.075), пол 0.70.

### major
- **SQL-6 · `0006_functions.sql:130-142 ledger_write` — нет `on conflict` при идемпотентных выплатах.**
  Есть `uq_ledger_idem`, но `insert` без `on conflict` → повтор `idempotency_key` бросает
  `unique_violation`, аварит всю транзакцию вызывающего джоба (job_coop_deadline/event_settle/
  contest_judge). При двойном прогоне джоба откатывается и уже сделанная работа. **Фикс:**
  `insert … on conflict (idempotency_key) where idempotency_key is not null do nothing returning id`;
  вызывающие трактуют `null v_id` как «уже выплачено».
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `ledger_write` пересоздан с `on conflict (idempotency_key)
  where idempotency_key is not null do nothing returning id` (партиал-uq `uq_ledger_idem`); дубль
  idem-ключа → `v_id=null`, без `unique_violation`.
- **SQL-7 · `0006_functions.sql:462-506 help_neighbor / gift_send` — TOCTOU дневного кэпа.**
  `count(*)` → `insert` без лока и без unique-констрейнта (`gifts(from,to,day)`/`help(actor,target,day)`).
  Пачка параллельных запросов все читают `<3` → превышение анти-смурф/анти-P2W кэпа 3/цель/день;
  та же дыра в free `prize_pull`. **Фикс:** partial UNIQUE-индекс на кэп-ключ **или**
  `pg_advisory_xact_lock(hashtext(actor||':'||target||':'||day))` вокруг count+insert; то же для
  free-pull. *(Слияние rev-sql minor + x-security major → major.)*
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `help_neighbor`/`gift_send` — advisory-lock по ключу
  `actor:target:day`; `prize_pull` — пер-игрок lock перед подсчётом free-pull (кэп по всем сериям,
  pity-row лочит лишь одну серию).
- **SQL-8 · `0006_functions.sql:238-283 craft_start` — гонка слотов машины.**
  `count(active jobs) >= slots` без лока строки машины → два параллельных `craft_start` на 1
  свободный слот оба проходят. **Фикс:** `select slots into v_slots from machines where id=p_machine
  and farm_id=v_farm for update` перед подсчётом.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: в `craft_start` селект `slots` из `machines` получил
  `for update` — лочит строку машины до `count(active jobs)`.
- **SQL-9 · `0012_server_gameplay.sql:554-591 expedition_start` — гонка route-слота.**
  `exists(active in slot)` без unique/лока → два инсерта в один слот, дабл-лут. **Фикс:**
  `create unique index … on expeditions(farm_id,route_slot) where not collected` + insert в
  `begin…exception when unique_violation then raise 'slot_busy' end` (как contest_entries).
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: партиал-uq `uq_expedition_open_slot(farm_id,route_slot)
  where collected=false` + insert обёрнут в `begin…exception when unique_violation → raise 'slot_busy'`.
- **SQL-10 · `0013_server_social.sql:252-312 migration_move` — гонка вместимости города.**
  Проверка `count(players) < capacity` без лока строки `towns` → перебор `town_capacity`.
  **Фикс:** `select capacity,status … from towns where id=p_target_town for update`, пересчёт под
  локом, либо денормализованный `resident_count`.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: в `migration_move` проверка вместимости целевого города
  получила `for update` на строке `towns` — конкурентные переезды сериализуются.

### minor
- **SQL-11 · `0013_server_social.sql:390-433 mentor_invite` — гонка mentee-кэпа.**
  `count(active) < caps.mentor_max_mentees` без лока; параллельные инвайты разным mentee оба
  проходят. **Фикс:** `pg_advisory_xact_lock(hashtext('mentor_invite:'||v_uid))` вокруг count+insert.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: `pg_advisory_xact_lock(hashtextextended('mentor_invite:'
  ||v_uid,0))` перед `count(active mentorships)` — mentee-кэп ментора сериализован.
- **SQL-12 · `0011_server_core.sql:686-768 get_town` — нет композитных индексов.**
  `myContribution` фильтрует `*_contributions` по `(id, player_id)`, а есть только одиночные
  индексы; `get_town` — горячий read на каждый гидрейт. **Фикс:** композитные
  `order_contributions(order_id,player_id)`, `potluck_contributions(potluck_id,player_id)`,
  `town_project_contributions(project_id,player_id)`.
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: заведены `idx_order_contrib_order_player`,
  `idx_potluck_contrib_potluck_player`, `idx_tp_contrib_project_player` (проверено в `pg_indexes`).
- **SQL-13 · `0006_functions.sql:724 (revoke-блок) + gp_farm_ctx` — revoke не снимает PUBLIC.**
  `revoke … from authenticated, anon` не убирает дефолтный грант PUBLIC → anon/authenticated всё
  ещё имеют EXECUTE (проверено на живой БД: ledger_write/inv_add/inv_remove/rollover_open_week/
  claim_*/gp_farm_ctx = true). Сейчас не эксплойтабельно (money-хелперы не SECURITY DEFINER, нет
  INSERT-RLS), но защита иллюзорна. **Фикс:** `revoke execute … from public` (+ anon,
  authenticated) для всех внутренних хелперов и `gp_farm_ctx`; расширить hardening-луп `0014`.
  *(Один кластер с SQL-1/2/3 — сделать одной hardening-миграцией.)*
  **[x] ПРИМЕНЕНО** (0016_hardening) — как: revoke-луп включает `inv_add`/`inv_remove`/`ledger_write`/
  `rollover_open_week`/`claim_idem`/`claim_anchor`/`gp_farm_ctx`/`config_doc` + `alter default
  privileges … revoke execute … from public`; на живой БД все = EXECUTE false (public тоже).

---

## edge/ (supabase/functions)

### critical
- [x] **EDGE-1 · `iap-verify/index.ts:28-32 verifyReceipt` — приём любого `sandbox_*` в проде.**
  Любой receipt на `"sandbox_"` принимается как verified для любого провайдера, без env-гейта →
  authenticated-игрок минтит реальные dimes бесплатно и неограниченно (варьируя receipt обходит
  `(provider, provider_txn_id)` dedup). **Фикс:** гейт за env
  `if (receipt.startsWith("sandbox_") && env("IAP_ALLOW_SANDBOX","false")==="true")`, дефолт off;
  в проде падать в реальную верификацию (сейчас stub `ok:false`).
  ПРИМЕНЕНО: `sandbox_*` теперь за гейтом `(Deno.env.get("IAP_ALLOW_SANDBOX") ?? "false")==="true"`, дефолт off; redeploy iap-verify.

### major
- [x] **EDGE-2 · `iap-verify/index.ts:63-71 (dedup)` — кросс-аккаунт лик.**
  Dedup по `(provider, provider_txn_id)` без `player_id=uid` → зная чужой txn_id, вернёшь чужие
  `purchase_id`/`dimes_granted` (+ оракул перечисления покупок). **Фикс:** `.eq("player_id", uid)`
  в обеих проверках (pre-check и race-recovery); чужой txn под другим player_id — конфликт/ошибка.
  ПРИМЕНЕНО: добавлен `.eq("player_id", uid)` в pre-check и race-recovery; чужой txn под другим uid → not-found → throw; redeploy iap-verify.
- [x] **EDGE-3 · `_shared/response.ts:47-57 failFromError` — утечка сырой ошибки.**
  Немаппленные исключения уходят клиенту как `{code:"server_error", message: raw}` (сырой
  Postgres/PostgREST текст: типы/констрейнты/имена функций). `game/index.ts` форвардит клиентские
  params в RPC → достаточно вызвать type-error, чтобы получить детали схемы. **Фикс:** в catch-all
  логировать raw серверно, клиенту — `fail("server_error","internal error",500)`; KNOWN-ветку
  (осознанные коды) оставить как есть.
  ПРИМЕНЕНО: catch-all теперь `console.error` raw + `fail("server_error","internal error",500)`, KNOWN-ветка без изменений; redeploy game + iap-verify (общий _shared/response.ts).

---

## state/ (src/data каталоги + state-слайсы)

### major
- [x] **STATE-1 · `src/data/catalogs/ingredients.ts` + `recipes.ts` — 14 bridge-полуфабрикатов
  продаются ниже себестоимости входов.** `basePrice` используется универсально как цена продажи
  любого item (нет блокировки для `itemClass:'ingredient'`) → реальная брешь. Примеры:
  `ingr_cheese_curds` вход $3.15 → $1.70 (−46%); `ingr_candied_citrus_peel` вход $211.80 → $115
  (−84%); `ingr_smoked_brisket` вход $164 → $75 (−54%); и т.д. Не ловится `validate.test.ts`
  (маржа проверяется только для `output.itemClass==='dish'`). **Фикс:** поднять `basePrice`
  перечисленных `ingr_*` минимум до суммы `basePrice` их recipe-входов (паттерн уже применён к
  `ingr_flour` $0.35→$0.50) **и** расширить проверку маржи в `validate.test.ts` на
  `itemClass==='ingredient'`.
  ПРИМЕНЕНО: `basePrice` поднят для всех 18 затронутых `ingr_*` (butter/cheese_curds/cream/
  basic_dough/pie_crust_basic/refined_sugar/roasted_coffee/cherry_pie_filling/whipped_cream/
  pumpkin_puree/pecan_praline/pie_crust_deluxe/peach_cobbler_filling/shrimp_bisque_base/
  smoked_brisket/refined_praline_sauce/truffle_butter/candied_citrus_peel/bread/biscuit/roux —
  каждый выше суммы `basePrice` своих recipe-входов, инлайн-коммент `ЦЕНА ПОДНЯТА X→Y (STATE-1)`
  на каждой строке); в `validate.test.ts` добавлен тест «[Recipe] цена продажи полуфабриката
  (itemClass ingredient) превышает сумму basePrice его прямых входов» — 41/41 зелёные.
- [x] **STATE-2 · `src/data/schema.ts (MachineSchema)` + `catalogs/machines.ts` — нет стоимости
  апгрейда станков.** `MachineSchema` без поля цены (в отличие от `BuildingDefSchema.levels[].
  upgradeCostBucks`), хотя `14-economy §4.2` называет апгрейды станков «главным Bucks-синком» и
  даёт `base_cost` (Grill 60/Oven 90/Churn 70/Soda Fountain 35/Ice Cream Maker 75/Coffee
  Percolator 150). Числа не заведены нигде. **Фикс:** добавить поле стоимости
  (`levels:MachineLevelSchema[]` или `baseCost` + кривая ×2.2) и заполнить `machines.ts`
  значениями из §4.2 (остальные станки — диапазон 300–600).
  ПРИМЕНЕНО: `MachineSchema.baseCost: z.number().positive()` (кривая ×2.2/уровень задокументирована
  в схеме); `machines.ts` заполнен — MVP-станки дословно из §4.2 (Grill 60/Oven 90/Churn 70/
  Soda Fountain 35/Ice Cream Maker 75/Coffee Percolator 150), Prep Counter + 4 поздних станка —
  гипотеза 300–600 (нет явного числа в §4.2, помечено инлайн-комментом).

### minor
- [x] **STATE-3 · `src/data/catalogs/recipes.ts` (докстринг ~24-131) — устаревший, вводит в
  заблуждение.** Описывает уже устранённые пробелы (134 `dish_*`, `mch_prep_counter`,
  `ingr_flour` $0.35) как ТЕКУЩИЕ; `validate.test.ts` зелёный. **Фикс:** свернуть разделы 3–5 до
  «см. git-историю ingredients.ts/machines.ts — синхронизировано» или пометить РЕШЕНО.
  ПРИМЕНЕНО: разделы докстринга помечены `[СИНХРОНИЗИРОВАНО — STATE-3]` инлайн, п.5 свёрнут до
  ссылки на git-историю `ingredients.ts`/`machines.ts` вместо описания пробелов как текущих.
- [x] **STATE-4 · `src/state/net.ts` (докстринг) vs `src/state/index.ts` (partialize).**
  Докстринг утверждает «Только queueLen персистится», но `partialize` включает только `ui.*` и
  `scene.active` — `net.queueLen` не персистится. **Фикс:** привести комментарий к факту (очередь
  и так в IndexedDB, ресинк на бутстрапе) — убрать ложное «персистится».
  ПРИМЕНЕНО: докстринг `net.ts` переписан — явно `[STATE-4] слайс НЕ персистится вообще`, ссылка
  на белый список `partialize` (`ui.*`/`scene.active`) и на IndexedDB-очередь как источник истины.

---

## tests/

### major
- **[x] TEST-1 · `src/net/adapters/local.test.ts` + `src/net/local/town.ts:170-177 catchUpRollover`
  — мульти-недельный catch-up не тестируется.** Все тесты двигают часы ровно на 1 неделю; цикл
  `while (weekIndex<targetWeek) resetWeek(...)` (для возврата после 2+ пропущенных недель,
  Vacation до 30 дней) не покрыт. **Фикс:** тест `clock.advance(3*WEEK_MS)` за раз, проверить:
  (a) `weekIndex` +3; (b) `routePass.tier` +3 (кап 100); (c) coop/contests/event принадлежат
  ФИНАЛЬной неделе (seed/deadline); (d) нет остаточных fair-лотов/`personalFp`.
  _Как:_ добавлен `describe('…многонедельный catch-up rollover (TEST-1)')` в `local.test.ts` —
  засевает незакрытый fair-лот + личный вклад ивента на неделе W, `clock.advance(3*WEEK_MS)` разом,
  проверяет (a) `weekIndex+3`, (b) `routePass.tier+3`/`xp=0`, (c) coop/contest/event id и
  seed/deadline привязаны к `calAfter.weekIndex` (финальной неделе, не промежуточным), (d) `fair.lots`
  пуст, `fair.openedAt` не задан, `event.personalFp=0`. Зелёный (уже был закоммичен в c4b7ab3,
  переверено: 31/31 в `local.test.ts`, tsc чист).
- **[x] TEST-2 · `src/net/adapters/local.ts` (processFairSales/fairOpen/fairList) + local.test.ts —
  граница закрытия окна ярмарки не покрыта.** `processFairSales` (`:408-424`) продаёт по
  `openedAt` + прошедшим часам, не проверяя `FAIR_CLOSE_OFFSET`/`isWindowOpen`; `fairOpen`/
  `fairList` (`:854-889`) фазу не смотрят. Промежуток Вс 12:00→23:59 не тестируется. **Фикс:**
  тест: открыть ярмарку, листнуть лот, продвинуть часы за `FAIR_CLOSE_OFFSET` (в `sun_event`) до
  rollover, проверить остановку пассивных продаж / `window_closed` — зафиксировать контракт.
  _Как:_ добавлен `describe('…граница закрытия окна ярмарки (TEST-2)')` — большой сток, `fairOpen`+
  `fairList`, `clock.advance` ровно до `weekStartOfIndex(WEEK)+FAIR_CLOSE_OFFSET`, затем ещё
  `+2*HOUR_MS`: подтверждено (регресс-тест текущего контракта, не баг-фикс) — `processFairSales`
  не смотрит `FAIR_CLOSE_OFFSET`, остаток лота продолжает уменьшаться после закрытия окна вплоть
  до rollover. Код `processFairSales`/`fairOpen`/`fairList` не менялся (TEST-зона фиксирует
  наблюдаемое поведение, а не чинит его — правка поведения не входит в TEST-scope).

### minor
- **[x] TEST-3 · `src/net/adapters/local.test.ts` — граница coop-дедлайна.**
  `now() > deadlineAt` (`local.ts:949`) тестируется только глубоко за дедлайном. **Фикс:** два
  boundary-теста: contribute при `== deadlineAt` (успех, half-open thu_push) и `deadlineAt+1`
  (`window_closed`) — ловит `>` ⇄ `>=`.
  _Как:_ два теста в `describe('…анти-чит валидация')`: `clock.advance(order.deadlineAt-clock.now())`
  → `coopContribute` `ok:true` (граница `==` ещё успех, half-open); `+1мс` → `window_closed`.
  Подтверждает `now() > order.deadlineAt` в `local.ts:963` — именно `>`, не `>=`.
- **[x] TEST-4 · `src/net/adapters/supabase.test.ts` — флейки `tick()` (setTimeout 5ms).**
  Фиксированный 5ms-сон гоняется с fire-and-forget `flush()` из `monitor.onChange`. **Фикс:**
  детерминированно ждать дренаж (await промис `flush()` через `onQueueChange`, либо `vi.waitFor`
  на состояние моков) вместо magic-константы.
  _Как:_ magic `tick()` (`setTimeout(5)`) заменён на `waitFor(assertion)` = `vi.waitFor(assertion,
  {timeout:1000, interval:5})` — поллит наблюдаемый эффект дренажа (`confirms`/`rollbacks`/`calls`)
  вместо фиксированной паузы, в 3 местах офлайн-очереди/реконнекта. Заодно синхронизирован
  `Edge оффлайн` тест на реальную Edge-функцию `iapVerify` (после NET-2 `migrateFarm` стал RPC) —
  оставлено как есть (соседняя NET-зона, тест уже зелёный).

---

## app/ (композиция и разводка core-loop) — согласовать с архитектурой (`App.tsx` — общий файл)

### critical
- [x] **APP-1 · `src/app/PanelHost.tsx` + `src/scene/**` + `src/ui/hud/HudRoot.tsx` — core-loop
  панели смонтированы, но недостижимы.** `openPanel()` зовётся только для `ui_chat`,
  `ui_notif_log`, `ui_recipe_box`, `ui_shift`. Недостижимы: **`ui_demand_board`, `ui_shop`,
  `ui_coop_orders`, `ui_potluck`, `ui_fair_stall`, `ui_appetite_meter`** — при том что FTUE учит
  «читай Demand Board / неси на ярмарку», а Fair Stall/Co-op Orders — главные синки/сорсы
  экономики. Deep-link `?panel=` в проде выключен (`isDebugEnabled()===false`). **Фикс:** реальные
  входные точки — POI/HUD-кнопки, зовущие `openPanel('ui_demand_board' | 'ui_shop' |
  'ui_coop_orders' | 'ui_potluck')`; кликабельный меш прилавка/контест-борда на ярмарке →
  `ui_fair_stall`/`ui_appetite_meter` (паттерн `Buildings.tsx`/`Machines.tsx onClick →
  useFarmActions`). Минимум — HUD-лаунчер «панели» на каждый смонтированный `ui_*`.
  ПРИМЕНЕНО: заведён `src/app/PanelLauncher.tsx` (смонтирован в `App.tsx` под `SystemsProvider`) —
  HUD-кнопка «Панели» раскрывает индекс всех core-панелей (`ui_demand_board`/`ui_recipe_box`/
  `ui_shop`/`ui_coop_orders`/`ui_potluck`/`ui_fair_stall`/`ui_appetite_meter`), каждый пункт →
  `openPanel(key)`; достижимость из прод-UI без dev-`?panel=`. Показан только после FTUE (`phase==='done'`).

### major
- [x] **APP-2 · `src/app/PanelHost.tsx` — meta-панели тоже осиротели.**
  Смонтированы, но никто не зовёт opener: `ui_prize_machine`, `ui_route_pass`, `ui_neon_builder`,
  `ui_toy_shelf`, `ui_ribbon_wall`, `ui_postcards`, `ui_photo_mode`, `ui_mentor`,
  `ui_vacation_toggle`, `ui_pet_card`, `ui_contest_gallery`, `ui_moving_truck`. Меш
  `ui_contest_gallery_board` на ярмарке выглядит как POI, но без `onClick`. **Фикс:** развести
  openers (контест-борд → `ui_contest_gallery`; shop/prize/route-pass POI или HUD;
  diner-фасад → `ui_neon_builder`; collections HUD → toy_shelf/ribbon_wall/postcards/photo_mode;
  coop/pet/mentor/vacation из Town); дать мешу `onClick`.
  ПРИМЕНЕНО: те же `PanelLauncher` секции — блок «Ещё» (`MORE_PANELS`) даёт opener всем мета-панелям
  (`ui_route_pass`/`ui_prize_machine`/`ui_neon_builder`/`ui_toy_shelf`/`ui_ribbon_wall`/`ui_postcards`/
  `ui_photo_mode`/`ui_contest_gallery`/`ui_pet_card`/`ui_mentor`/`ui_vacation_toggle`/`ui_moving_truck`).
  Реализован минимум из плана (HUD-индекс достижимости); контекстные POI/фасады оставлены зонам сцен/ui.
- [x] **APP-3 · `src/App.tsx (Canvas key={active})` — ремаунт Canvas на каждую смену сцены.**
  Каждый свитч Farm/Town/Fair диспозит рендерер и теряет WebGL-контекст («Context Lost»); после
  нескольких свитчей сцена рендерится пустой. Один свитч выживает (e2e проходит), повторная
  навигация — флейк/пустой канвас без восстановления кроме reload. **Фикс:** один персистентный
  `<Canvas>`, свапать только его scene-graph детей (`<ActiveScene active=…/>` внутри стабильного
  Canvas); освобождать GPU анмаунтом внутреннего графа, не рендерера; если нужен `key` — на
  внутреннем `<group>`, не на `<Canvas>`.
  ПРИМЕНЕНО: `<Canvas>` в `App.tsx` больше не ключуется по сцене (рендерер персистентен); `key={active}`
  перенесён на внутренний `<ActiveScene>` под `<Suspense>`/`SceneBoundary` — смена сцены размонтирует
  scene-граф (r3f/drei авто-диспозят GPU-объекты), WebGL-контекст переживает переходы (нет «Context Lost»).

### minor
- [x] **APP-4 · `src/App.tsx (OnboardingHost)` — не передан `personalDay`.**
  Без него пост-FTUE `DailyGoalCard` («next up») не рендерится → выпускник FTUE остаётся без
  направляющей подсказки (усугубляет APP-1). **Фикс:** передать реальный `personalDay` (1..7 из
  clock/progression) в `OnboardingHost`, либо постоянный HUD-хинт daily-goal; парно с APP-1.
  ПРИМЕНЕНО: `App.tsx` читает `personalDay` из `progression.streak.streakDays` (счётчик активных
  дней, ближайший источник 1..7) и прокидывает в `<OnboardingHost personalDay={…}>`; вне 1..7
  `DailyGoalCard` сам вернёт `null`, нет прогрессии → `undefined` (безопасно).

---

## BACKLOG — механики из x-spec-gaps (СЛИШКОМ крупно для фикс-фазы, не фиксы)

Это отсутствующие целиком фичи `08-mail-foraging`, а не правки существующего кода. Требуют
новых панелей/сцен/движковых модулей и продуктового согласования — выносятся из фикс-фазы.

- **BL-1 · Рыбалка-QTE (`08-mail-foraging §3.2.4`).** Нет оверлея `ui_fishing_qte` (Catch Bar,
  3 попытки), ветки fishing в `TownScene`, детерминированной редкости по попаданиям (0→Common /
  1→Good / 2–3→Prime), 2% Legend Fish, бонуса ширины зоны от удочки. Константы
  (`FISHING_ATTEMPTS_PER_CAST`, `LEGEND_FISH_CHANCE`, `FISHING_ROD_ZONE_BONUS`) мёртвые;
  `fishCast()` всегда фикс `crop_catfish/common`. → Новая мини-игра + контракт `fish()`.
- **BL-2 · Каталог почтой: ротация/заказ (`§3.1`).** Нет `ui_mail_catalog`/`ui_mailbox`,
  взаимодействия с ящиком, `rotation.ts` (недельный оффер 12 позиций, anti-repeat, тир-гарантии,
  Last Call), снапшота `getMailCatalog`, недельных лимитов по категории. RPC order/speedup/claim
  мёртвые (никто не зовёт). → Новый движок ротации + панели.
- **BL-3 · Доставка/ускорение почты (`§3.1.3`).** Нет `delivery.ts`: `mailOrder()` хардкодит
  deliverAt=t+8ч для всех (игнор `DELIVERY_DELAY_HOURS_BY_CATEGORY`), `mailSpeedup()` — фикс 5◉
  (игнор «1◉/начатые 4ч, кап 5◉»). *(Меньше BL-2, но зависит от него — потреблять существующие
  константы при реализации каталога.)*
- **BL-4 · Фуражинг: респавн/лимиты/микс точек (`§3.2.2/3.2.3/3.2.6`).** Нет ежедневного
  респавна 06:00 UTC (`FORAGE_RESPAWN_OFFSET_MS`), персональных суточных кэпов по типу точки,
  спека-микса (6 Mushroom/10 Berry/4 Beehive/3 Fishing). `starterForage()` — 6 обобщённых точек
  с одноразовым `remaining=5`, точки исчерпываются навсегда. → Тик мира + счётчики.
