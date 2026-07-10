/**
 * recipes.ts — рецепты, mastery, спецблюда, Blue Plate (06-recipes, canon §3.13).
 * Рецепты открываются: база (по уровню/штатам) + секретки (эксперименты) — D8.
 */

import type { ProductKey, ItemClass } from './ingredients'
import type { Tier, Quality } from './common'

export type RecipeKey = string

/** Один вход рецепта. */
export interface RecipeInput {
  key: ProductKey
  qty: number
}

/** Определение рецепта (конфиг, read-only). */
export interface RecipeDef {
  key: RecipeKey
  tier: Tier
  /** Станок, на котором готовится (machines.ts). */
  machineKey: string
  inputs: RecipeInput[]
  output: { key: ProductKey; qty: number; itemClass: ItemClass }
  /** Базовое время цикла, сек (модифицируется стаффом/know-how, мастер — 14-economy). */
  baseCraftSec: number
  /** Как открыт: по уровню фермы, по штату экспедиции, или секретка. */
  unlock: RecipeUnlock
}

export type RecipeUnlock =
  | { kind: 'level'; farmLevel: number }
  | { kind: 'state'; stateKey: string } // st_* (expeditions.ts)
  | { kind: 'experiment' } // Mystery Plate (D8, recipe_experiment)
  | { kind: 'starter' } // доступен с начала

/**
 * Mastery ★ (mech_mastery): гринд рецепта — −время, +качество, +цена (НЕ тираж).
 * Серверный инкремент при craft_collect.
 */
export interface RecipeMastery {
  recipeKey: RecipeKey
  stars: number // 0..N
  progress: number // прогресс до следующей звезды
  qualityBonus: Quality | 0
}

/**
 * Daily Specials (mech_daily_special): ротация 3 фокус-задач дня (аналог Arms Race).
 * Выдаёт Sheriff Roy. ≥2/3 за игровой день держит стрик (streak_check).
 */
export interface DailySpecial {
  id: string
  recipeKey: RecipeKey
  targetQty: number
  doneQty: number
  rewardHint: string
}

/**
 * Blue Plate Special (mech_blue_plate): блюдо+гарнир+напиток = сет с бонусом к цене.
 */
export interface BluePlate {
  main: RecipeKey
  side: RecipeKey
  drink: RecipeKey
  priceBonusPct: number
}
