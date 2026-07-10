/**
 * engine/econ/curve.ts — кривая ценности тиров: ценность/клик и доход/час (§3.2/§4.1).
 *
 * Дизайн-контракт canon §2.2: T1→T5 — ×150 ценность за клик, но лишь ×2.5 доход/час
 * (высокий тир экономит клики, а не «выгоднее в час»). Здесь — чистые формулы +
 * агрегатор для валидации каталогов (см. curve.catalog.test.ts).
 *
 * ГРАНИЦА: чистые функции, ноль сети/three. Каталоги передаются снаружи (test), модуль
 * не импортирует src/data.
 */

import type { Tier } from '@/types'
import { TIER_ECON_REF } from './constants'

/** Ценность за клик = опорная цена блюда (§3.2). */
export function valuePerClick(pRef: number): number {
  return pRef
}

/** Валовый доход/час на 1 слот = pRef / (cycleMin/60) (§3.2). */
export function grossPerHour(pRef: number, cycleMin: number): number {
  if (cycleMin <= 0) return 0
  return pRef / (cycleMin / 60)
}

/** Медиана массива (для агрегата по тиру — устойчивее среднего к выбросам). */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Опорный доход/час по тиру из таблицы §4.1. */
export function refGrossPerHour(tier: Tier): number {
  const row = TIER_ECON_REF.find((r) => r.tier === tier)
  return row ? row.grossPerHour : NaN
}

/** Опорная цена (p_ref) по тиру из таблицы §4.1. */
export function refPrice(tier: Tier): number {
  const row = TIER_ECON_REF.find((r) => r.tier === tier)
  return row ? row.pRef : NaN
}

/** Запись «блюдо тира с ценой и циклом» — вход агрегатора (маппится из каталога). */
export interface CurveSample {
  tier: Tier
  /** Цена продажи $ (basePrice из recipeCatalogMeta). */
  price: number
  /** Полный цикл, сек (baseCraftSec из recipe). */
  craftSec: number
}

export interface TierCurveStat {
  tier: Tier
  count: number
  medianGrossPerHour: number
  medianPrice: number
}

/**
 * Сводит выборку блюд каталога в статистику по тирам: медианный доход/час и медианная
 * цена. Используется валидацией «×2.5/час T1→T5» на реальных данных каталога.
 */
export function tierCurveStats(samples: readonly CurveSample[]): TierCurveStat[] {
  const byTier = new Map<Tier, { gph: number[]; price: number[] }>()
  for (const s of samples) {
    if (!byTier.has(s.tier)) byTier.set(s.tier, { gph: [], price: [] })
    const bucket = byTier.get(s.tier)!
    bucket.gph.push(grossPerHour(s.price, s.craftSec / 60))
    bucket.price.push(s.price)
  }
  return [...byTier.entries()]
    .map(([tier, b]) => ({
      tier,
      count: b.gph.length,
      medianGrossPerHour: median(b.gph),
      medianPrice: median(b.price),
    }))
    .sort((a, b) => a.tier - b.tier)
}
