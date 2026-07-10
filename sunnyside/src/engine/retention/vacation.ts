/**
 * engine/retention/vacation.ts — Gone Fishin' (Vacation Mode, `mech_gone_fishin`,
 * 16-retention.md §3.5) + Neighbor Sitter (§4.4). ЧИСТАЯ валидация/расчёт — не
 * ходит в adapter, не двигает таймеры фермы (это `FarmSystem`/склад — чужая зона).
 */

import type { EpochMs, Result, UUID } from '@/types'
import {
  NEIGHBOR_SIT_BUCKS_REWARD,
  NEIGHBOR_SIT_TICKET_REWARD,
  VACATION_MAX_DAYS,
  VACATION_MIN_DAYS,
  VACATION_REACTIVATION_COOLDOWN_MS,
} from './constants'

export type VacationStartError = 'already_active' | 'cooldown' | 'duration_out_of_range'

export interface ValidateVacationStartInput {
  requestedDays: number
  hasActiveVacation: boolean
  /** Момент, когда истекает анти-абьюз кулдаун после завершения ПРЕДЫДУЩЕГО отпуска (§3.5). */
  cooldownEndsAt?: EpochMs
  now: EpochMs
}

/**
 * Валидирует запрос на начало Gone Fishin' (§3.5): диапазон 3–30 дней, не более
 * 1 активного одновременно, ≥24ч простоя на реальной ферме после предыдущего.
 */
export function validateVacationStart(
  input: ValidateVacationStartInput,
): Result<{ days: number }, VacationStartError> {
  if (input.hasActiveVacation) return { ok: false, error: 'already_active' }
  if (input.cooldownEndsAt !== undefined && input.now < input.cooldownEndsAt) {
    return { ok: false, error: 'cooldown' }
  }
  if (
    !Number.isInteger(input.requestedDays) ||
    input.requestedDays < VACATION_MIN_DAYS ||
    input.requestedDays > VACATION_MAX_DAYS
  ) {
    return { ok: false, error: 'duration_out_of_range' }
  }
  return { ok: true, value: { days: input.requestedDays } }
}

/** Момент окончания отпуска по длительности (слайдер, §3.5). */
export function vacationEndAt(startedAt: EpochMs, days: number): EpochMs {
  return startedAt + days * 24 * 60 * 60 * 1000
}

/** Активен ли Gone Fishin' в момент `now` (полуинтервал [start, end)). Досрочное завершение — вызывающий сам не зовёт эту функцию дальше. */
export function isVacationActive(startedAt: EpochMs, days: number, now: EpochMs): boolean {
  return now >= startedAt && now < vacationEndAt(startedAt, days)
}

/** Момент, до которого действует анти-абьюз кулдаун реактивации после завершения (§3.5). */
export function vacationReactivationCooldownEndsAt(endedAt: EpochMs): EpochMs {
  return endedAt + VACATION_REACTIVATION_COOLDOWN_MS
}

// ── Neighbor Sitter (§4.4/RC5) ─────────────────────────────────────────────────

export type NeighborSitError = 'self_sit_forbidden'

export interface NeighborSitOutcome {
  /** `true` — первый оплаченный присмотр за эту ферму в этот игровой день (получает награду). */
  paid: boolean
  ticketReward: number
  bucksReward: number
}

/**
 * Разрешает попытку присмотра (§3.9 — `sitter_id != farm_owner_id`, §4.4 — 1 оплаченная
 * выплата в сутки/ферму, RC5 — конкурентные нажатия: первое в БД по row-lock выигрывает,
 * остальные получают только косметическое «Спасибо!», без ошибки).
 */
export function resolveNeighborSit(
  sitterId: UUID,
  farmOwnerId: UUID,
  alreadyPaidToday: boolean,
): Result<NeighborSitOutcome, NeighborSitError> {
  if (sitterId === farmOwnerId) return { ok: false, error: 'self_sit_forbidden' }
  if (alreadyPaidToday) {
    return { ok: true, value: { paid: false, ticketReward: 0, bucksReward: 0 } }
  }
  return {
    ok: true,
    value: { paid: true, ticketReward: NEIGHBOR_SIT_TICKET_REWARD, bucksReward: NEIGHBOR_SIT_BUCKS_REWARD },
  }
}
