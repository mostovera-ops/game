/**
 * engine/progression/synergy.ts — синергии сетов стаффа (13-progression §3.1.5).
 *
 * Синергия активна, когда ВСЕ её участники одновременно назначены на активные слоты
 * своего поста (§3.1.5). Бонус синергии АДДИТИВЕН к индивидуальным навыкам (§3.1.5) —
 * складывается в общий стек модификаторов (modifiers.ts). Синергии НЕ гейтятся уровнем
 * персонажа (§3.1.2 — Ур.1 достаточно).
 *
 * Числа-бонусы — из таблиц §3.1.5 (пост-сеты A + тематические пары B). Качественные
 * части («+эффект Field-синергии» и т.п.) не моделируются числом.
 *
 * ГРАНИЦА: чистые данные/функции, ноль сети/three.
 */

import type { StaffKey } from '@/types'
import type { ModifierContribution } from './effects'

export type SynergyId =
  // A. пост-сеты
  | 'kitchen_brigade'
  | 'front_of_house'
  | 'motor_pool'
  | 'homestead'
  // B. тематические пары
  | 'syn_bruno_ada'
  | 'syn_peggy_dizzy'
  | 'syn_gus_buck'
  | 'syn_marty_vernon'

export interface SynergyDef {
  id: SynergyId
  /** Все участники должны быть активны одновременно. */
  members: readonly StaffKey[]
  /**
   * Сколько из `members` требуется активно. `undefined` = все (по умолчанию).
   * Motor Pool: «любые 3 из 4 Yard» (§3.1.5) → requires = 3.
   */
  requires?: number
  /** Аддитивные бонусы (§3.1.5), складываются в общий стек. */
  bonuses: readonly ModifierContribution[]
}

/**
 * Определения синергий (§3.1.5). Числа — из таблиц A/B спеки.
 * Homestead: +2 грядки авто-полива, −10% цикл животных, −3% ко всем циклам фермы.
 * Motor Pool: −10% время экспедиций, −5% стоимость построек (любые 3 из 4 Yard).
 */
export const SYNERGIES: readonly SynergyDef[] = [
  // ── A. пост-сеты ──
  {
    id: 'kitchen_brigade',
    members: ['staff_bruno', 'staff_rosalind', 'staff_marty'],
    bonuses: [{ key: 'cooking_time_pct', value: -5 }],
  },
  {
    id: 'front_of_house',
    members: ['staff_peggy', 'staff_dizzy', 'staff_lorraine'],
    bonuses: [{ key: 'tips_pct', value: 10 }],
  },
  {
    id: 'motor_pool',
    members: ['staff_ada', 'staff_gus', 'staff_buck', 'staff_vernon'],
    requires: 3,
    bonuses: [
      { key: 'expedition_time_pct', value: -10 },
      { key: 'building_cost_pct', value: -5 },
    ],
  },
  {
    id: 'homestead',
    members: ['staff_hank', 'staff_clara'],
    bonuses: [
      { key: 'auto_water_plots', value: 2 },
      { key: 'animal_cycle_pct', value: -10 },
      { key: 'farm_cycle_pct', value: -3 },
    ],
  },
  // ── B. тематические пары ──
  {
    id: 'syn_bruno_ada',
    members: ['staff_bruno', 'staff_ada'],
    bonuses: [{ key: 'dish_bucks_pct', value: 3 }],
  },
  {
    id: 'syn_peggy_dizzy',
    members: ['staff_peggy', 'staff_dizzy'],
    bonuses: [{ key: 'drive_in_value_pct', value: 5 }],
  },
  {
    id: 'syn_gus_buck',
    members: ['staff_gus', 'staff_buck'],
    bonuses: [
      { key: 'expedition_time_pct', value: -10 },
      { key: 'expedition_fuel_pct', value: -5 },
    ],
  },
  {
    id: 'syn_marty_vernon',
    members: ['staff_marty', 'staff_vernon'],
    bonuses: [{ key: 'machine_build_time_pct', value: -15 }],
  },
]

/** Активна ли синергия при данном множестве активных персонажей (§3.1.5). */
export function isSynergyActive(def: SynergyDef, active: ReadonlySet<StaffKey>): boolean {
  const present = def.members.filter((m) => active.has(m)).length
  const need = def.requires ?? def.members.length
  return present >= need
}

/** Список активных синергий для множества активных персонажей. */
export function activeSynergies(active: ReadonlySet<StaffKey>): SynergyDef[] {
  return SYNERGIES.filter((s) => isSynergyActive(s, active))
}
