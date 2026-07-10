/**
 * ui/shift/pool.ts — пул готовых блюд для смены (09-fair §3.5 «заказы из реального стока»).
 *
 * Смена обслуживает ТОЛЬКО те блюда, что есть у игрока (F2-гейт входа). Тир блюда нужен
 * движку скоринга (`engine/fair`) — здесь мост `dish_* → tier` для набора канон-блюд MVP.
 * До гидрации бэкенда/каталога рецептов используем демо-пул (сцена играбельна в dev);
 * при наличии стока фильтруем демо-пул по тому, что реально лежит на складе.
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ — DOM-слой, ноль three/net. Тир/каталог — данные, не расчёт:
 * скоринг живёт в `engine/fair`, здесь только описание блюда для показа и ключ+тир для движка.
 *
 * TODO(architecture): заменить статический DISH_TIERS на маппинг из `@/data/catalogs/recipes`
 * (output.key → tier), когда каталог dish_* стабилизируется (recipes.ts §4.2).
 */

import type { Tier } from '@/types/common'
import type { ProductKey } from '@/types/ingredients'
import type { InventorySnapshot } from '@/types'

/** Описание готового блюда для UI смены (иконка-заглушка = эмодзи, цвет-чип = канон-палитра). */
export interface DishDef {
  key: ProductKey
  tier: Tier
  /** RU-подпись (canon §5 — UI-строки локализуемы; дефолт ru). */
  label: string
  /** Плейсхолдер-«спрайт» блюда (эмодзи) до финальных иконок (22-audio-visual fair_tray). */
  emoji: string
  /** Цвет-чип (canon-палитра, hex как в public/palette.json). */
  color: string
  /** Mastery ★ (0..5) — влияет на Q_quality в скоринге (engine/fair §4.4). */
  stars: number
}

/**
 * Демо-пул канон-блюд (реальные `dish_*` ключи из data/catalogs/recipes.ts, тиры оттуда).
 * Разнотирный, чтобы очередь движка (`generateQueue`) давала осмысленные заказы 1–3 блюд.
 */
export const DEMO_DISH_POOL: readonly DishDef[] = [
  { key: 'dish_home_lemonade', tier: 1, label: 'Лимонад', emoji: '🍋', color: '#f9dd76', stars: 1 },
  { key: 'dish_toast', tier: 1, label: 'Тост', emoji: '🍞', color: '#edad59', stars: 0 },
  { key: 'dish_sugar_cookie', tier: 1, label: 'Печенье', emoji: '🍪', color: '#c47669', stars: 2 },
  { key: 'dish_buttermilk_pancakes', tier: 2, label: 'Панкейки', emoji: '🥞', color: '#e6c667', stars: 2 },
  { key: 'dish_bacon_grilled_cheese', tier: 2, label: 'Грил-чиз', emoji: '🧀', color: '#f8ee66', stars: 3 },
  { key: 'dish_apple_pie', tier: 2, label: 'Яблочный пирог', emoji: '🥧', color: '#e75950', stars: 3 },
  { key: 'dish_cherry_pie', tier: 3, label: 'Вишнёвый пирог', emoji: '🍒', color: '#e2523b', stars: 4 },
  { key: 'dish_sunrise_skillet', tier: 3, label: 'Скиллет', emoji: '🍳', color: '#f9779f', stars: 3 },
  { key: 'dish_maple_waffles', tier: 4, label: 'Кленовые вафли', emoji: '🧇', color: '#896950', stars: 4 },
] as const

/**
 * Пул смены из инвентаря: демо-блюда, которых у игрока qty>0 на складе. Пустой сток в dev
 * (инвентарь не гидрирован) → возвращаем весь демо-пул, чтобы смена оставалась играбельной.
 * При реальном стоке узкий ассортимент допустим — заказы движка повторяются (F3, проходимо).
 */
export function poolFromInventory(inventory: InventorySnapshot | null): DishDef[] {
  if (!inventory) return [...DEMO_DISH_POOL]
  const owned = DEMO_DISH_POOL.filter((d) => (inventory.items[d.key] ?? 0) > 0)
  return owned.length > 0 ? owned : [...DEMO_DISH_POOL]
}

/** Найти описание блюда по ключу (для показа заказа/подноса). */
export function dishByKey(pool: readonly DishDef[], key: ProductKey): DishDef | undefined {
  return pool.find((d) => d.key === key)
}

/** Первое блюдо пула нужного тира (для показа требуемого блюда мульти-заказа по тиру). */
export function dishByTier(pool: readonly DishDef[], tier: number): DishDef | undefined {
  return pool.find((d) => d.tier === tier)
}
