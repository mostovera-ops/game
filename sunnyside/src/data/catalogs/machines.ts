/**
 * data/catalogs/machines.ts — каталог станков кухни (`bld_kitchen`).
 *
 * Источник: `docs/specs/04-machines.md` §3.2 (список 10 станков: 6 MVP + 4 поздних v0.2/v0.3),
 * §3.3 (слоты очереди: 1 активный + до 3 ожидания на макс. уровне станка = 4 суммарно —
 * значение одинаково для всех станков, не варьируется по типу), §3.4 (апгрейд — 5 уровней
 * на станок, единая рамка для всего реестра).
 *
 * Поля схемы (`MachineSchema`, `@/data/schema`):
 *  - key    — `mch_<name>` (нейминг-кандидат спеки 04-machines.md §3.2, «требует канона» —
 *             используем как рабочий ключ до PR в `00-canon.md §3`, см. AGENTS.md §7).
 *  - post   — все станки живут в постройке Kitchen (§3.1: «Kitchen... даёт слоты под станки»),
 *             ни один станок не привязан к постам Field/Counter/Yard → 'Kitchen' для всех 10.
 *  - slots  — суммарная ёмкость очереди станка (1 активный + 3 ожидания на макс. уровне,
 *             §3.3/§4.3) — 4 для каждого станка; апгрейд лишь открывает эти слоты постепенно
 *             (Ур.2/Ур.4/Ур.5, см. §4.3), само поле описывает конечную ёмкость станка.
 *  - maxLevel — 5 (§3.4: «Апгрейд станка (5 уровней на станок)»).
 *  - baseCost — цена первого апгрейда, $ (STATE-2: `14-economy.md §4.2` — «главный Bucks-синк»,
 *             кривая ×2.2/уровень, `upgrade_cost(L→L+1) = baseCost × 2.2^(L-1)`). Значения MVP
 *             станков — дословно таблица §4.2 «Абсолютные base_cost станков»: Grill 60 / Oven 90 /
 *             Churn 70 / Soda Fountain 35 / Ice Cream Maker 75 / Coffee Percolator 150. Для
 *             станков без явного числа в §4.2 (Prep Counter — MVP, но не в этой таблице; Fryer/
 *             Mill/Smoker/Steam Kettle — «Поздние станки T4–T5») спека даёт только диапазон
 *             «300–600» — числа ниже гипотеза внутри этого диапазона (калибровка — плейтест).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net, только структуры данных + типы `@/data/schema`.
 */

import type { Machine } from '../schema'

const QUEUE_SLOTS_AT_MAX_LEVEL = 4 // 1 активный + 3 ожидания (04-machines.md §3.3/§4.3)
const MACHINE_MAX_LEVEL = 5 // 04-machines.md §3.4

export const machines: Machine[] = [
  // ── MVP (6 станков, доступны с первого релиза фермы-дайнера, §3.2) ────────────
  {
    key: 'mch_grill',
    name: { en: 'Grill', ru: 'Гриль' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 60, // 14-economy.md §4.2 (STATE-2)
  },
  {
    key: 'mch_oven',
    name: { en: 'Oven', ru: 'Печь' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 90, // 14-economy.md §4.2 (STATE-2)
  },
  {
    key: 'mch_churn',
    name: { en: 'Churn', ru: 'Маслобойка' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 70, // 14-economy.md §4.2 (STATE-2)
  },
  {
    key: 'mch_soda_fountain',
    name: { en: 'Soda Fountain', ru: 'Содовый фонтан' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 35, // 14-economy.md §4.2 (STATE-2)
  },
  {
    key: 'mch_ice_cream',
    name: { en: 'Ice Cream Maker', ru: 'Мороженица' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 75, // 14-economy.md §4.2 (STATE-2)
  },
  {
    key: 'mch_coffee',
    name: { en: 'Coffee Percolator', ru: 'Кофемашина' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 150, // 14-economy.md §4.2 (STATE-2)
  },

  {
    // Prep Counter (Стол сборки) — базовый разделочный стол MVP: холодная сборка
    // сэндвичей/морской кухни + полуфабрикаты соленья/коулслоу/коктейльный соус
    // (06-recipes.md §3.1 таблица поста st_prep «4 слота, без нагрева» и §4.1 S4/S5/S6/S14).
    // Нейминг-кандидат 06-recipes.md §8.1/04-machines.md (требует канона) — рабочий ключ
    // до PR в 00-canon.md §3, как и остальные mch_* (AGENTS.md §7). Пост Kitchen (§3.1:
    // все станки живут в bld_kitchen). Открыт с MVP — множество T1 рецептов Prep Counter
    // (Egg Salad, Tomato & Lettuce, Home Lemonade) стартовые/ранние.
    key: 'mch_prep_counter',
    name: { en: 'Prep Counter', ru: 'Стол сборки' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 300, // §4.2 не даёт явного числа для Prep Counter — низ диапазона «300–600» (STATE-2, гипотеза)
  },

  // ── Поздние станки (v0.2/v0.3, открываются с роуд-трипом штатов, §3.2/§3.7) ───
  {
    key: 'mch_fryer',
    name: { en: 'Fryer', ru: 'Фритюрница' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 350, // «Поздние станки T4–T5: 300–600» (14-economy.md §4.2, STATE-2, гипотеза внутри диапазона)
  },
  {
    key: 'mch_mill',
    name: { en: 'Mill', ru: 'Мельница' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 400, // «Поздние станки T4–T5: 300–600» (14-economy.md §4.2, STATE-2, гипотеза внутри диапазона)
  },
  {
    key: 'mch_smoker',
    name: { en: 'Smoker', ru: 'Коптильня' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 500, // «Поздние станки T4–T5: 300–600» (14-economy.md §4.2, STATE-2, гипотеза внутри диапазона)
  },
  {
    key: 'mch_steam_kettle',
    name: { en: 'Steam Kettle', ru: 'Паровой чан' },
    post: 'Kitchen',
    slots: QUEUE_SLOTS_AT_MAX_LEVEL,
    maxLevel: MACHINE_MAX_LEVEL,
    baseCost: 600, // «Поздние станки T4–T5: 300–600» (14-economy.md §4.2, STATE-2, гипотеза внутри диапазона)
  },
]
