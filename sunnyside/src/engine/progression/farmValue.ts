/**
 * engine/progression/farmValue.ts — МАСТЕР-формула Farm Value (13-progression §3.4.1/§4.5).
 *
 * Единый агрегат «мощи» фермы (canon §3.13, mech_farm_value): взвешенная сумма 4 осей
 * прогрессии + коллекций. Формула Farm Value «живёт ТОЛЬКО здесь» (§3.4.1) — веса W_bld,
 * staff×40, know-how×60 и т.д. заданы в constants.ts.
 *
 * РАЗДЕЛЕНИЕ ОБЯЗАННОСТЕЙ:
 *  - здесь (progression) — сведение сырого состояния фермы в 4 оси `FarmValueAxes`
 *    (веса §4.5) — «производственная мощь» + «косметика/коллекции»;
 *  - кап 15% Σ(косметика+коллекции) — метод `EconSystem.farmValue` (engine/econ),
 *    переиспользуется, НЕ дублируется (его doc: «Мастер весов — 13-progression; здесь —
 *    только жёсткий кап»).
 *
 * ВАЖНО (анти-чит): Farm Value — НЕ валюта; скалярный статус для бракетов лиг (canon §2.4).
 * Клиентский расчёт — предсказание для UI (титул/разбивка), истина серверная (Edge, §3.4).
 *
 * ГРАНИЦА: чистая функция. Импортирует только `@/types` и `@/engine/econ` (кап) —
 * оба внутри `engine`, граница game↔render не нарушается (AGENTS.md §3).
 */

import type { BuildingKey, FarmValueAxes } from '@/types'
import { farmValue as applyCosmeticCap } from '@/engine/econ'
import {
  BUILDING_FV_EXPONENT,
  BUILDING_FV_WEIGHTS,
  STAFF_FV_PER_LEVEL,
  KNOW_HOW_FV_PER_NODE,
  FIELD_PLOT_FV,
  ORCHARD_PLOT_FV,
  RECIPE_STAR_FV,
  TOY_FV,
  RIBBON_FV,
  POSTCARD_FV,
  DECOR_FV_PER_SCORE,
} from './constants'

/**
 * Сырое состояние фермы для расчёта Farm Value (§3.4.1). Компоненты `animalFv` и
 * `recipeMasteryStars` приходят от соседних систем (03-animals / 04-machines) через
 * контракты — этот модуль их не считает, только взвешивает.
 */
export interface FarmValueInput {
  /** Уровни построек (key → level). `bld_apiary` без веса (§3.4.1) → вклад 0. */
  buildingLevels: Partial<Record<BuildingKey, number>>
  /** Уровни всех нанятых персонажей (по одному числу на персонажа). */
  staffLevels: readonly number[]
  /** Число изученных узлов Know-How. */
  knowHowNodeCount: number
  /** Грядки поля. */
  fieldPlots: number
  /** Грядки сада. */
  orchardPlots: number
  /** Суммарный animal_fv (из 03-animals.md). */
  animalFv: number
  /** Суммарные звёзды mastery рецептов (из 04-machines.md). */
  recipeMasteryStars: number
  /** Косметика/коллекции (в cosmetic_fv). */
  toys: number
  ribbons: number
  postcards: number
  /** decor_score (§3.4.1). */
  decorScore: number
}

/** Σ_buildings ( level^1.5 × W_bld ) (§3.4.1). Постройки без веса не вносят вклад. */
export function buildingsAxis(buildingLevels: FarmValueInput['buildingLevels']): number {
  let sum = 0
  for (const [key, level] of Object.entries(buildingLevels)) {
    if (!level || level <= 0) continue
    const w = BUILDING_FV_WEIGHTS[key as BuildingKey]
    if (w === undefined) continue // bld_apiary: вес не задан спекой → 0
    sum += Math.pow(level, BUILDING_FV_EXPONENT) * w
  }
  return sum
}

/**
 * «Производственная» ось (§3.4.1 `core_fv` без построек): стафф + know-how + грядки +
 * животные + рецепты. Постройки вынесены в отдельную ось `buildings` (см. FarmValueAxes).
 */
export function productionAxis(input: FarmValueInput): number {
  const staff = input.staffLevels.reduce((acc, lvl) => acc + Math.max(0, lvl) * STAFF_FV_PER_LEVEL, 0)
  return (
    staff +
    Math.max(0, input.knowHowNodeCount) * KNOW_HOW_FV_PER_NODE +
    Math.max(0, input.fieldPlots) * FIELD_PLOT_FV +
    Math.max(0, input.orchardPlots) * ORCHARD_PLOT_FV +
    Math.max(0, input.animalFv) +
    Math.max(0, input.recipeMasteryStars) * RECIPE_STAR_FV
  )
}

/**
 * Ось «коллекции» (заработанные коллекционные предметы, P4): игрушки + ленты + открытки.
 * Вместе с `cosmetics` образует «мягкую» часть, капируемую 15% (§3.4.1).
 */
export function collectionsAxis(input: FarmValueInput): number {
  return (
    Math.max(0, input.toys) * TOY_FV +
    Math.max(0, input.ribbons) * RIBBON_FV +
    Math.max(0, input.postcards) * POSTCARD_FV
  )
}

/** Ось «косметика» (декор, §3.4.1 `decor_score × 5`). «Мягкая», капируется вместе с коллекциями. */
export function cosmeticsAxis(input: FarmValueInput): number {
  return Math.max(0, input.decorScore) * DECOR_FV_PER_SCORE
}

/** Все 4 оси Farm Value БЕЗ `total` (до применения капа). */
export function farmValueAxes(input: FarmValueInput): Omit<FarmValueAxes, 'total'> {
  return {
    production: productionAxis(input),
    buildings: buildingsAxis(input.buildingLevels),
    collections: collectionsAxis(input),
    cosmetics: cosmeticsAxis(input),
  }
}

/**
 * Итоговый Farm Value с капом 15% косметики/коллекций (§3.4.1). Сводит оси и делегирует
 * кап `EconSystem.farmValue` (кап живёт в econ, веса — здесь). Возвращает полный
 * `FarmValueAxes` (оси + round(total)).
 */
export function farmValue(input: FarmValueInput): FarmValueAxes {
  return applyCosmeticCap(farmValueAxes(input))
}
