/**
 * engine/event/freshness.ts — анти-флуд F(category) (§3.14, канон E7).
 *
 * У каждой категории — freshness, падающая при перекорме и восстанавливающаяся со
 * временем. Регулятор спроса НА УРОВНЕ ГОРОДА (общий для всех), не наказание
 * игрока. Гасит «все флудят одной метой»: толкать одну категорию бесконечно
 * невыгодно — надо ловить смену фаз/палаток.
 *
 * ЧИСТАЯ логика: ноль сети/three/state.
 */

import {
  FRESHNESS_CEIL,
  FRESHNESS_FLOOD_PCT,
  FRESHNESS_FLOOR,
  FRESHNESS_RECOVERY_MIN,
  FRESHNESS_SLOPE,
  FRESHNESS_WINDOW_MIN,
} from './constants'
import { MINUTE_MS } from '@/engine/clock'

/** Порог потока категории (при нём F=1.0): 8% Goal_100 за окно 60 мин (§3.14). */
export function floodThreshold(goal100: number): number {
  return FRESHNESS_FLOOD_PCT * goal100
}

/**
 * F(category) (§3.14): clamp(1 − 0.5×(recent/threshold), 0.5, 1.0).
 *
 * `recent` — Σ(BFP × M_theme) по блюдам категории за скользящее окно 60 мин, БЕЗ
 * множителей F/Q/K (§3.14: freshness не зависит сама от себя, и не зависит от
 * личных атрибутов вклада). При норме потока F=1.0; при двойном перекорме
 * (recent = threshold) F=0.5 (пол).
 */
export function freshness(recent: number, goal100: number): number {
  const threshold = floodThreshold(goal100)
  if (threshold <= 0) return FRESHNESS_CEIL
  const raw = 1 - FRESHNESS_SLOPE * (Math.max(0, recent) / threshold)
  return Math.max(FRESHNESS_FLOOR, Math.min(FRESHNESS_CEIL, raw))
}

/**
 * Линейное затухание `recent` со временем (§3.14): полное восстановление за 120 мин.
 * `elapsedMs` — сколько прошло с момента замера `recent`. Возвращает остаточный
 * `recent` (0 после полного восстановления).
 */
export function decayRecent(recent: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return Math.max(0, recent)
  const recoveryMs = FRESHNESS_RECOVERY_MIN * MINUTE_MS
  const decayed = recent * (1 - elapsedMs / recoveryMs)
  return Math.max(0, decayed)
}

/** Окно накопления `recent` в мс (60 мин) — для скользящей суммы вызывающей стороной. */
export const FRESHNESS_WINDOW_MS = FRESHNESS_WINDOW_MIN * MINUTE_MS
