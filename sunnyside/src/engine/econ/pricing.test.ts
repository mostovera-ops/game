/**
 * pricing.test.ts — множители формулы SellRate (§4.5): Q_quality, P_price, sellRate.
 */

import { describe, it, expect } from 'vitest'
import { qualityFactor, pricePressure, salePrice, sellRate } from './pricing'
import { QUALITY_MAX } from './constants'

describe('qualityFactor — 1 + 0.08×★, потолок 1.40 (§4.5)', () => {
  it('шкала ★', () => {
    expect(qualityFactor(0)).toBeCloseTo(1.0)
    expect(qualityFactor(1)).toBeCloseTo(1.08)
    expect(qualityFactor(5)).toBeCloseTo(1.4)
  })
  it('зажимается [1.0, 1.40] вне диапазона', () => {
    expect(qualityFactor(-3)).toBe(1)
    expect(qualityFactor(99)).toBe(QUALITY_MAX)
  })
})

describe('pricePressure — (pRef/pSet)^1.8, ползунок 0.70×…1.50× (§4.5)', () => {
  it('p_set = p_ref → нейтрально (1.0)', () => {
    expect(pricePressure(100, 100)).toBeCloseTo(1)
  })
  it('дешевле выставил → быстрее продаётся (>1)', () => {
    expect(pricePressure(100, 80)).toBeGreaterThan(1)
  })
  it('дороже выставил → медленнее (<1)', () => {
    expect(pricePressure(100, 130)).toBeLessThan(1)
  })
  it('ползунок зажат: p_set ниже 0.70× трактуется как 0.70×', () => {
    expect(pricePressure(100, 10)).toBeCloseTo(pricePressure(100, 70))
    expect(pricePressure(100, 9999)).toBeCloseTo(pricePressure(100, 150))
  })
  it('нулевой p_ref → 0 (без NaN)', () => {
    expect(pricePressure(0, 100)).toBe(0)
  })
})

describe('salePrice — округление и неотрицательность', () => {
  it('округляет к целому', () => {
    expect(salePrice(33, 1, 1, 0)).toBe(33)
    expect(salePrice(100, 1.15, 1, 0)).toBe(115)
  })
  it('не ниже нуля при нулевой базе', () => {
    expect(salePrice(0, 5, 5, 5)).toBe(0)
  })
})

describe('sellRate — произведение множителей (§4.5)', () => {
  it('только rBase → сам rBase', () => {
    expect(sellRate({ rBase: 8 })).toBe(8)
  })
  it('перемножает все множители', () => {
    expect(sellRate({ rBase: 8, dCat: 1.3, dItem: 2, sSat: 0.5 })).toBeCloseTo(8 * 1.3 * 2 * 0.5)
  })
  it('не отрицательный', () => {
    expect(sellRate({ rBase: 8, dCat: 0 })).toBe(0)
  })
})
