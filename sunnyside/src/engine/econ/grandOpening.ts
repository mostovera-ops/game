/**
 * engine/econ/grandOpening.ts — катч-ап Grand Opening ×2 (§3.10, mech_grand_opening).
 *
 * Единая модель (§3.10, R1): ФИКСИРОВАННЫЙ таймер от момента активации, переживает
 * недельный ролловер (не привязан к серверной неделе).
 *   - standard (старт / Town Merge / Street Caravan): 7×24 ч
 *   - winback   (реактивация push_winback_d7): 48 ч
 * Эффект: ×2 ко всему Bucks-доходу. НЕ влияет на Dimes/Tickets/Ribbons/XP, не удваивает
 * спрос, не пробивает кэпы. Повторный триггер во время активного — продлевает от новой
 * даты (не стэкается сам с собой).
 *
 * Время — ТОЛЬКО serverNow() у вызывающего (21-client §3.6); сюда `now` передаётся.
 * ГРАНИЦА: чистые функции, ноль сети/three.
 */

import type { EpochMs } from '@/types'
import {
  GRAND_OPENING_MS,
  GRAND_OPENING_MULT,
  GRAND_OPENING_WINBACK_MS,
} from './constants'

export type GrandOpeningKind = 'standard' | 'winback'

export interface GrandOpeningState {
  activatedAt: EpochMs
  kind: GrandOpeningKind
}

/** Длительность окна по типу триггера (§3.10). */
export function grandOpeningDurationMs(kind: GrandOpeningKind): number {
  return kind === 'winback' ? GRAND_OPENING_WINBACK_MS : GRAND_OPENING_MS
}

/** Активно ли окно в момент `now` (полуинтервал [activatedAt, activatedAt+duration)). */
export function isGrandOpeningActive(state: GrandOpeningState, now: EpochMs): boolean {
  const end = state.activatedAt + grandOpeningDurationMs(state.kind)
  return now >= state.activatedAt && now < end
}

/**
 * Множитель Bucks-дохода в момент `now`: ×2 если окно активно, иначе ×1 (§3.10).
 * `state` = null → нет активного окна → ×1.
 */
export function grandOpeningMultiplier(state: GrandOpeningState | null, now: EpochMs): number {
  if (state && isGrandOpeningActive(state, now)) return GRAND_OPENING_MULT
  return 1
}

/** Остаток окна в мс (0, если истекло/не активно). Для UI-таймера. */
export function grandOpeningRemainingMs(state: GrandOpeningState, now: EpochMs): number {
  const end = state.activatedAt + grandOpeningDurationMs(state.kind)
  return Math.max(0, end - now)
}

/**
 * Повторный триггер (§3.10): продлевает окно до полной длительности от `now` (не стэк).
 * Возвращает новое состояние — вызывающий кладёт его в стор.
 */
export function retriggerGrandOpening(now: EpochMs, kind: GrandOpeningKind): GrandOpeningState {
  return { activatedAt: now, kind }
}
