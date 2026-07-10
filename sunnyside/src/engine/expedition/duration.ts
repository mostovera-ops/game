/**
 * engine/expedition/duration.ts — ЧИСТАЯ формула длительности рейса (§4.1).
 *
 *   duration = base_duration(stateKey)
 *              × (1 − min(CAP, speed_upgrade_reduction + staff_gus_reduction + region_set_bonus_reduction))
 *              × (0.5 если truck_contract)
 *
 * Кап 55% включает ВСЕ три терма вместе (§4.1/O7), не по отдельности.
 *
 * АНТИ-ЧИТ: это предсказание для UI (таймер до подтверждения сервером) — сервер
 * (`expedition_start`) — источник истины `returnAt` (AGENTS.md §0.3).
 */
import type { StateKey } from '@/types'
import {
  BASE_DURATION_HOURS,
  HOUR_MS,
  MAX_SPEED_LEVEL,
  MAX_TOTAL_DURATION_REDUCTION,
  REGION_SET_BONUS_PER_REGION,
  SPEED_REDUCTION_BY_LEVEL,
  STAFF_GUS_REDUCTION,
  TRUCK_CONTRACT_DURATION_MULT,
} from './constants'

export interface DurationInput {
  stateKey: StateKey
  /** Уровень Speed 0..5 (§3.4.1). */
  speedLevel: number
  /** Пост Yard занят Mechanic Gus? (§3.4.1) */
  hasStaffGus: boolean
  /** Число полностью собранных регионов открыток, покрывающих этот стоп (§3.7/§4.1). */
  closedRegionsCoveringStop: number
  /** Рейс запущен через Truck Contract — экспресс ×0.5 (§3.6). */
  isTruckContract?: boolean
}

/** Доля сокращения времени от уровня Speed (0 у отсутствующего/некорректного уровня). */
export function speedReduction(speedLevel: number): number {
  if (!Number.isInteger(speedLevel) || speedLevel < 0) return 0
  const idx = Math.min(speedLevel, MAX_SPEED_LEVEL)
  return SPEED_REDUCTION_BY_LEVEL[idx] ?? 0
}

/** Суммарная скидка времени (все три терма), капнутая 55% (§4.1). */
export function totalDurationReduction(input: Pick<DurationInput, 'speedLevel' | 'hasStaffGus' | 'closedRegionsCoveringStop'>): number {
  const raw =
    speedReduction(input.speedLevel) +
    (input.hasStaffGus ? STAFF_GUS_REDUCTION : 0) +
    Math.max(0, input.closedRegionsCoveringStop) * REGION_SET_BONUS_PER_REGION
  return Math.min(MAX_TOTAL_DURATION_REDUCTION, raw)
}

/** Базовая длительность рейса в часах (до апгрейдов), §3.2/§4.1. */
export function baseDurationHours(stateKey: StateKey): number {
  return BASE_DURATION_HOURS[stateKey] ?? BASE_DURATION_HOURS.st_home
}

/** Итоговая длительность рейса в мс — формула §4.1. */
export function expeditionDurationMs(input: DurationInput): number {
  const baseMs = baseDurationHours(input.stateKey) * HOUR_MS
  const reduction = totalDurationReduction(input)
  const contractMult = input.isTruckContract ? TRUCK_CONTRACT_DURATION_MULT : 1
  return Math.round(baseMs * (1 - reduction) * contractMult)
}
