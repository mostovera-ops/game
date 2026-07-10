/**
 * engine/farm/growth.ts — тайминги роста грядки, 02-farm §3.3/§3.4.
 *
 * ПРАВИЛО (AGENTS.md §0.4): время — только `serverNow()`, никогда `Date.now()`
 * в игровой логике. Эти функции ЧИСТЫЕ — принимают `now`/`plantedAt` параметрами,
 * не читают часы сами (вызывающая сторона берёт их из `ClockSystem.serverNow()`).
 *
 * ГРАНИЦА: ноль three/react/net.
 */

import type { EpochMs } from '@/types'
import { plotTierDef, type PlotTier } from './plotTier'

const HOUR_MS = 60 * 60 * 1000
const MIN_MS = 60 * 1000

/**
 * Эффективная длительность роста с учётом тира грядки (02-farm §3.3): базовый
 * `growSec` культуры (data/catalogs/crops.ts) умножается на `growTimeMult` тира.
 */
export function effectiveGrowMs(baseGrowSec: number, plotTier: PlotTier): number {
  if (!Number.isFinite(baseGrowSec) || baseGrowSec < 0) {
    throw new RangeError(`effectiveGrowMs: baseGrowSec must be >= 0, got ${baseGrowSec}`)
  }
  const mult = plotTierDef(plotTier).growTimeMult
  return Math.round(baseGrowSec * 1000 * mult)
}

/** `readyAt = plantedAt + effectiveGrowMs(...)` — момент, когда грядка готова к сбору. */
export function computeReadyAt(
  plantedAt: EpochMs,
  baseGrowSec: number,
  plotTier: PlotTier,
): EpochMs {
  return plantedAt + effectiveGrowMs(baseGrowSec, plotTier)
}

/**
 * Штраф за полный игнор grace-периода прополки: рост продлевается на +10%
 * времени цикла (02-farm §3.4) — мягкая потеря темпа, не потеря урожая (пилларс P3).
 * Продлевает от уже действующей (с учётом тира) длительности цикла.
 */
export function weedIgnorePenaltyMs(baseGrowSec: number, plotTier: PlotTier): number {
  return Math.round(effectiveGrowMs(baseGrowSec, plotTier) * 0.1)
}

/**
 * «Окно эффективности» полива — первые 50% таймера роста (02-farm §3.4, гипотеза):
 * полив в этом окне даёт бонус к качеству; после — не блокирует, просто без бонуса.
 */
export function isWithinWateringWindow(
  plantedAt: EpochMs,
  readyAt: EpochMs,
  now: EpochMs,
): boolean {
  const total = readyAt - plantedAt
  if (total <= 0) return false
  const elapsed = now - plantedAt
  return elapsed >= 0 && elapsed <= total * 0.5
}

export { HOUR_MS, MIN_MS }
