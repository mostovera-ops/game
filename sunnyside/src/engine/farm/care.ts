/**
 * engine/farm/care.ts — уход за грядкой: прополка (Weeding) и вороны (Crows),
 * 02-farm §3.4/§4.2/F12. Никогда не блокирует созревание и не убивает урожай
 * (пилларс P3) — уход только даёт бонус к качеству или мягкий штраф темпа/выхода.
 *
 * ГРАНИЦА: чистые функции + данные, ноль three/react/net.
 */

import type { Tier } from '@/types'
import { HOUR_MS, MIN_MS } from './growth'

/** Шанс события «появился сорняк» на цикл роста, по тиру культуры (02-farm §4.2). */
export const WEED_EVENT_CHANCE: Readonly<Record<Tier, number>> = {
  1: 0.15,
  2: 0.25,
  3: 0.35,
  4: 0.35,
  5: 0.4,
}

/** Шанс события «вороны» на цикл, T1 не подвержены (02-farm §4.2). */
export const CROW_EVENT_CHANCE: Readonly<Record<Tier, number>> = {
  1: 0,
  2: 0.2,
  3: 0.2,
  4: 0.25,
  5: 0.25,
}

/**
 * Grace-окно прополки: `min(2ч, 40% t_remaining)` (02-farm §3.4/F12) — никогда не
 * длиннее оставшегося роста, поэтому для коротких T1-хвостов окно пропорционально короче.
 */
export function weedingGraceMs(tRemainingMs: number): number {
  return Math.min(2 * HOUR_MS, Math.max(0, tRemainingMs) * 0.4)
}

/** Окно реакции на ворон: `min(30 мин, 50% t_remaining)` (02-farm §3.4/F12). */
export function crowWindowMs(tRemainingMs: number): number {
  return Math.min(30 * MIN_MS, Math.max(0, tRemainingMs) * 0.5)
}

/**
 * Штраф ворон при отсутствии реакции в окне: −1 единица итогового выхода урожая,
 * не ниже 0 (02-farm §3.4) — «не наказание, а мелкая помеха», не весь урожай.
 */
export function applyCrowPenalty(baseYieldQty: number): number {
  return Math.max(0, baseYieldQty - 1)
}

/** Культура вообще подвержена событию ворон (T1 — нет, 02-farm §3.4/§4.2). */
export function isCropSusceptibleToCrows(tier: Tier): boolean {
  return CROW_EVENT_CHANCE[tier] > 0
}
