/**
 * conversion.test.ts — юниты конверсии блюдо → Fill Points (§3.3, §4.1–4.4).
 * Числа сверены со спекой 10-server-event (прошла ревью). Node, без браузера.
 */

import { describe, it, expect } from 'vitest'
import {
  baseFillPoints,
  qualityMult,
  channelMult,
  dishFp,
  meterFp,
  donationTickets,
} from './index'
import { BASE_FILL_POINTS } from './constants'

describe('baseFillPoints — BFP(tier) §4.1', () => {
  it('точные значения тиров из спеки', () => {
    expect(baseFillPoints(1)).toBe(10)
    expect(baseFillPoints(2)).toBe(28)
    expect(baseFillPoints(3)).toBe(80)
    expect(baseFillPoints(4)).toBe(220)
    expect(baseFillPoints(5)).toBe(620)
  })
  it('T5/T1 = 62× (компрессия §3.3: цена 150×, значит T1 эффективнее по FP/бакс)', () => {
    expect(BASE_FILL_POINTS[5] / BASE_FILL_POINTS[1]).toBe(62)
  })
  it('монотонно растёт по тиру', () => {
    expect(baseFillPoints(2)).toBeGreaterThan(baseFillPoints(1))
    expect(baseFillPoints(5)).toBeGreaterThan(baseFillPoints(4))
  })
})

describe('qualityMult — Q = 1 + 0.08×stars §4.2', () => {
  it('0..5 звёзд → 1.00 … 1.40', () => {
    expect(qualityMult(0)).toBeCloseTo(1.0)
    expect(qualityMult(1)).toBeCloseTo(1.08)
    expect(qualityMult(2)).toBeCloseTo(1.16)
    expect(qualityMult(3)).toBeCloseTo(1.24)
    expect(qualityMult(4)).toBeCloseTo(1.32)
    expect(qualityMult(5)).toBeCloseTo(1.4)
  })
  it('кламп вне диапазона (мусорный ввод не ломает формулу)', () => {
    expect(qualityMult(-3)).toBeCloseTo(1.0)
    expect(qualityMult(99)).toBeCloseTo(1.4)
    expect(qualityMult(2.9)).toBeCloseTo(1.16) // floor до 2 звёзд
  })
})

describe('channelMult — K_channel §4.4', () => {
  it('пожертвование ценнее продажи', () => {
    expect(channelMult('donate')).toBe(1.1)
    expect(channelMult('passive')).toBe(1.0)
  })
})

describe('dishFp — FP_dish = BFP × Q × M_theme × F × K §3.3', () => {
  it('базовый T1 без бонусов = 10', () => {
    expect(dishFp({ tier: 1, stars: 0, channel: 'passive' })).toBeCloseTo(10)
  })
  it('все множители перемножаются (T5 ★5 донат)', () => {
    // 620 × 1.40 × 1 × 1 × 1.10 = 954.8
    expect(dishFp({ tier: 5, stars: 5, channel: 'donate' })).toBeCloseTo(954.8)
  })
  it('M_theme и freshness применяются', () => {
    // 80 × 1.0 × 2.0 × 0.5 × 1.0 = 80
    expect(dishFp({ tier: 3, stars: 0, channel: 'passive', mTheme: 2, freshness: 0.5 })).toBeCloseTo(80)
  })
  it('donate ценнее passive при прочих равных (E10: буст кормит котёл)', () => {
    const sell = dishFp({ tier: 3, stars: 2, channel: 'passive' })
    const donate = dishFp({ tier: 3, stars: 2, channel: 'donate' })
    expect(donate).toBeGreaterThan(sell)
    expect(donate / sell).toBeCloseTo(1.1)
  })
  it('отрицательные множители не «вычитают» из котла (кламп в 0)', () => {
    expect(dishFp({ tier: 1, stars: 0, channel: 'passive', mTheme: -5 })).toBe(0)
    expect(dishFp({ tier: 1, stars: 0, channel: 'passive', freshness: -1 })).toBe(0)
  })
  it('T1 эффективнее T5 по FP/бакс (канон E9 «ранние тиры живы»)', () => {
    // FP/бакс: T1 = 10/6 ≈ 1.67, T5 = 620/900 ≈ 0.69
    const t1PerBuck = dishFp({ tier: 1, stars: 0, channel: 'passive' }) / 6
    const t5PerBuck = dishFp({ tier: 5, stars: 0, channel: 'passive' }) / 900
    expect(t1PerBuck).toBeGreaterThan(t5PerBuck)
  })
})

describe('meterFp — Σ FP_dish §3.3', () => {
  it('сумма вкладов', () => {
    expect(meterFp([10, 28, 80])).toBe(118)
  })
  it('пустой котёл = 0; отрицательные вклады игнорируются', () => {
    expect(meterFp([])).toBe(0)
    expect(meterFp([100, -50])).toBe(100)
  })
})

describe('donationTickets — 🎟 1 / 500 FP, кап 10 §4.4', () => {
  it('порог 500 FP за тикет', () => {
    expect(donationTickets(499)).toBe(0)
    expect(donationTickets(500)).toBe(1)
    expect(donationTickets(1250)).toBe(2)
  })
  it('кап 🎟 10 за уикенд', () => {
    expect(donationTickets(5000)).toBe(10)
    expect(donationTickets(999999)).toBe(10)
  })
  it('отрицательный FP → 0', () => {
    expect(donationTickets(-100)).toBe(0)
  })
})
