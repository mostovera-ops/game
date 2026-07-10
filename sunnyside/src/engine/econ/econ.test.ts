/**
 * econ.test.ts — системный уровень: фабрика EconSystem + salePrice/farmValue (пример
 * для агентов; гейт ≥90% строк). Запускается в node без браузера — доказывает границу
 * game/scene (21-client §3.1/§3.10). Модульные формулы — в соседних *.test.ts.
 */

import { describe, it, expect } from 'vitest'
import { createEconSystem, econSystem } from './index'

describe('createEconSystem — фабрика реализует контракт EconSystem', () => {
  it('возвращает объект со всеми методами контракта', () => {
    const sys = createEconSystem()
    expect(typeof sys.saturation).toBe('function')
    expect(typeof sys.dimeSpeedupCost).toBe('function')
    expect(typeof sys.salePrice).toBe('function')
    expect(typeof sys.farmValue).toBe('function')
  })
  it('синглтон econSystem детерминирован и совпадает с фабрикой', () => {
    expect(econSystem.dimeSpeedupCost({ remainingMin: 60 })).toBe(
      createEconSystem().dimeSpeedupCost({ remainingMin: 60 }),
    )
  })
})

describe('salePrice через систему', () => {
  it('база × спрос × перенасыщение × качество (Q=1+0.08×★)', () => {
    const sys = createEconSystem()
    expect(sys.salePrice(100, 1, 1, 0)).toBe(100) // 0★ → ×1.00
    expect(sys.salePrice(100, 1.2, 1, 0)).toBe(120)
    expect(sys.salePrice(100, 1, 1, 5)).toBe(140) // 5★ → ×1.40
    expect(sys.salePrice(100, 1, 0.5, 0)).toBe(50)
  })
  it('не уходит ниже нуля', () => {
    expect(createEconSystem().salePrice(0, 1, 1, 0)).toBe(0)
  })
})

describe('farmValue через систему — Σ(косметика+коллекции) капится 15%', () => {
  it('малый soft — не капится', () => {
    const v = econSystem.farmValue({ production: 800, buildings: 200, collections: 10, cosmetics: 10 })
    expect(v.total).toBe(1020)
  })
  it('большой soft — доля soft в total ≤ 15%', () => {
    const v = econSystem.farmValue({ production: 800, buildings: 200, collections: 500, cosmetics: 500 })
    expect(v.total).toBe(1176) // core=1000 + min(1000, 1000·0.15/0.85≈176.47)
    const softShare = (v.total - 1000) / v.total
    expect(softShare).toBeLessThanOrEqual(0.1501)
  })
  it('нулевой soft и нулевой core', () => {
    expect(econSystem.farmValue({ production: 0, buildings: 0, collections: 0, cosmetics: 0 }).total).toBe(0)
    expect(econSystem.farmValue({ production: 500, buildings: 0, collections: 0, cosmetics: 0 }).total).toBe(500)
  })
})

describe('saturation через систему (метод контракта)', () => {
  it('делегирует в sSat (soldQty=listed, demandMultiplier=demand units)', () => {
    // demand=listed → 1.0; listed>demand → <1; listed=0 → потолок 1.15
    expect(econSystem.saturation({ category: 'cat_grill', soldQty: 100, demandMultiplier: 100 })).toBeCloseTo(1)
    expect(econSystem.saturation({ category: 'cat_grill', soldQty: 400, demandMultiplier: 100 })).toBeCloseTo(0.5)
    expect(econSystem.saturation({ category: 'cat_grill', soldQty: 0, demandMultiplier: 100 })).toBeCloseTo(1.15)
  })
})
