/**
 * data/catalogs/buildings.ts — контент-каталог 9 построек, уровни 1–10 (канон §3.8,
 * `docs/specs/13-progression.md §3.3`, рамка «1–10 — мастер» закрыта DECISIONS-B K4).
 *
 * Владелец: staff-knowhow-buildings контент-агент (см. AGENTS.md §2 — карта владения).
 * Схема — `BuildingDefSchema` (`../schema.ts`; `superRefine` требует ровно
 * `maxLevel` записей, покрывающих 1..maxLevel без пропусков), проверяется
 * `../validate.test.ts`.
 *
 * ГРАНИЦА: ноль three/scene/net — чистые данные (AGENTS.md §3).
 *
 * Числа — ИЗ СПЕКИ (13-progression.md §4.4), все помечены там как (гипотеза)
 * до калибровки в `14-economy.md`:
 *  - Формула цены: `Cost(L) = round(500 × 2.2^(L−2), −2)` для House (`k_bld=1.0`,
 *    §4.4 даёт готовую таблицу L2..L10: 500/1100/2400/5300/11700/25800/56700/
 *    124700/274400). Для прочих построек — та же база × `k_bld`, округлено до
 *    сотни: House ×1.0 · Diner/Kitchen ×0.8 · Garage ×0.7 · Barn ×0.6 · Silo ×0.4
 *    (веса даны явно в §4.4). Уровень 1 — стартовый/бесплатный (0/0).
 *  - Время стройки по уровню — единая шкала §4.4 (гипотеза, не различается по
 *    зданию в спеке): 5м/20м/1ч/3ч/8ч/14ч/24ч/36ч/48ч → секунды ниже.
 *  - Стройматериал с Ур.4 (доски/кирпич, §4.4) — вне `BuildingDefSchema` (поле
 *    не предусмотрено контрактом каталога; система построек считает его сама).
 *  - Тексты «что открывает уровень» — из §3.3.1 (House, все 10 уровней даны
 *    явно) и §3.3.2 (сводная таблица прочих построек — даёт ТОЛЬКО Ур.1/4/7/10;
 *    промежуточные уровни (2,3,5,6,8,9) намеренно оставлены без `effect`
 *    (поле опционально в схеме) — придумывать недостающий текст не стали
 *    (инструкция «цифры из спек, не выдумывай»).
 *  - `bld_coop`/`bld_icehouse`/`bld_apiary` — в 13-progression.md явно ВНЕ
 *    СКОУПА («упомянуты только как потребители эффектов»; детальные уровни —
 *    `03-animals.md`/`02-farm.md`, не в списке файлов, разрешённых для этого
 *    задания). Для них здесь взята ТОЛЬКО общая рамка стоимости/времени
 *    (§4.4, применимая «для любой постройки» по тексту спеки) и вес Farm Value
 *    §3.4.1 (Coop 50, Icehouse 40 — там же), давший `k_bld=0.4` (та же ступень,
 *    что и Silo, вес которого тоже 40 → `k_bld=0.4`). Вес Apiary в §3.4.1
 *    ОТСУТСТВУЕТ (список даёт веса только для 8 из 9 построек) — для Apiary
 *    `k_bld=0.4` взят по аналогии с Coop/Icehouse (девятая, «младшая» по вкладу
 *    постройка); это ЭКСТРАПОЛЯЦИЯ автора каталога, не число из спеки, и
 *    подлежит уточнению в `14-economy.md`/PR к канону, если потребуется вес
 *    Apiary в Farm Value. Effect-текст для этих трёх построек дан только для
 *    Ур.1 (базовая функция здания из канона §3.8), 2–10 — без `effect`.
 */

import type { BuildingDef, BuildingLevelSchema } from '../schema'
import type { z } from 'zod'

type BuildingLevel = z.infer<typeof BuildingLevelSchema>

/** Время стройки по уровню (§4.4, единая гипотеза-шкала), секунды. Индекс 0 = Ур.2. */
const BUILD_SEC_BY_LEVEL: readonly number[] = [
  300, // →2, 5 мин
  1200, // →3, 20 мин
  3600, // →4, 1 ч
  10800, // →5, 3 ч
  28800, // →6, 8 ч
  50400, // →7, 14 ч
  86400, // →8, 24 ч
  129600, // →9, 36 ч
  172800, // →10, 48 ч
]

/** Базовая (House ×1.0) стоимость апгрейда по уровню (§4.4). Индекс 0 = Ур.2. */
const HOUSE_BASE_COST_BY_LEVEL: readonly number[] = [
  500, 1100, 2400, 5300, 11700, 25800, 56700, 124700, 274400,
]

/** round(x, -2) — округление до сотни (§4.4 «round(…, −2)»). */
function roundToHundred(x: number): number {
  return Math.round(x / 100) * 100
}

/** Индексация массива фиксированной длины с проверкой границ (noUncheckedIndexedAccess). */
function at(arr: readonly number[], idx: number): number {
  const v = arr[idx]
  if (v === undefined) {
    throw new Error(`at: индекс ${idx} вне диапазона (длина массива ${arr.length})`)
  }
  return v
}

/** Строит levels[1..10] для постройки с данным множителем k_bld и опциональными эффектами по уровню. */
function buildLevels(kBld: number, effects: Partial<Record<number, { en: string; ru: string }>>): BuildingLevel[] {
  const levels: BuildingLevel[] = [
    { level: 1, upgradeCostBucks: 0, upgradeSec: 0, ...(effects[1] ? { effect: effects[1] } : {}) },
  ]
  for (let level = 2; level <= 10; level++) {
    const idx = level - 2
    const baseCost = at(HOUSE_BASE_COST_BY_LEVEL, idx)
    const cost = kBld === 1 ? baseCost : roundToHundred(baseCost * kBld)
    const effect = effects[level]
    levels.push({
      level,
      upgradeCostBucks: cost,
      upgradeSec: at(BUILD_SEC_BY_LEVEL, idx),
      ...(effect ? { effect } : {}),
    })
  }
  return levels
}

export const buildings: BuildingDef[] = [
  // ── House (мастер-здание, k_bld = 1.0) — все 10 уровней даны явно §3.3.1 ──
  {
    key: 'bld_house',
    name: { en: 'House', ru: 'Дом' },
    maxLevel: 10,
    levels: buildLevels(1, {
      1: { en: 'start: basic farm, 1 slot per post, 6 plots, Farm Level 1', ru: 'старт: базовая ферма, 1 слот на пост, 6 грядок, Farm Level 1' },
      2: { en: '+1 plot row; Barn cap ≤2; Field-staff hire gate lifted', ru: '+ряд грядок; Barn Ур.≤2; найм-гейт снят для Field-стаффа' },
      3: { en: 'Dairy Cow (via Barn); +Know-How preview slot; Kitchen cap ≤3', ru: 'Dairy Cow (через Barn); +слот Know-How-предпросмотра; Kitchen Ур.≤3' },
      4: { en: 'lifts max_level≤4 gate → anchor buildings grant 2nd post slot at Lv4; Diner cap ≤4', ru: 'снимает гейт max_level≤4 → якорные постройки дают 2-й слот поста; Diner Ур.≤4' },
      5: { en: 'Ada hireable; +2 plot rows; Garage cap ≤5', ru: 'Ada доступна к найму; +2 ряда грядок; Garage Ур.≤5' },
      6: { en: 'Bee/Apiary gate; Silo cap ≤6', ru: 'Bee/Apiary-гейт; Silo Ур.≤6' },
      7: { en: 'far expeditions (T4 states); all buildings cap ≤7', ru: 'дальние экспедиции (T4-штаты); все постройки Ур.≤7' },
      8: { en: 'Vernon hireable; lifts max_level≤8 gate → 3rd post slot at Lv8; buildings cap ≤8', ru: 'Vernon доступен; снимает гейт max_level≤8 → 3-й слот поста; постройки Ур.≤8' },
      9: { en: 'T5 content gate (Legends); buildings cap ≤9', ru: 'T5-контент-гейт (Legends); постройки Ур.≤9' },
      10: { en: 'Clara gate lifted; max level for all buildings (Lv10); "County Landmark" Farm Value potential', ru: 'Clara-гейт снят; макс. уровни всех построек (Ур.10); «County Landmark»-потенциал Farm Value' },
    }),
  },

  // ── Kitchen (k_bld = 0.8) — сводка §3.3.2: только Ур.1/4/7/10 ─────────────
  {
    key: 'bld_kitchen',
    name: { en: 'Kitchen', ru: 'Кухня' },
    maxLevel: 10,
    levels: buildLevels(0.8, {
      1: { en: '1 machine slot, basic recipes', ru: '1 слот станка, базовые рецепты' },
      4: { en: '2 Kitchen staff slots, +1 machine', ru: '2 слота стаффа Kitchen, +1 станок' },
      7: { en: '+1 machine, T4 recipes', ru: '+1 станок, T4-рецепты' },
      10: { en: '3 staff slots, all machines, T5 recipes', ru: '3 слота стаффа, все станки, T5-рецепты' },
    }),
  },

  // ── Diner (k_bld = 0.8) ────────────────────────────────────────────────────
  {
    key: 'bld_diner',
    name: { en: 'Diner', ru: 'Дайнер' },
    maxLevel: 10,
    levels: buildLevels(0.8, {
      1: { en: 'counter, basic guests, tips', ru: 'прилавок, базовые гости, чаевые' },
      4: { en: '2 Counter slots, +queue', ru: '2 слота Counter, +очередь' },
      7: { en: '+VIP guests, Regulars\' Club bonus', ru: '+VIP-гости, Regulars\' Club-бонус' },
      10: { en: '3 Counter slots, max throughput, special service', ru: '3 слота Counter, макс. поток, спец-подача' },
    }),
  },

  // ── Garage (k_bld = 0.7) ───────────────────────────────────────────────────
  {
    key: 'bld_garage',
    name: { en: 'Garage', ru: 'Гараж' },
    maxLevel: 10,
    levels: buildLevels(0.7, {
      1: { en: '1 truck, 1 expedition route', ru: '1 грузовик, 1 маршрут экспедиции' },
      4: { en: '2 Yard slots, +1 route', ru: '2 слота Yard, +1 маршрут' },
      7: { en: '+far routes, truck skin slot', ru: '+дальние маршруты, скин-слот грузовика' },
      10: { en: '3 Yard slots, max routes, T5 expeditions', ru: '3 слота Yard, макс. маршруты, T5-экспедиции' },
    }),
  },

  // ── Barn (k_bld = 0.6) ─────────────────────────────────────────────────────
  {
    key: 'bld_barn',
    name: { en: 'Barn', ru: 'Амбар' },
    maxLevel: 10,
    levels: buildLevels(0.6, {
      1: { en: '3 animal slots (Cow/Pig/Goat pool)', ru: '3 слота животных (Cow/Pig/Goat пул)' },
      4: { en: '+slots, Good quality', ru: '+слоты, качество Good' },
      7: { en: '+slots, Prime quality', ru: '+слоты, качество Prime' },
      10: { en: 'max slots, Blue Ribbon quality', ru: 'макс. слоты, качество Blue Ribbon' },
    }),
  },

  // ── Silo (k_bld = 0.4) ─────────────────────────────────────────────────────
  {
    key: 'bld_silo',
    name: { en: 'Silo', ru: 'Силос' },
    maxLevel: 10,
    levels: buildLevels(0.4, {
      1: { en: 'basic grain/feed storage limit', ru: 'базовый лимит зерна/корма' },
      4: { en: '+50% limit', ru: '+50% лимит' },
      7: { en: '+150% limit', ru: '+150% лимит' },
      10: { en: '+300% limit (stacks with kh_commerce Grain Bins)', ru: '+300% лимит (стек с kh_commerce Grain Bins)' },
    }),
  },

  // ── Coop / Icehouse / Apiary — вне скоупа 13-progression (детали в
  //    03-animals.md/02-farm.md); здесь только общая рамка §4.4 (k_bld=0.4,
  //    см. шапку файла) и базовая функция Ур.1 из канона §3.8. ────────────────
  {
    key: 'bld_coop',
    name: { en: 'Coop', ru: 'Курятник' },
    maxLevel: 10,
    levels: buildLevels(0.4, {
      1: { en: 'housing for hens/turkeys (capacity/quality — 03-animals.md)', ru: 'жильё для кур/индеек (вместимость и качество продукта — 03-animals.md)' },
    }),
  },
  {
    key: 'bld_icehouse',
    name: { en: 'Icehouse', ru: 'Ледник' },
    maxLevel: 10,
    levels: buildLevels(0.4, {
      1: { en: 'storage limit for perishables (milk, berries, greens, eggs, meat)', ru: 'лимит хранения скоропортящихся продуктов (молоко, ягоды, зелень, яйца, мясо)' },
    }),
  },
  {
    key: 'bld_apiary',
    name: { en: 'Apiary', ru: 'Пасека' },
    maxLevel: 10,
    levels: buildLevels(0.4, {
      1: { en: 'hives / honey / wax — 9th building (00-canon.md §3.8); unlocks at House Lv6', ru: 'ульи/мёд/воск — 9-я постройка (00-canon.md §3.8); открывается на House Ур.6' },
    }),
  },
]
