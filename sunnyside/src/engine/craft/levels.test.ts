/**
 * levels.test.ts — кривая апгрейда станка (04-machines.md §3.4/§4.3), значения таблицы
 * «сводно, применимо к любому станку» проверяются построчно на всех 5 уровнях.
 */
import { describe, it, expect } from 'vitest'
import {
  MACHINE_MAX_LEVEL,
  waitingSlots,
  queueCapacity,
  batchBonus,
  timeMultiplier,
  effectiveCraftSec,
  stationQualityBonus,
  machineBaseBatch,
  maxBatch,
} from './levels'

describe('кривая уровней станка (§4.3)', () => {
  it('слоты ожидания: 0/1/1/2/3 на Ур.1..5', () => {
    expect([1, 2, 3, 4, 5].map(waitingSlots)).toEqual([0, 1, 1, 2, 3])
  })

  it('ёмкость очереди = 1 (активный) + ожидание → 1/2/2/3/4', () => {
    expect([1, 2, 3, 4, 5].map(queueCapacity)).toEqual([1, 2, 2, 3, 4])
  })

  it('бонус батча: +0/+0/+1/+1/+2 на Ур.1..5', () => {
    expect([1, 2, 3, 4, 5].map(batchBonus)).toEqual([0, 0, 1, 1, 2])
  })

  it('множитель времени: 1 / .92 / .84 / .76 / .68 (−8%/уровень, кумулятивно до −32%)', () => {
    const expected = [1, 0.92, 0.84, 0.76, 0.68]
    for (const level of [1, 2, 3, 4, 5]) {
      expect(timeMultiplier(level)).toBeCloseTo(expected[level - 1] as number, 6)
    }
  })

  it('бонус цены (Station Quality): +0/+2/+4/+6/+8% на Ур.1..5', () => {
    const expected = [0, 0.02, 0.04, 0.06, 0.08]
    for (const level of [1, 2, 3, 4, 5]) {
      expect(stationQualityBonus(level)).toBeCloseTo(expected[level - 1] as number, 6)
    }
  })

  it('уровень зажимается в [1, MACHINE_MAX_LEVEL] на входах вне диапазона', () => {
    expect(queueCapacity(0)).toBe(queueCapacity(1))
    expect(queueCapacity(99)).toBe(queueCapacity(MACHINE_MAX_LEVEL))
    expect(MACHINE_MAX_LEVEL).toBe(5)
  })

  it('effectiveCraftSec применяет множитель уровня и округляет', () => {
    expect(effectiveCraftSec(300, 1)).toBe(300)
    expect(effectiveCraftSec(300, 5)).toBe(204) // 300 × 0.68
  })

  it('effectiveCraftSec никогда не даёт 0 или отрицательное время', () => {
    expect(effectiveCraftSec(1, 5)).toBeGreaterThanOrEqual(1)
  })
})

describe('базовый батч станка (§4.1) и максимум по уровню (§4.3)', () => {
  it('Mill — партиями ×4 уже на Ур.1 (§3.2/§4.1)', () => {
    expect(machineBaseBatch('mch_mill')).toBe(4)
    expect(maxBatch('mch_mill', 1)).toBe(4)
    expect(maxBatch('mch_mill', 5)).toBe(6) // 4 + бонус уровня 5 (+2)
  })

  it('Grill — база 2, растёт до 4 на Ур.5 (2 + 2)', () => {
    expect(machineBaseBatch('mch_grill')).toBe(2)
    expect(maxBatch('mch_grill', 1)).toBe(2)
    expect(maxBatch('mch_grill', 3)).toBe(3) // 2 + 1
    expect(maxBatch('mch_grill', 5)).toBe(4) // 2 + 2
  })

  it('Oven — база 1 (одна партия за раз на Ур.1)', () => {
    expect(machineBaseBatch('mch_oven')).toBe(1)
    expect(maxBatch('mch_oven', 1)).toBe(1)
  })

  it('незнакомый ключ станка — консервативный дефолт база 1', () => {
    expect(machineBaseBatch('mch_unknown_future')).toBe(1)
  })
})
