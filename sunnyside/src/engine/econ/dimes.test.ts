/**
 * dimes.test.ts — прайсинг Dimes-ускорений (§3.8). Проверяем калибровочную таблицу
 * спеки дословно + вогнутость + «последняя минута бесплатно» + батч без скидки.
 */

import { describe, it, expect } from 'vitest'
import { dimeSpeedupCost, dimeBatchSpeedupCost } from './dimes'

describe('dimeSpeedupCost — ceil(0.41·t^0.53), t≤1 → 0 (§3.8)', () => {
  it('калибровочные точки спеки §3.8', () => {
    expect(dimeSpeedupCost({ remainingMin: 5 })).toBe(1)
    expect(dimeSpeedupCost({ remainingMin: 15 })).toBe(2)
    expect(dimeSpeedupCost({ remainingMin: 60 })).toBe(4)
    expect(dimeSpeedupCost({ remainingMin: 240 })).toBe(8)
    expect(dimeSpeedupCost({ remainingMin: 480 })).toBe(11)
    expect(dimeSpeedupCost({ remainingMin: 1440 })).toBe(20)
    expect(dimeSpeedupCost({ remainingMin: 4320 })).toBe(35)
  })
  it('последняя минута и меньше — бесплатно', () => {
    expect(dimeSpeedupCost({ remainingMin: 1 })).toBe(0)
    expect(dimeSpeedupCost({ remainingMin: 0.5 })).toBe(0)
    expect(dimeSpeedupCost({ remainingMin: 0 })).toBe(0)
    expect(dimeSpeedupCost({ remainingMin: -5 })).toBe(0)
  })
  it('монотонно растёт с временем, но per-минута дешевеет (вогнутость b<1)', () => {
    const a = dimeSpeedupCost({ remainingMin: 5 })
    const b = dimeSpeedupCost({ remainingMin: 1440 })
    expect(b).toBeGreaterThan(a)
    // 24ч дороже 5м не в 288 раз, а лишь ~×20 (§3.8)
    expect(b / a).toBeLessThan(50)
  })
})

describe('dimeBatchSpeedupCost — сумма без скидки (§3.8)', () => {
  it('равен сумме поштучных', () => {
    const parts = [60, 240, 5]
    const expected = parts.reduce((s, m) => s + dimeSpeedupCost({ remainingMin: m }), 0)
    expect(dimeBatchSpeedupCost(parts)).toBe(expected)
    expect(dimeBatchSpeedupCost(parts)).toBe(4 + 8 + 1)
  })
  it('пустой батч → 0', () => {
    expect(dimeBatchSpeedupCost([])).toBe(0)
  })
})
