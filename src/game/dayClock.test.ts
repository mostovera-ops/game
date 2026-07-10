import { beforeEach, describe, expect, it } from 'vitest'
import {
  advanceClock,
  CYCLE_SECONDS,
  DAY_SECONDS,
  darkness,
  daylight,
  dayProgress,
  getClock,
  isNight,
  resetClock,
  subscribeClock,
  sunAngle,
} from './dayClock'

const NIGHT_HALF = (CYCLE_SECONDS - DAY_SECONDS) / 2

beforeEach(() => resetClock())

describe('свет', () => {
  it('в полдень светло, в полночь темно', () => {
    expect(daylight(DAY_SECONDS / 2)).toBeCloseTo(1)
    expect(darkness(DAY_SECONDS / 2)).toBe(0)
    const midnight = DAY_SECONDS + NIGHT_HALF
    expect(daylight(midnight)).toBeLessThan(0.02)
    expect(darkness(midnight)).toBeGreaterThan(0.9)
  })

  it('не прыгает на закате и на перевале через полночь', () => {
    const dusk = daylight(DAY_SECONDS)
    expect(daylight(DAY_SECONDS - 0.01)).toBeCloseTo(dusk, 2)
    // Конец ночи и начало нового дня — одна и та же точка кривой.
    expect(daylight(CYCLE_SECONDS - 0.001)).toBeCloseTo(daylight(0), 2)
  })

  it('днём светлее, чем в любое мгновение ночи', () => {
    for (let t = DAY_SECONDS; t < CYCLE_SECONDS; t += 0.5) {
      expect(daylight(t)).toBeLessThanOrEqual(daylight(0) + 1e-9)
    }
  })
})

describe('солнце', () => {
  it('встаёт на востоке, стоит в зените, садится на западе', () => {
    expect(Math.cos(sunAngle(0))).toBeGreaterThan(0.9)
    expect(Math.sin(sunAngle(DAY_SECONDS / 2))).toBeCloseTo(1)
    expect(Math.cos(sunAngle(DAY_SECONDS - 0.001))).toBeLessThan(-0.9)
  })

  it('ночью уходит под горизонт', () => {
    expect(Math.sin(sunAngle(CYCLE_SECONDS - 0.001))).toBeLessThan(0)
  })
})

describe('ход часов', () => {
  it('день сменяется ночью на пятидесятой секунде', () => {
    expect(isNight(DAY_SECONDS - 0.001)).toBe(false)
    expect(isNight(DAY_SECONDS)).toBe(true)
  })

  it('кружок заполняется от нуля до единицы за сутки', () => {
    expect(dayProgress(0)).toBe(0)
    expect(dayProgress(CYCLE_SECONDS / 2)).toBeCloseTo(0.5)
    expect(dayProgress(CYCLE_SECONDS)).toBe(1)
  })

  it('сутки кончаются ровно один раз и часы начинаются заново', () => {
    let mornings = 0
    for (let i = 0; i < CYCLE_SECONDS * 10; i++) if (advanceClock(0.1)) mornings++
    expect(mornings).toBe(1)
    expect(getClock()).toBe(0)
  })

  it('resetClock отматывает на утро', () => {
    advanceClock(20)
    resetClock()
    expect(getClock()).toBe(0)
    expect(isNight(getClock())).toBe(false)
  })

  it('подписчик узнаёт о тике, пока не отписался', () => {
    let calls = 0
    const off = subscribeClock(() => calls++)
    advanceClock(1)
    advanceClock(1)
    off()
    advanceClock(1)
    expect(calls).toBe(2)
  })
})
