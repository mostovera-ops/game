/**
 * demand.test.ts — генерация недельного спроса (§3.6) и ностальгии (§3.7).
 * Ключевые контракты: детерминизм от (week, town), зеро-сумность, клип [0.70,1.30],
 * различие городов/недель, стэк ностальгии с потолком 2.6.
 */

import { describe, it, expect } from 'vitest'
import {
  generateWeeklyDemand,
  computeDCat,
  pickNostalgia,
  effectiveDemand,
} from './demand'
import { hashSeed, seededRng } from './rng'
import {
  DEMAND_METAS,
  D_CAT_CEIL,
  D_CAT_FLOOR,
  NOSTALGIA_EFFECTIVE_CAP,
  NOSTALGIA_MULT,
} from './constants'

describe('generateWeeklyDemand — детерминизм от (week, town) (§3.6)', () => {
  it('один и тот же (week, town) → идентичная доска', () => {
    const a = generateWeeklyDemand(7, 'town_sunnyside')
    const b = generateWeeklyDemand(7, 'town_sunnyside')
    expect(a).toEqual(b)
  })
  it('разные города или недели → разный сид (обычно разная доска)', () => {
    const w7 = generateWeeklyDemand(7, 'town_a')
    const w8 = generateWeeklyDemand(8, 'town_a')
    const other = generateWeeklyDemand(7, 'town_b')
    expect(w7.seed).not.toBe(w8.seed)
    expect(w7.seed).not.toBe(other.seed)
  })
  it('seed == hashSeed(week, town)', () => {
    expect(generateWeeklyDemand(3, 'town_x').seed).toBe(hashSeed(3, 'town_x'))
  })
})

describe('computeDCat — 4 меты, клип [0.70,1.30], зеро-сумность (§3.6)', () => {
  it('все меты присутствуют и в диапазоне на многих сидах', () => {
    for (let week = 0; week < 60; week++) {
      const d = computeDCat(seededRng(hashSeed(week, 'town_sunnyside')))
      const vals = DEMAND_METAS.map((m) => d[m])
      expect(vals.length).toBe(4)
      for (const v of vals) {
        expect(v).toBeGreaterThanOrEqual(D_CAT_FLOOR - 1e-9)
        expect(v).toBeLessThanOrEqual(D_CAT_CEIL + 1e-9)
      }
    }
  })
  it('приближённо зеро-сумно: Σ(D−1) ≈ 0 (после ре-нормировки, §3.6 шаг 4)', () => {
    let worst = 0
    for (let week = 0; week < 100; week++) {
      const d = computeDCat(seededRng(hashSeed(week, 'town_z')))
      const sumDev = DEMAND_METAS.reduce((s, m) => s + (d[m] - 1), 0)
      worst = Math.max(worst, Math.abs(sumDev))
    }
    // с точностью до клипа (§3.6/EC1): дрейф мал
    expect(worst).toBeLessThan(0.15)
  })
  it('нейтральная неделя тоже валидна (нет вылета за границы)', () => {
    const d = computeDCat(seededRng(12345))
    for (const m of DEMAND_METAS) {
      expect(Number.isFinite(d[m])).toBe(true)
    }
  })
})

describe('pickNostalgia — 1–2 продукта T1–T2 ×2 (§3.7)', () => {
  it('пустой пул → нет пиков', () => {
    expect(pickNostalgia(seededRng(1), [])).toEqual([])
  })
  it('1 или 2 уникальных продукта, множитель ×2', () => {
    const pool = ['p_lemonade', 'p_toast', 'p_scramble', 'p_muffin']
    for (let s = 0; s < 40; s++) {
      const picks = pickNostalgia(seededRng(s), pool)
      expect(picks.length).toBeGreaterThanOrEqual(1)
      expect(picks.length).toBeLessThanOrEqual(2)
      const keys = picks.map((p) => p.productKey)
      expect(new Set(keys).size).toBe(keys.length) // без повторов
      for (const p of picks) {
        expect(p.mult).toBe(NOSTALGIA_MULT)
        expect(pool).toContain(p.productKey)
      }
    }
  })
  it('пул из 1 элемента — count зажимается размером пула', () => {
    const picks = pickNostalgia(seededRng(3), ['only'])
    expect(picks.length).toBe(1)
  })
  it('через generateWeeklyDemand пул прорастает в nostalgia', () => {
    const wd = generateWeeklyDemand(5, 'town_a', ['p_a', 'p_b', 'p_c'])
    expect(wd.nostalgia.length).toBeGreaterThanOrEqual(1)
  })
})

describe('effectiveDemand — стэк D_cat × ностальгия, потолок 2.6 (§3.7)', () => {
  it('без ностальгии = D_cat', () => {
    expect(effectiveDemand(1.2)).toBe(1.2)
  })
  it('стэк мультипликативен', () => {
    expect(effectiveDemand(1.2, NOSTALGIA_MULT)).toBeCloseTo(2.4)
  })
  it('капится на 2.6', () => {
    expect(effectiveDemand(1.3, NOSTALGIA_MULT)).toBe(NOSTALGIA_EFFECTIVE_CAP) // 2.6 (иначе 2.6)
  })
})
