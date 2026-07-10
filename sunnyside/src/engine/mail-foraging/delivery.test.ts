/**
 * delivery.test.ts — честная доставка Каталога почтой (08 §3.1.3).
 * Задержки по категории + правило ускорения «1◉/начатые 4ч, кап 5◉».
 */

import { describe, it, expect } from 'vitest'
import { deliveryDelayMs, deliverAtFor, speedupCostDimes, deliveryProgress } from './delivery'
import { HOUR_MS, MAIL_SPEEDUP_DIMES_CAP } from './constants'

describe('deliveryDelayMs / deliverAtFor', () => {
  it('задержка по категории из спеки: Rare 20ч / Decor 16ч / Tools 8ч', () => {
    expect(deliveryDelayMs('rare_seeds')).toBe(20 * HOUR_MS)
    expect(deliveryDelayMs('decor')).toBe(16 * HOUR_MS)
    expect(deliveryDelayMs('tools')).toBe(8 * HOUR_MS)
  })

  it('deliverAt = orderedAt + задержка категории', () => {
    const t0 = 1_000_000
    expect(deliverAtFor('tools', t0)).toBe(t0 + 8 * HOUR_MS)
    expect(deliverAtFor('rare_seeds', t0)).toBe(t0 + 20 * HOUR_MS)
  })
})

describe('speedupCostDimes', () => {
  const now = 0
  it('0◉ когда заказ уже готов (remaining ≤ 0)', () => {
    expect(speedupCostDimes(-1, now)).toBe(0)
    expect(speedupCostDimes(0, now)).toBe(0)
  })

  it('1◉ за начатые 4ч: 1мс → 1◉, ровно 4ч → 1◉, 4ч+1мс → 2◉', () => {
    expect(speedupCostDimes(1, now)).toBe(1)
    expect(speedupCostDimes(4 * HOUR_MS, now)).toBe(1)
    expect(speedupCostDimes(4 * HOUR_MS + 1, now)).toBe(2)
  })

  it('8ч → 2◉, 12ч → 3◉, 16ч → 4◉, 20ч → 5◉', () => {
    expect(speedupCostDimes(8 * HOUR_MS, now)).toBe(2)
    expect(speedupCostDimes(12 * HOUR_MS, now)).toBe(3)
    expect(speedupCostDimes(16 * HOUR_MS, now)).toBe(4)
    expect(speedupCostDimes(20 * HOUR_MS, now)).toBe(5)
  })

  it('кап 5◉: длинная rare-доставка не превышает потолок', () => {
    expect(speedupCostDimes(20 * HOUR_MS + 1, now)).toBe(MAIL_SPEEDUP_DIMES_CAP)
    expect(speedupCostDimes(100 * HOUR_MS, now)).toBe(MAIL_SPEEDUP_DIMES_CAP)
  })
})

describe('deliveryProgress', () => {
  it('0 в начале, 0.5 в середине, 1 по готовности и после', () => {
    expect(deliveryProgress(0, 100, 0)).toBe(0)
    expect(deliveryProgress(0, 100, 50)).toBeCloseTo(0.5)
    expect(deliveryProgress(0, 100, 100)).toBe(1)
    expect(deliveryProgress(0, 100, 999)).toBe(1)
  })
})
