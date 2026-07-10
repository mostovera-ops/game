/**
 * catalogs/dailySpecials.ts — пул шаблонов Daily Specials (`ui_daily_specials`,
 * Шериф Рой, `npc_sheriff_roy`).
 *
 * Источник: `docs/specs/16-retention.md` §3.2 (таблица 38 шаблонов, дословные
 * EN-ключи `tpl_*` и RU-описания задач) + §3.1 (правила скейлинга/фокуса) +
 * §4.1 (модель награды — **per-day**, не per-template).
 *
 *  - `key` — контракт `DailySpecialTemplateSchema` (`data/schema.ts`) требует
 *    закрытый паттерн `^dsp_[a-z0-9_]+$`, тогда как спека 16-retention §3.2
 *    называет EN-ключи `tpl_*` (`tpl_harvest_t1`, ...). Схема — «стабильная»
 *    зона владения архитектуры (AGENTS.md §2), не правим её мимоходом из
 *    контент-каталога; вместо этого используем ключи `dsp_<тот же суффикс>`
 *    (напр. `tpl_harvest_t1` → `dsp_harvest_t1`) — только префикс приведён к
 *    контракту схемы, семантика/суффикс — дословно из §3.2. Если/когда паттерн
 *    схемы согласуют на `tpl_`, здесь достаточно переименовать префикс назад.
 *  - `category` — фокус-категория из §3.2 (Field/Kitchen/Counter/Yard × 8 +
 *    Community × 6 = 38). Совпадает с постом стаффа/веткой know-how (канон
 *    §3.2, §3.9), кроме `Community`, которая кросс-категорийна.
 *  - `targetQty` — число единиц из RU-описания задачи (§3.2), т.е. дословно
 *    из спеки (напр. «Собери 5× любой T1-урожай» → 5), не выдумано.
 *  - `recipePoolKeys` — намеренно ОПУЩЕНО у всех записей: каталог `recipes.ts`
 *    ещё не написан (см. `data/schema.ts` `CONTENT_CATALOGS`, ссылочная
 *    проверка `[DailySpecialTemplate→Recipe]` в `validate.test.ts` скипается,
 *    пока файла нет), а поле опционально и по контракту схемы «пусто = любой
 *    рецепт категории» (`DailySpecialTemplateSchema` в `data/schema.ts`) —
 *    это корректное значение, не заглушка. Когда рецепты появятся, шаблоны
 *    Kitchen (`tpl_cook_t1`/`tpl_cook_t2`/`tpl_cook_t3`/`tpl_blue_plate`/...)
 *    можно будет сузить до конкретных пулов рецептов их тира.
 *  - `rewardHint` — по §4.1 награда считается **за итог дня** (2/3 или 3/3
 *    выполненных задач), не по отдельному шаблону: одна и та же формула
 *    применима ко всем 38 записям, поэтому `rewardHint` везде — краткая
 *    отсылка к этой per-day модели (дословные числа §4.1: `$15–120` по тиру
 *    задачи, `+$40` бонус дня при 2/3 или 3/3, `🎟` шанс/гарант — см. §4.1).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net, только структуры данных +
 * типы `@/data/schema`. Владелец — контент-агент pass-specials.
 */

import type { DailySpecialTemplate } from '../schema'

/** 16-retention.md §4.1: награда считается за итог дня, одинаково для всех шаблонов. */
const REWARD_HINT_PER_DAY =
  '$ по шкале задачи (15–120 по тиру, гипотеза) за выполнение; +$40 разово и +1 к streak_days ' +
  'при 2/3 или 3/3 задач дня (шанс 20% на 🎟 1 при 2/3, гарантированный 🎟 1 при 3/3) — 16-retention.md §4.1'

export const dailySpecialTemplates: DailySpecialTemplate[] = [
  // ── Field (8) ────────────────────────────────────────────────────────────
  {
    key: 'dsp_harvest_t1',
    category: 'Field',
    name: { en: 'Harvest T1 crop', ru: 'Собери T1-урожай' },
    targetQty: 5,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_harvest_t2',
    category: 'Field',
    name: { en: 'Harvest T2 crop', ru: 'Собери T2-урожай' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_plant_beds',
    category: 'Field',
    name: { en: 'Replant beds', ru: 'Пересади грядки' },
    targetQty: 4,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_feed_animals',
    category: 'Field',
    name: { en: 'Feed all animals', ru: 'Покорми всех животных' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_collect_eggs_milk',
    category: 'Field',
    name: { en: 'Collect eggs/milk', ru: 'Собери яйца/молоко' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_water_streak',
    category: 'Field',
    name: { en: 'Water beds by hand', ru: 'Полей грядки вручную' },
    targetQty: 6,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_upgrade_plot',
    category: 'Field',
    name: { en: 'Upgrade a plot/pen', ru: 'Улучши грядку/загон' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_forage_run',
    category: 'Field',
    name: { en: 'Foraging finds', ru: 'Собери находки на карте фуражинга' },
    targetQty: 2,
    rewardHint: REWARD_HINT_PER_DAY,
  },

  // ── Kitchen (8) ──────────────────────────────────────────────────────────
  {
    key: 'dsp_cook_t1',
    category: 'Kitchen',
    name: { en: 'Cook T1 dish', ru: 'Приготовь блюдо T1' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_cook_t2',
    category: 'Kitchen',
    name: { en: 'Cook T2 dish', ru: 'Приготовь блюдо T2' },
    targetQty: 2,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_cook_t3',
    category: 'Kitchen',
    name: { en: 'Cook T3 dish', ru: 'Приготовь блюдо T3' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_bake_focus',
    category: 'Kitchen',
    name: { en: 'Bake (any tier)', ru: 'Приготовь выпечку (любой тир)' },
    targetQty: 2,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_grill_focus',
    category: 'Kitchen',
    name: { en: 'Grill dish', ru: 'Приготовь гриль-блюдо' },
    targetQty: 2,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_blue_plate',
    category: 'Kitchen',
    name: { en: 'Blue Plate Special', ru: 'Собери Blue Plate Special' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_mastery_tick',
    category: 'Kitchen',
    name: { en: 'Mastery star tick', ru: 'Заверши рецепт до следующей ★Mastery' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_recipe_new',
    category: 'Kitchen',
    name: { en: 'Try a new recipe', ru: 'Разблокируй/попробуй новый рецепт' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },

  // ── Counter (8) ──────────────────────────────────────────────────────────
  {
    key: 'dsp_serve_guests',
    category: 'Counter',
    name: { en: 'Serve guests', ru: 'Обслужи гостей на прилавке' },
    targetQty: 5,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_sell_stock',
    category: 'Counter',
    name: { en: 'Sell stock items', ru: 'Продай позиции стока' },
    targetQty: 10,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_tips_target',
    category: 'Counter',
    name: { en: 'Tip jar target', ru: 'Собери 🍒 чаевых за смену' },
    targetQty: 50,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_price_tune',
    category: 'Counter',
    name: { en: 'Tune counter prices', ru: 'Настрой цену на позициях прилавка' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_combo_serve',
    category: 'Counter',
    name: { en: 'Assemble a combo tray', ru: 'Собери комбо-поднос (сет)' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_restock_counter',
    category: 'Counter',
    name: { en: 'Restock the display', ru: 'Пополни витрину прилавка за смену' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_upsell_combo',
    category: 'Counter',
    name: { en: 'Offer combo upsell', ru: 'Предложи апсейл-комбо гостям' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_zero_waste_shift',
    category: 'Counter',
    name: { en: 'Zero-waste shift', ru: 'Заверши смену без просрочки/списания стока' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },

  // ── Yard (8) ─────────────────────────────────────────────────────────────
  {
    key: 'dsp_expedition_send',
    category: 'Yard',
    name: { en: 'Send an expedition', ru: 'Отправь грузовик в экспедицию' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_expedition_collect',
    category: 'Yard',
    name: { en: 'Collect expedition cargo', ru: 'Забери груз из вернувшейся экспедиции' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_catalog_order',
    category: 'Yard',
    name: { en: 'Mail catalog order', ru: 'Сделай заказ по каталогу почтой' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_build_progress',
    category: 'Yard',
    name: { en: 'Progress a build/upgrade', ru: 'Продвинь стройку/апгрейд' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_staff_assign',
    category: 'Yard',
    name: { en: 'Assign staff post', ru: 'Назначь/смени пост стаффа' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_route_pass_claim',
    category: 'Yard',
    name: { en: 'Claim a Route Pass level', ru: 'Забери доступный уровень Route Pass' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_garage_tidy',
    category: 'Yard',
    name: { en: 'Tidy the garage', ru: 'Разложи/организуй предметы в гараже' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_apiary_check',
    category: 'Yard',
    name: { en: 'Check the apiary', ru: 'Собери мёд/воск с пасеки (Apiary)' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },

  // ── Community (6) — кросс-категория, может дублироваться до 1 раза/день ───
  {
    key: 'dsp_help_neighbor',
    category: 'Community',
    name: { en: 'Help neighbors', ru: 'Помоги соседям по стриту' },
    targetQty: 3,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_coop_contribute',
    category: 'Community',
    name: { en: 'Contribute to Co-op Orders', ru: 'Внеси вклад в Co-op Orders' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_potluck_give',
    category: 'Community',
    name: { en: 'Give to Street Potluck', ru: 'Положи блюдо в Street Potluck' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_gift_send',
    category: 'Community',
    name: { en: 'Send a gift', ru: 'Отправь подарок другу' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_visit_streets',
    category: 'Community',
    name: { en: 'Visit street farms', ru: 'Загляни на фермы стрита' },
    targetQty: 2,
    rewardHint: REWARD_HINT_PER_DAY,
  },
  {
    key: 'dsp_demand_fulfill',
    category: 'Community',
    name: { en: 'Fulfill Demand Board item', ru: 'Продай позицию из Demand Board недели' },
    targetQty: 1,
    rewardHint: REWARD_HINT_PER_DAY,
  },
]
