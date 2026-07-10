/**
 * engine/progression/staffSkills.ts — числовые базовые навыки стаффа + масштабирование
 * по уровню (13-progression §3.1.1 таблица навыков, §3.1.2/§4.1 множители уровня).
 *
 * Только персонажи с ЯВНЫМ числом в §3.1.1 попадают в числовую карту. Персонажи с
 * качественным навыком без числа (Clara «−цикл животных», Lorraine «+посетители»,
 * Vernon «−время постройки», Buck «+1 слот маршрута» — слот управляется одной шкалой
 * 07-expeditions §3.4.3, не аддитив) — НЕ моделируются числом (не выдумываем %).
 *
 * ГРАНИЦА: чистые данные/функции, ноль сети/three.
 */

import type { StaffKey } from '@/types'
import type { ModifierContribution } from './effects'
import { STAFF_LEVEL_MULTIPLIERS, STAFF_MAX_LEVEL } from './constants'

/**
 * Множитель к величине навыка по уровню (§3.1.2/§4.1). Уровень зажимается в [1..5].
 * Ур.1 ×1.00 … Ур.5 ×2.00 (1 + 0.25·(level−1)).
 */
export function staffLevelMultiplier(level: number): number {
  const idx = Math.min(STAFF_MAX_LEVEL, Math.max(1, Math.floor(level))) - 1
  return STAFF_LEVEL_MULTIPLIERS[idx] as number
}

/**
 * Стоимость апгрейда стаффа НА уровень `toLevel` в его жетонах (§4.1).
 * Возвращает 0 для уровней вне диапазона перехода (нет апгрейда на/сверх капа или на Ур.1).
 */
export function staffUpgradeCost(toLevel: number): number {
  const costs: Record<number, number> = { 2: 10, 3: 25, 4: 60, 5: 140 }
  return costs[Math.floor(toLevel)] ?? 0
}

/**
 * Кумулятивная стоимость апгрейда стаффа с Ур.1 до `toLevel` в жетонах (§4.1):
 * до Ур.2=10, Ур.3=35, Ур.4=95, Ур.5=235.
 */
export function staffUpgradeCostCumulative(toLevel: number): number {
  const target = Math.min(STAFF_MAX_LEVEL, Math.max(1, Math.floor(toLevel)))
  let sum = 0
  for (let l = 2; l <= target; l++) sum += staffUpgradeCost(l)
  return sum
}

/** Числовой базовый навык персонажа на Ур.1 (×1.00), до масштабирования уровнем. */
export interface StaffBaseSkill extends ModifierContribution {
  staff: StaffKey
}

/**
 * Карта числовых базовых навыков (§3.1.1). Значение — величина на Ур.1; знак —
 * направление (−время быстрее, +ценность/чаевые выше). Масштабируется `staffLevelMultiplier`.
 */
export const STAFF_BASE_SKILL: Readonly<Partial<Record<StaffKey, StaffBaseSkill>>> = {
  staff_bruno: { staff: 'staff_bruno', key: 'cooking_time_pct', value: -10 }, // −10% готовка
  staff_peggy: { staff: 'staff_peggy', key: 'tips_pct', value: 15 }, // +15% чаевые
  staff_dizzy: { staff: 'staff_dizzy', key: 'shake_soda_value_pct', value: 20 }, // +20% шейки/сода
  staff_ada: { staff: 'staff_ada', key: 'bucks_income_pct', value: 5 }, // +5% Bucks с продаж
  staff_gus: { staff: 'staff_gus', key: 'expedition_time_pct', value: -15 }, // −15% время экспедиции
  staff_marty: { staff: 'staff_marty', key: 'grill_batch', value: 1 }, // +1 партия гриля
  staff_hank: { staff: 'staff_hank', key: 'auto_water_plots', value: 4 }, // авто-полив 4 грядок
  staff_rosalind: { staff: 'staff_rosalind', key: 'pastry_mastery_star', value: 1 }, // +1★ выпечка
}

/**
 * Эффективный вклад навыка персонажа на данном уровне: base × множитель(level).
 * `null` — если у персонажа нет числового навыка (не моделируется).
 */
export function effectiveStaffSkill(staff: StaffKey, level: number): ModifierContribution | null {
  const base = STAFF_BASE_SKILL[staff]
  if (!base) return null
  return { key: base.key, value: base.value * staffLevelMultiplier(level) }
}
