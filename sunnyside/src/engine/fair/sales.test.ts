/**
 * sales.test.ts — юниты формул пассивных продаж прилавка (09-fair §3.3/§4.x).
 * Node без браузера (граница game↔scene). Числа сверены со спекой (примеры §3.3/§4.3).
 */

import { describe, it, expect } from 'vitest'

import {
  refPrice,
  priceBounds,
  clampPrice,
  pricePressure,
  qualityFactor,
  clampDemand,
  saturation,
  demandUnits,
  sellRate,
  stackCap,
  simulateLotSales,
  bluePlatePrice,
} from './sales'

describe('refPrice / priceBounds / clampPrice (§4.1, §3.3)', () => {
  it('референс-цены тиров из §4.1', () => {
    expect(refPrice(1)).toBe(6)
    expect(refPrice(3)).toBe(75)
    expect(refPrice(5)).toBe(900)
  })
  it('коридор цены 0.70×…1.50× p_ref', () => {
    expect(priceBounds(3)).toEqual({ min: 75 * 0.7, max: 75 * 1.5 })
  })
  it('клампит цену в коридор тира', () => {
    expect(clampPrice(3, 10)).toBe(75 * 0.7) // ниже пола
    expect(clampPrice(3, 1000)).toBe(75 * 1.5) // выше потолка
    expect(clampPrice(3, 82.5)).toBe(82.5) // в коридоре
  })
})

describe('pricePressure — P=(p_ref/p_set)^1.8 (§4.3)', () => {
  it('p_set = p_ref → 1.0', () => {
    expect(pricePressure(3, 75)).toBeCloseTo(1.0, 5)
  })
  it('таблица §4.3 (в пределах округления спеки)', () => {
    expect(pricePressure(3, 75 * 0.7)).toBeCloseTo(1.9, 1) // спека 1.90
    expect(pricePressure(3, 75 * 0.8)).toBeCloseTo(1.5, 1) // спека 1.50
    expect(pricePressure(3, 75 * 1.1)).toBeCloseTo(0.85, 1) // спека 0.85
    expect(pricePressure(3, 75 * 1.5)).toBeCloseTo(0.48, 2) // спека 0.48
  })
  it('дороже → медленнее (P монотонно убывает по цене)', () => {
    expect(pricePressure(2, 22 * 1.5)).toBeLessThan(pricePressure(2, 22))
    expect(pricePressure(2, 22 * 0.7)).toBeGreaterThan(pricePressure(2, 22))
  })
  it('цена за коридором клампится (жадность 2× физически недоступна)', () => {
    // 3.0× запрошено → клампится к 1.5× → тот же P, что и на потолке.
    expect(pricePressure(3, 75 * 3)).toBeCloseTo(pricePressure(3, 75 * 1.5), 6)
  })
})

describe('qualityFactor — Q=1+0.08×★ (§4.4)', () => {
  it('★0→1.0, ★3→1.24, ★5→1.40', () => {
    expect(qualityFactor(0)).toBeCloseTo(1.0)
    expect(qualityFactor(3)).toBeCloseTo(1.24)
    expect(qualityFactor(5)).toBeCloseTo(1.4)
  })
  it('клампит звёзды 0..5', () => {
    expect(qualityFactor(-2)).toBeCloseTo(1.0)
    expect(qualityFactor(9)).toBeCloseTo(1.4)
  })
})

describe('clampDemand — коридор Demand Board (§4.2)', () => {
  it('клампит в [0.70, 1.30]', () => {
    expect(clampDemand(0.5)).toBe(0.7)
    expect(clampDemand(2)).toBe(1.3)
    expect(clampDemand(1.1)).toBe(1.1)
  })
})

describe('saturation — S=clamp((Demand/Listed)^0.5, 0.40, 1.15) (§3.3, E7)', () => {
  it('пустая категория (Listed=0) → бонус за дефицит, потолок 1.15', () => {
    expect(saturation(100, 0)).toBe(1.15)
  })
  it('город затоварен метой (Listed≫Demand) → пол 0.40, не в ноль', () => {
    expect(saturation(10, 100000)).toBe(0.4)
  })
  it('баланс Demand=Listed → 1.0', () => {
    expect(saturation(50, 50)).toBeCloseTo(1.0)
  })
  it('монотонно убывает по Listed', () => {
    expect(saturation(100, 400)).toBeLessThan(saturation(100, 100))
  })
})

describe('demandUnits — D_cat × N_active × base_appetite (§3.3)', () => {
  it('растёт с населением и спросом', () => {
    expect(demandUnits(1.0, 100, 2)).toBe(200)
    expect(demandUnits(1.3, 100, 2)).toBe(260)
  })
  it('клампит спрос в коридор', () => {
    expect(demandUnits(5, 10, 1)).toBe(1.3 * 10 * 1)
  })
})

describe('sellRate — ядро пассива (§3.3, пример Cherry Pie)', () => {
  it('пример спеки §3.3: Cherry Pie T3 → ≈1.55 ед/ч', () => {
    const rate = sellRate({
      tier: 3,
      demand: 1.25,
      priceSet: 75 * 1.1,
      stars: 3,
      sat: 0.9,
      lStall: 1.1,
      staff: 1,
    })
    expect(rate).toBeCloseTo(1.55, 1)
  })
  it('дефолты (sat/lStall/staff=1) при референс-условиях → R_base', () => {
    // T1, D=1, p_set=p_ref (P=1), ★0 (Q=1) → 8.0
    expect(sellRate({ tier: 1, demand: 1, priceSet: 6, stars: 0 })).toBeCloseTo(8.0, 6)
  })
  it('T1 быстрее T5 по объёму (§4.1 логика)', () => {
    const t1 = sellRate({ tier: 1, demand: 1, priceSet: 6, stars: 0 })
    const t5 = sellRate({ tier: 5, demand: 1, priceSet: 900, stars: 0 })
    expect(t1).toBeGreaterThan(t5)
  })
})

describe('stackCap — cap стека по тиру (§3.2)', () => {
  it('T1=200 … T5=5', () => {
    expect(stackCap(1)).toBe(200)
    expect(stackCap(5)).toBe(5)
  })
})

describe('simulateLotSales — catch-up интеграл (§3.3)', () => {
  it('целые единицы: sellRate 4 ед/ч → 1 ед/тик, 10 тиков → 10 продано', () => {
    // T1, staff=0.5 → 8×0.5=4 ед/ч; perTick = 4×0.25 = 1.0
    const res = simulateLotSales({
      rate: { tier: 1, demand: 1, priceSet: 6, stars: 0, staff: 0.5 },
      remaining: 100,
      priceSet: 6,
      ticks: 10,
    })
    expect(res.unitsSold).toBe(10)
    expect(res.revenue).toBe(60) // 10 × $6
    expect(res.remaining).toBe(90)
    expect(res.accumulator).toBeCloseTo(0)
  })

  it('дробный накопитель: медленный T4 (0.4 ед/ч) продаётся за окно, не теряется', () => {
    // perTick = 0.4×0.25 = 0.1; за 10 тиков acc=1.0 → 1 единица
    const res = simulateLotSales({
      rate: { tier: 4, demand: 1, priceSet: 260, stars: 0 },
      remaining: 12,
      priceSet: 260,
      ticks: 10,
    })
    expect(res.unitsSold).toBe(1)
    expect(res.revenue).toBe(260)
  })

  it('не продаёт больше остатка стека', () => {
    const res = simulateLotSales({
      rate: { tier: 1, demand: 1, priceSet: 6, stars: 0 },
      remaining: 3,
      priceSet: 6,
      ticks: 100,
    })
    expect(res.unitsSold).toBe(3)
    expect(res.remaining).toBe(0)
  })

  it('Grand Opening ×2 удваивает выручку, не скорость (F10)', () => {
    const base = simulateLotSales({
      rate: { tier: 1, demand: 1, priceSet: 6, stars: 0, staff: 0.5 },
      remaining: 100,
      priceSet: 6,
      ticks: 4,
    })
    const opening = simulateLotSales({
      rate: { tier: 1, demand: 1, priceSet: 6, stars: 0, staff: 0.5 },
      remaining: 100,
      priceSet: 6,
      ticks: 4,
      revenueMult: 2,
    })
    expect(opening.unitsSold).toBe(base.unitsSold)
    expect(opening.revenue).toBe(base.revenue * 2)
  })

  it('накопитель переносится между заходами (продолжение сессии)', () => {
    const first = simulateLotSales({
      rate: { tier: 4, demand: 1, priceSet: 260, stars: 0 },
      remaining: 12,
      priceSet: 260,
      ticks: 5, // acc=0.5, 0 продано
    })
    expect(first.unitsSold).toBe(0)
    expect(first.accumulator).toBeCloseTo(0.5)
    const second = simulateLotSales({
      rate: { tier: 4, demand: 1, priceSet: 260, stars: 0 },
      remaining: first.remaining,
      priceSet: 260,
      ticks: 5, // +0.5 → 1.0 → 1 продано
      accumulator: first.accumulator,
    })
    expect(second.unitsSold).toBe(1)
  })
})

describe('bluePlatePrice — сет +15% (§4.5)', () => {
  it('+15% к сумме p_ref компонентов', () => {
    // бургер 22 + гарнир 6 + напиток 6 = 34 → ×1.15 = 39.1 → 39
    expect(bluePlatePrice([22, 6, 6])).toBe(39)
  })
})
