/**
 * ingredients.ts — продукты, ингредиенты, инвентарь, хранение (05-ingredients).
 * Продукт = всё, что лежит на складе: семена, сырьё, готовые блюда, декор, инструменты.
 */

import type { Tier, Quality } from './common'

/**
 * Ключ продукта — каноничный английский snake_case (напр. `crop_tomato`, `prod_butter`,
 * `seed_tomato`, `dish_salad`). Конкретный реестр ведётся в 05-ingredients/06-recipes.
 */
export type ProductKey = string

/** Класс предмета — определяет склад/лимиты (silo/icehouse) и UI-фильтр. */
export type ItemClass =
  | 'seed' // семена (посадка)
  | 'crop' // урожай грядки (сырьё T1)
  | 'animal_product' // молоко, яйца, мёд, воск...
  | 'ingredient' // промежуточный крафт (масло, сыр, тесто...)
  | 'dish' // готовое блюдо (продаётся/подаётся)
  | 'feed' // корм животным
  | 'material' // строительные/крафт-материалы
  | 'decor' // декор фермы (вклад в Farm Value)
  | 'tool' // инструменты (каталог)
  | 'special' // ивентовые/секретные

/** Куда кладётся стек (лимиты хранилищ, canon §3.8: silo/icehouse). */
export type StorageKind = 'silo' | 'icehouse' | 'general'

/** Определение продукта (из конфига/каталога, read-only на клиенте). */
export interface ProductDef {
  key: ProductKey
  itemClass: ItemClass
  tier: Tier
  storage: StorageKind
  /** Базовая цена продажи NPC-рынку, $ (мастер — 14-economy). */
  basePrice: number
  /** Категория спроса (Demand Board), см. economy.ts. */
  demandCategory?: string
  /** Ассет-ключ для рендера (21-client §3.7 registry). */
  assetKey?: string
}

/** Один стек на складе. Unique (farm_id, item_key, quality) — 20-backend §4.1. */
export interface InventoryItem {
  key: ProductKey
  qty: number
  quality: Quality
  itemClass: ItemClass
}

/** Лимиты хранилищ (расширяются постройками Silo/Icehouse, town Water Tower). */
export interface StorageLimits {
  silo: number
  icehouse: number
  general: number
}

/** Инвентарь фермы (inventory-слайс). Кэш; истина серверная. */
export interface InventorySnapshot {
  /** Плоская запись itemKey → суммарное qty (быстрый доступ для UI/рецептов). */
  items: Record<ProductKey, number>
  /** Детализированные стеки по качеству (для витрины/ярмарки). */
  stacks: InventoryItem[]
  limits: StorageLimits
}
