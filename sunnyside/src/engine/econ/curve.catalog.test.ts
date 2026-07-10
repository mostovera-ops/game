/**
 * curve.catalog.test.ts — ВАЛИДАЦИЯ кривой «×2.5/час, ×150/клик» T1→T5 (canon §2.2, §4.1)
 * на РЕАЛЬНЫХ данных каталога рецептов (src/data/catalogs/recipes.ts).
 *
 * Соединяет `recipes` (tier + baseCraftSec) и `recipeCatalogMeta` (basePrice) и считает
 * медианный валовый $/час по тиру. Доказывает, что контент-каталог реализует
 * дизайн-контракт кривой: доход/час растёт ~×2.5 T1→T5, ценность/клик ~×150.
 *
 * Данные-истина — из спеки (прошли ревью); тест лишь сверяет каталог с ними в пределах
 * допусков (каталог — набор конкретных блюд, а не одна точка тира).
 */

import { describe, it, expect } from 'vitest'
import { recipes, recipeCatalogMeta } from '@/data/catalogs/recipes'
import type { Tier } from '@/types'
import {
  tierCurveStats,
  refGrossPerHour,
  refPrice,
  type CurveSample,
} from './curve'
import { CURVE_TARGET } from './constants'

// Джойн каталога: рецепт (tier, baseCraftSec) × meta (basePrice продаваемого блюда).
const priceByKey = new Map(recipeCatalogMeta.map((m) => [m.recipeKey, m.basePrice]))
const samples: CurveSample[] = recipes
  .filter((r) => priceByKey.has(r.key))
  .map((r) => ({ tier: r.tier, price: priceByKey.get(r.key)!, craftSec: r.baseCraftSec }))

const stats = tierCurveStats(samples)
const statByTier = new Map(stats.map((s) => [s.tier, s]))

describe('кривая каталога: доход/час T1→T5 (§4.1)', () => {
  it('все 5 тиров представлены реальными блюдами', () => {
    for (const t of [1, 2, 3, 4, 5] as Tier[]) {
      const s = statByTier.get(t)
      expect(s, `тир T${t} отсутствует среди блюд каталога`).toBeTruthy()
      expect(s!.count).toBeGreaterThan(0)
    }
  })

  it('медианный доход/час монотонно НЕ убывает T1→T5', () => {
    for (let t = 2 as Tier; t <= 5; t = (t + 1) as Tier) {
      const prev = statByTier.get((t - 1) as Tier)!.medianGrossPerHour
      const cur = statByTier.get(t)!.medianGrossPerHour
      expect(cur, `T${t} (${cur.toFixed(1)}) < T${t - 1} (${prev.toFixed(1)})`).toBeGreaterThanOrEqual(prev)
    }
  })

  it('каждый тир близок к опорному $/час спеки §4.1 (допуск ±20%)', () => {
    for (const t of [1, 2, 3, 4, 5] as Tier[]) {
      const cur = statByTier.get(t)!.medianGrossPerHour
      const ref = refGrossPerHour(t)
      const rel = Math.abs(cur - ref) / ref
      expect(rel, `T${t}: медиана ${cur.toFixed(1)} vs опорное ${ref} (Δ ${(rel * 100).toFixed(1)}%)`).toBeLessThanOrEqual(0.2)
    }
  })

  it('отношение доход/час T5/T1 ≈ ×2.5 (дизайн-контракт, полоса 2.0…3.0)', () => {
    const t1 = statByTier.get(1)!.medianGrossPerHour
    const t5 = statByTier.get(5)!.medianGrossPerHour
    const ratio = t5 / t1
    expect(ratio).toBeGreaterThanOrEqual(2.0)
    expect(ratio).toBeLessThanOrEqual(3.0)
    // целевое значение canon §2.2 — в пределах ±30% от полосы
    expect(Math.abs(ratio - CURVE_TARGET.grossPerHourRatio)).toBeLessThanOrEqual(0.75)
  })
})

describe('кривая каталога: ценность/клик T1→T5 (§3.2, ×150)', () => {
  it('медианная цена монотонно растёт по тирам', () => {
    for (let t = 2 as Tier; t <= 5; t = (t + 1) as Tier) {
      const prev = statByTier.get((t - 1) as Tier)!.medianPrice
      const cur = statByTier.get(t)!.medianPrice
      expect(cur).toBeGreaterThan(prev)
    }
  })

  it('T5/T1 по цене — крупный множитель (порядок ×150, минимум ×100)', () => {
    const t1 = statByTier.get(1)!.medianPrice
    const t5 = statByTier.get(5)!.medianPrice
    expect(t5 / t1).toBeGreaterThanOrEqual(100)
  })

  it('медианная цена каждого тира в разумной близости к p_ref §4.1 (в 2× коридоре)', () => {
    for (const t of [1, 2, 3, 4, 5] as Tier[]) {
      const cur = statByTier.get(t)!.medianPrice
      const ref = refPrice(t)
      expect(cur).toBeGreaterThanOrEqual(ref * 0.5)
      expect(cur).toBeLessThanOrEqual(ref * 2)
    }
  })
})
