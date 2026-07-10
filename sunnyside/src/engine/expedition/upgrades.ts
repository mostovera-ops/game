/**
 * engine/expedition/upgrades.ts — ЧИСТЫЕ таблицы апгрейдов грузовика (§3.4).
 * Три независимые ветки: Speed / Capacity / Route Slots. Только предсказание для
 * UI (стоимость следующего уровня, текущий эффект) — покупка идёт через adapter.
 */
import {
  CAPACITY_LEVELS,
  MAX_CAPACITY_LEVEL,
  MAX_ROUTE_SLOTS_LEVEL,
  MAX_SPEED_LEVEL,
  ROUTE_SLOTS_BY_LEVEL,
  ROUTE_SLOTS_UPGRADE_COST,
  ROUTE_SLOTS_UPGRADE_COST_DIMES,
  SPEED_UPGRADE_COST,
  SPEED_UPGRADE_COST_DIMES,
  STAFF_BUCK_BONUS_SLOTS,
  type CapacityLevel,
} from './constants'

function clampLevel(level: number, max: number): number {
  if (!Number.isInteger(level) || level < 0) return 0
  return Math.min(level, max)
}

/** Стоимость (в `$`) достижения уровня Speed `level` (0 у базового/некорректного). */
export function speedUpgradeCost(level: number): number {
  return SPEED_UPGRADE_COST[clampLevel(level, MAX_SPEED_LEVEL)] ?? 0
}

/** Доп. стоимость в ◉ для уровня Speed `level` (только уровень 5, §3.4.1). */
export function speedUpgradeCostDimes(level: number): number {
  return SPEED_UPGRADE_COST_DIMES[clampLevel(level, MAX_SPEED_LEVEL)] ?? 0
}

/** Конфигурация Capacity на уровне `level` (слоты/множитель/цена), §3.4.2. */
export function capacityLevelDef(level: number): CapacityLevel {
  const idx = clampLevel(level, MAX_CAPACITY_LEVEL)
  return CAPACITY_LEVELS[idx] ?? CAPACITY_LEVELS[0]!
}

/** Число слотов маршрутов на уровне апгрейда (без стаффа), §3.4.3. */
export function routeSlotsAtLevel(level: number): number {
  const idx = clampLevel(level, MAX_ROUTE_SLOTS_LEVEL) - 1
  return ROUTE_SLOTS_BY_LEVEL[Math.max(0, idx)] ?? ROUTE_SLOTS_BY_LEVEL[0]!
}

export function routeSlotsUpgradeCost(level: number): number {
  const idx = clampLevel(level, MAX_ROUTE_SLOTS_LEVEL) - 1
  return ROUTE_SLOTS_UPGRADE_COST[Math.max(0, idx)] ?? 0
}

export function routeSlotsUpgradeCostDimes(level: number): number {
  const idx = clampLevel(level, MAX_ROUTE_SLOTS_LEVEL) - 1
  return ROUTE_SLOTS_UPGRADE_COST_DIMES[Math.max(0, idx)] ?? 0
}

/** Итоговое число параллельных рейсов: уровень апгрейда + бонус `staff_buck` (§3.4.3). */
export function totalRouteSlots(level: number, hasStaffBuck: boolean): number {
  return routeSlotsAtLevel(level) + (hasStaffBuck ? STAFF_BUCK_BONUS_SLOTS : 0)
}
