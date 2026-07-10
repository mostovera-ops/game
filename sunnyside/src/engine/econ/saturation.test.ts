/**
 * saturation.test.ts — эластичность перенасыщения S_sat (§4.6). Проверяем калибровочную
 * таблицу спеки: listed/demand 0.5×→1.15, 1×→1.00, 2×→0.71, 4×→0.50, ≥6.25×→0.40.
 */

import { describe, it, expect } from 'vitest'
import { sSat, saturation } from './saturation'
import { S_SAT_CEIL, S_SAT_FLOOR } from './constants'

describe('sSat — clamp((Demand/Listed)^0.5, 0.40, 1.15) (§4.6)', () => {
  it('калибровочная таблица §4.6', () => {
    // listed = ratio × demand; демо demand=100
    expect(sSat(100, 50)).toBeCloseTo(1.15) // 0.5× дефицит → потолок
    expect(sSat(100, 100)).toBeCloseTo(1.0) // баланс
    expect(sSat(100, 200)).toBeCloseTo(0.707, 2) // ×2 перекорм
    expect(sSat(100, 400)).toBeCloseTo(0.5, 2) // ×4 флуд
    expect(sSat(100, 625)).toBeCloseTo(0.4) // ≥6.25× пол
  })
  it('пол и потолок жёстко зажаты', () => {
    expect(sSat(100, 100000)).toBe(S_SAT_FLOOR)
    expect(sSat(100, 1)).toBe(S_SAT_CEIL)
  })
  it('ничего не выставлено (listed ≤ 0) → потолок 1.15', () => {
    expect(sSat(100, 0)).toBe(S_SAT_CEIL)
    expect(sSat(100, -5)).toBe(S_SAT_CEIL)
  })
  it('нулевой/отрицательный спрос → пол (не NaN)', () => {
    expect(sSat(0, 100)).toBe(S_SAT_FLOOR)
    expect(sSat(-10, 100)).toBe(S_SAT_FLOOR)
  })
})

describe('saturation — обёртка контракта (SaturationInput)', () => {
  it('soldQty=listed, demandMultiplier=demand units', () => {
    expect(saturation({ category: 'cat_bakery', soldQty: 200, demandMultiplier: 100 })).toBeCloseTo(0.707, 2)
    expect(saturation({ category: 'cat_bakery', soldQty: 100, demandMultiplier: 100 })).toBeCloseTo(1)
  })
})
