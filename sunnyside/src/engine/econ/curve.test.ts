/**
 * curve.test.ts — чистые хелперы кривой тиров (§3.2/§4.1), без каталога.
 * Каталожная валидация «×2.5/час» — отдельно в curve.catalog.test.ts.
 */

import { describe, it, expect } from 'vitest'
import { valuePerClick, grossPerHour, median, refGrossPerHour, refPrice } from './curve'
import { TIER_ECON_REF } from './constants'

describe('valuePerClick / grossPerHour (§3.2)', () => {
  it('ценность/клик = p_ref', () => {
    expect(valuePerClick(6)).toBe(6)
    expect(valuePerClick(900)).toBe(900)
  })
  it('доход/час = p_ref / (cycleMin/60) — сверка опорной таблицы §4.1', () => {
    for (const row of TIER_ECON_REF) {
      expect(grossPerHour(row.pRef, row.cycleMin)).toBeCloseTo(row.grossPerHour, 0)
    }
  })
  it('нулевой/отрицательный цикл → 0 (без деления на ноль)', () => {
    expect(grossPerHour(100, 0)).toBe(0)
    expect(grossPerHour(100, -5)).toBe(0)
  })
})

describe('median', () => {
  it('нечётная длина — средний элемент', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('чётная длина — среднее двух центральных', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('пустой → NaN', () => {
    expect(Number.isNaN(median([]))).toBe(true)
  })
})

describe('refGrossPerHour / refPrice — опорные значения §4.1', () => {
  it('возвращают табличные числа', () => {
    expect(refGrossPerHour(1)).toBe(72)
    expect(refGrossPerHour(5)).toBe(180)
    expect(refPrice(1)).toBe(6)
    expect(refPrice(5)).toBe(900)
  })
})
