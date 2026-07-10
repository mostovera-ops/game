/**
 * engine/expedition/sendCost.ts — ЧИСТЫЕ формулы стоимости отправки (§3.5).
 * Send Cost (`$`, разовая топливная плата) + ускорение ◉ (курс ◉1 = 30 мин, кап/рейс).
 */
import type { Tier } from '@/types'
import { SEND_COST_BY_TIER, type SendCostRange } from './constants'

export type SendCostTierKey = 'T1_T2' | 'T3' | 'T4' | 'T5'

/** Тир лута стопа (1..5, §2.2) → ключ таблицы Send Cost (§3.5). */
export function sendCostTierKey(tier: Tier): SendCostTierKey {
  if (tier <= 2) return 'T1_T2'
  if (tier === 3) return 'T3'
  if (tier === 4) return 'T4'
  return 'T5'
}

export function sendCostRange(tier: Tier): SendCostRange {
  return SEND_COST_BY_TIER[sendCostTierKey(tier)]
}

/** Среднее Send Cost таблицы тира (используется как «типичная» цена в превью UI). */
export function averageSendCost(tier: Tier): number {
  const { min, max } = sendCostRange(tier)
  return Math.round((min + max) / 2)
}

/**
 * Стоимость полного ускорения оставшегося времени рейса в ◉ (§3.5): `remainingMs`/30мин,
 * округление вверх (начатые полчаса считаются полностью), капнутое `dimesCap` тира.
 */
export function dimesSpeedupCost(tier: Tier, remainingMs: number): number {
  const { dimesPerHalfHour, dimesCap } = sendCostRange(tier)
  if (remainingMs <= 0 || dimesPerHalfHour <= 0) return 0
  const halfHours = Math.ceil(remainingMs / (30 * 60_000))
  return Math.min(dimesCap, halfHours * dimesPerHalfHour)
}
