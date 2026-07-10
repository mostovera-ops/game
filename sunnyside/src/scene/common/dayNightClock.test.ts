/**
 * dayNightClock.test.ts — суточный цикл по реальному UTC-часу сервера (node).
 */

import { describe, it, expect } from 'vitest'
import { dayPhaseForHour, hourUTC, neonIntensityForHour } from './dayNightClock'

describe('hourUTC', () => {
  it('конвертирует epoch в дробный UTC-час', () => {
    // 1970-01-01T12:30:00Z
    const epoch = Date.UTC(1970, 0, 1, 12, 30, 0)
    expect(hourUTC(epoch)).toBeCloseTo(12.5, 5)
  })
  it('полночь → 0', () => {
    expect(hourUTC(Date.UTC(2026, 0, 1, 0, 0, 0))).toBeCloseTo(0, 5)
  })
})

describe('dayPhaseForHour', () => {
  it('день 06:00–18:00', () => {
    expect(dayPhaseForHour(6)).toBe('day')
    expect(dayPhaseForHour(12)).toBe('day')
    expect(dayPhaseForHour(17.99)).toBe('day')
  })
  it('закат 18:00–19:00', () => {
    expect(dayPhaseForHour(18)).toBe('dusk')
    expect(dayPhaseForHour(18.5)).toBe('dusk')
  })
  it('ночь 19:00–05:00 (через полночь)', () => {
    expect(dayPhaseForHour(19)).toBe('night')
    expect(dayPhaseForHour(23.9)).toBe('night')
    expect(dayPhaseForHour(0)).toBe('night')
    expect(dayPhaseForHour(4.9)).toBe('night')
  })
  it('рассвет 05:00–06:00', () => {
    expect(dayPhaseForHour(5)).toBe('dawn')
    expect(dayPhaseForHour(5.5)).toBe('dawn')
  })
  it('нормализует часы вне [0,24)', () => {
    expect(dayPhaseForHour(25)).toBe(dayPhaseForHour(1))
    expect(dayPhaseForHour(-1)).toBe(dayPhaseForHour(23))
  })
})

describe('neonIntensityForHour', () => {
  it('0 днём', () => {
    expect(neonIntensityForHour(6)).toBe(0)
    expect(neonIntensityForHour(12)).toBe(0)
    expect(neonIntensityForHour(17.999)).toBe(0)
  })
  it('нарастает линейно весь час заката', () => {
    expect(neonIntensityForHour(18)).toBeCloseTo(0, 5)
    expect(neonIntensityForHour(18.5)).toBeCloseTo(0.5, 5)
    expect(neonIntensityForHour(18.99)).toBeGreaterThan(0.9)
  })
  it('1 всю ночь', () => {
    expect(neonIntensityForHour(19)).toBe(1)
    expect(neonIntensityForHour(0)).toBe(1)
    expect(neonIntensityForHour(23)).toBe(1)
    expect(neonIntensityForHour(4.99)).toBeCloseTo(1, 2)
  })
  it('гаснет линейно весь час рассвета', () => {
    expect(neonIntensityForHour(5)).toBeCloseTo(1, 5)
    expect(neonIntensityForHour(5.5)).toBeCloseTo(0.5, 5)
    expect(neonIntensityForHour(5.99)).toBeCloseTo(0.01, 2)
  })
  it('значение всегда в [0,1]', () => {
    for (let h = 0; h < 24; h += 0.37) {
      const v = neonIntensityForHour(h)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
