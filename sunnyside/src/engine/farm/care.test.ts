import { describe, expect, it } from 'vitest'
import {
  WEED_EVENT_CHANCE,
  CROW_EVENT_CHANCE,
  weedingGraceMs,
  crowWindowMs,
  applyCrowPenalty,
  isCropSusceptibleToCrows,
} from './care'

describe('WEED_EVENT_CHANCE / CROW_EVENT_CHANCE — таблица §4.2', () => {
  it('шансы прополки растут с тиром', () => {
    expect(WEED_EVENT_CHANCE[1]).toBe(0.15)
    expect(WEED_EVENT_CHANCE[2]).toBe(0.25)
    expect(WEED_EVENT_CHANCE[3]).toBe(0.35)
    expect(WEED_EVENT_CHANCE[4]).toBe(0.35)
    expect(WEED_EVENT_CHANCE[5]).toBe(0.4)
  })

  it('T1 не подвержены воронам, T2+ — да', () => {
    expect(CROW_EVENT_CHANCE[1]).toBe(0)
    expect(CROW_EVENT_CHANCE[2]).toBe(0.2)
    expect(CROW_EVENT_CHANCE[3]).toBe(0.2)
    expect(CROW_EVENT_CHANCE[4]).toBe(0.25)
    expect(CROW_EVENT_CHANCE[5]).toBe(0.25)
  })
})

describe('isCropSusceptibleToCrows', () => {
  it('T1 — false, остальные — true', () => {
    expect(isCropSusceptibleToCrows(1)).toBe(false)
    expect(isCropSusceptibleToCrows(2)).toBe(true)
    expect(isCropSusceptibleToCrows(3)).toBe(true)
  })
})

describe('weedingGraceMs — min(2ч, 40% t_remaining) (§3.4/F12)', () => {
  it('капается 2 часами для длинных остатков', () => {
    const tenHoursMs = 10 * 60 * 60 * 1000
    expect(weedingGraceMs(tenHoursMs)).toBe(2 * 60 * 60 * 1000)
  })

  it('пропорционально короче для коротких T1-хвостов', () => {
    const fiveMinMs = 5 * 60 * 1000
    expect(weedingGraceMs(fiveMinMs)).toBe(fiveMinMs * 0.4)
  })

  it('никогда не длиннее оставшегося роста (F12)', () => {
    for (const remaining of [0, 1000, 60_000, 3_600_000, 100_000_000]) {
      expect(weedingGraceMs(remaining)).toBeLessThanOrEqual(remaining)
    }
  })

  it('0 при неположительном остатке', () => {
    expect(weedingGraceMs(0)).toBe(0)
    expect(weedingGraceMs(-100)).toBe(0)
  })
})

describe('crowWindowMs — min(30 мин, 50% t_remaining) (§3.4/F12)', () => {
  it('капается 30 минутами для длинных остатков', () => {
    const twoHoursMs = 2 * 60 * 60 * 1000
    expect(crowWindowMs(twoHoursMs)).toBe(30 * 60 * 1000)
  })

  it('пропорционально короче для коротких остатков', () => {
    const twoMinMs = 2 * 60 * 1000
    expect(crowWindowMs(twoMinMs)).toBe(twoMinMs * 0.5)
  })

  it('никогда не длиннее оставшегося роста (F12)', () => {
    for (const remaining of [0, 1000, 60_000, 3_600_000]) {
      expect(crowWindowMs(remaining)).toBeLessThanOrEqual(remaining)
    }
  })
})

describe('applyCrowPenalty — −1 к выходу, не ниже 0 (§3.4)', () => {
  it('вычитает единицу из базового выхода', () => {
    expect(applyCrowPenalty(6)).toBe(5)
    expect(applyCrowPenalty(1)).toBe(0)
  })

  it('не уходит в минус на нулевом/уже нулевом выходе', () => {
    expect(applyCrowPenalty(0)).toBe(0)
  })
})
