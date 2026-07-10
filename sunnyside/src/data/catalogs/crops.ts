/**
 * data/catalogs/crops.ts — каталог культур грядок (семя → урожай).
 *
 * Источник чисел: `docs/specs/05-ingredients.md` §4.1–4.3 (полный реестр ингредиентов,
 * пройден ревью Фазы B) — строки с источником «Грядка» / «Грядка (сад)» для T1–T3.
 * `docs/specs/02-farm.md` задаёт модель (§3.1–3.6) и иллюстративный пример-подмножество
 * (§4.5, там же явно помечено «иллюстрация, не полный список») — этот каталог берёт
 * полный список из мастер-таблицы 05-ingredients (числа те же, откуда и заимствованы
 * гипотезы 02-farm §4.5: Tomato/Lettuce/Potato/Wheat/Corn/Strawberry/Cherry совпадают).
 *
 * Поля схемы (`CropDefSchema`, `@/data/schema`):
 *  - growSec       — время роста, сек (из колонки «Время произв.» 05-ingredients, мин/ч → сек).
 *  - seedCost      — себестоимость цикла (05-ingredients «Себест., $»); для обычных грядочных
 *                    культур в спеке нет отдельной построчной цены семени (в отличие от
 *                    «Каталог→грядка» позиций вида «семена X + Y/цикл») — берём приведённую
 *                    себестоимость цикла целиком как seedCost, ничего не выдумывая.
 *  - yieldQty      — базовый выход за сбор. Явное число дано спекой только для Cherry
 *                    (02-farm.md §3.5/§4.5: «Вишня ×6 за цикл — референс дека», orchard-батч).
 *                    Для остальных культур явного батч-числа в спеках нет → 1 (полевая грядка,
 *                    один урожай = одна единица предмета, 05-ingredients считает цену за штуку).
 *  - unlockLevel   — не задан: 02-farm.md §8 п.5 отмечает точные пороги открытия культур по
 *                    уровню фермы как ещё не сверенные с 13-progression.md (открытый вопрос),
 *                    поэтому оставляем `undefined` (optional в схеме), а не выдумываем число.
 *
 * Ключи: `seed_<name>` / `crop_<name>` (snake_case, конвенция из `@/types/ingredients.ts`
 * комментария: «crop_tomato, seed_tomato»).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net, только структуры данных + типы `@/data/schema`.
 */

import type { CropDef } from '../schema'

export const crops: CropDef[] = [
  // ── T1 — Garden (Огород), цикл 5–15 мин (05-ingredients.md §4.1) ──────────────
  {
    seedKey: 'seed_tomato',
    cropKey: 'crop_tomato',
    name: { en: 'Tomato', ru: 'Томат' },
    tier: 1,
    growSec: 8 * 60,
    yieldQty: 1,
    seedCost: 0.06,
  },
  {
    seedKey: 'seed_lettuce',
    cropKey: 'crop_lettuce',
    name: { en: 'Lettuce', ru: 'Салат-латук' },
    tier: 1,
    growSec: 6 * 60,
    yieldQty: 1,
    seedCost: 0.05,
  },
  {
    seedKey: 'seed_potato',
    cropKey: 'crop_potato',
    name: { en: 'Potato', ru: 'Картофель' },
    tier: 1,
    growSec: 10 * 60,
    yieldQty: 1,
    seedCost: 0.07,
  },
  {
    seedKey: 'seed_wheat',
    cropKey: 'crop_wheat',
    name: { en: 'Wheat', ru: 'Пшеница' },
    tier: 1,
    growSec: 12 * 60,
    yieldQty: 1,
    seedCost: 0.08,
  },
  {
    seedKey: 'seed_carrot',
    cropKey: 'crop_carrot',
    name: { en: 'Carrot', ru: 'Морковь' },
    tier: 1,
    growSec: 7 * 60,
    yieldQty: 1,
    seedCost: 0.05,
  },
  {
    seedKey: 'seed_cucumber',
    cropKey: 'crop_cucumber',
    name: { en: 'Cucumber', ru: 'Огурец' },
    tier: 1,
    growSec: 6 * 60,
    yieldQty: 1,
    seedCost: 0.05,
  },
  {
    seedKey: 'seed_onion',
    cropKey: 'crop_onion',
    name: { en: 'Onion', ru: 'Лук репчатый' },
    tier: 1,
    growSec: 9 * 60,
    yieldQty: 1,
    seedCost: 0.06,
  },
  {
    seedKey: 'seed_bell_pepper',
    cropKey: 'crop_bell_pepper',
    name: { en: 'Bell Pepper', ru: 'Болгарский перец' },
    tier: 1,
    growSec: 11 * 60,
    yieldQty: 1,
    seedCost: 0.07,
  },
  {
    seedKey: 'seed_green_beans',
    cropKey: 'crop_green_beans',
    name: { en: 'Green Beans', ru: 'Стручковая фасоль' },
    tier: 1,
    growSec: 8 * 60,
    yieldQty: 1,
    seedCost: 0.06,
  },
  {
    seedKey: 'seed_radish',
    cropKey: 'crop_radish',
    name: { en: 'Radish', ru: 'Редис' },
    tier: 1,
    growSec: 5 * 60,
    yieldQty: 1,
    seedCost: 0.04,
  },
  {
    seedKey: 'seed_spinach',
    cropKey: 'crop_spinach',
    name: { en: 'Spinach', ru: 'Шпинат' },
    tier: 1,
    growSec: 6 * 60,
    yieldQty: 1,
    seedCost: 0.05,
  },
  {
    seedKey: 'seed_cabbage',
    cropKey: 'crop_cabbage',
    name: { en: 'Cabbage', ru: 'Капуста' },
    tier: 1,
    growSec: 10 * 60,
    yieldQty: 1,
    seedCost: 0.06,
  },
  {
    seedKey: 'seed_beet',
    cropKey: 'crop_beet',
    name: { en: 'Beet', ru: 'Свёкла' },
    tier: 1,
    growSec: 12 * 60,
    yieldQty: 1,
    seedCost: 0.07,
  },
  {
    seedKey: 'seed_scallion',
    cropKey: 'crop_scallion',
    name: { en: 'Scallion', ru: 'Зелёный лук' },
    tier: 1,
    growSec: 5 * 60,
    yieldQty: 1,
    seedCost: 0.04,
  },
  {
    seedKey: 'seed_basil',
    cropKey: 'crop_basil',
    name: { en: 'Basil', ru: 'Базилик' },
    tier: 1,
    growSec: 6 * 60,
    yieldQty: 1,
    seedCost: 0.05,
  },

  // ── T2 — Farm (Ферма), цикл 30 мин – 2 ч (05-ingredients.md §4.2) ─────────────
  {
    seedKey: 'seed_apple',
    cropKey: 'crop_apple',
    name: { en: 'Apple', ru: 'Яблоко' },
    tier: 2,
    growSec: 45 * 60,
    yieldQty: 1,
    seedCost: 0.35,
  },
  {
    seedKey: 'seed_corn',
    cropKey: 'crop_corn',
    name: { en: 'Corn', ru: 'Кукуруза' },
    tier: 2,
    growSec: 40 * 60,
    yieldQty: 1,
    seedCost: 0.3,
  },
  {
    seedKey: 'seed_strawberry',
    cropKey: 'crop_strawberry',
    name: { en: 'Strawberry', ru: 'Клубника' },
    tier: 2,
    growSec: 35 * 60,
    yieldQty: 1,
    seedCost: 0.32,
  },
  {
    seedKey: 'seed_green_peas',
    cropKey: 'crop_green_peas',
    name: { en: 'Green Peas', ru: 'Зелёный горошек' },
    tier: 2,
    growSec: 30 * 60,
    yieldQty: 1,
    seedCost: 0.25,
  },
  {
    seedKey: 'seed_zucchini',
    cropKey: 'crop_zucchini',
    name: { en: 'Zucchini', ru: 'Кабачок' },
    tier: 2,
    growSec: 50 * 60,
    yieldQty: 1,
    seedCost: 0.3,
  },
  {
    seedKey: 'seed_blueberry',
    cropKey: 'crop_blueberry',
    name: { en: 'Blueberry', ru: 'Черника' },
    tier: 2,
    growSec: 45 * 60,
    yieldQty: 1,
    seedCost: 0.34,
  },
  {
    seedKey: 'seed_raspberry',
    cropKey: 'crop_raspberry',
    name: { en: 'Raspberry', ru: 'Малина' },
    tier: 2,
    growSec: 45 * 60,
    yieldQty: 1,
    seedCost: 0.34,
  },
  {
    seedKey: 'seed_rhubarb',
    cropKey: 'crop_rhubarb',
    name: { en: 'Rhubarb', ru: 'Ревень' },
    tier: 2,
    growSec: 55 * 60,
    yieldQty: 1,
    seedCost: 0.36,
  },
  {
    seedKey: 'seed_watermelon',
    cropKey: 'crop_watermelon',
    name: { en: 'Watermelon', ru: 'Арбуз' },
    tier: 2,
    growSec: 90 * 60,
    yieldQty: 1,
    seedCost: 0.55,
  },
  {
    seedKey: 'seed_asparagus',
    cropKey: 'crop_asparagus',
    name: { en: 'Asparagus', ru: 'Спаржа' },
    tier: 2,
    growSec: 60 * 60,
    yieldQty: 1,
    seedCost: 0.4,
  },
  {
    seedKey: 'seed_sugar_beet',
    cropKey: 'crop_sugar_beet',
    name: { en: 'Sugar Beet', ru: 'Сахарная свёкла' },
    tier: 2,
    growSec: 70 * 60,
    yieldQty: 1,
    seedCost: 0.45,
  },

  // ── T3 — County (Округ), цикл 2–8 ч (05-ingredients.md §4.3) ──────────────────
  // Cherry — единственная культура с явным батч-числом в спеках (02-farm.md §3.5/§4.5:
  // «Вишня ×6 за цикл — референс дека», orchard_plot).
  {
    seedKey: 'seed_cherry',
    cropKey: 'crop_cherry',
    name: { en: 'Cherry', ru: 'Вишня' },
    tier: 3,
    growSec: 3 * 3600,
    yieldQty: 6,
    seedCost: 2.1,
  },
  {
    seedKey: 'seed_pumpkin',
    cropKey: 'crop_pumpkin',
    name: { en: 'Pumpkin', ru: 'Тыква' },
    tier: 3,
    growSec: 4 * 3600,
    yieldQty: 1,
    seedCost: 2.6,
  },
  {
    seedKey: 'seed_butternut_squash',
    cropKey: 'crop_butternut_squash',
    name: { en: 'Butternut Squash', ru: 'Мускатная тыква' },
    tier: 3,
    growSec: Math.round(3.5 * 3600),
    yieldQty: 1,
    seedCost: 2.4,
  },
  {
    seedKey: 'seed_sweet_potato',
    cropKey: 'crop_sweet_potato',
    name: { en: 'Sweet Potato', ru: 'Батат' },
    tier: 3,
    growSec: 3 * 3600,
    yieldQty: 1,
    seedCost: 2.1,
  },
  {
    seedKey: 'seed_snap_peas',
    cropKey: 'crop_snap_peas',
    name: { en: 'Snap Peas', ru: 'Сахарный горошек' },
    tier: 3,
    growSec: 2 * 3600,
    yieldQty: 1,
    seedCost: 1.6,
  },
]
