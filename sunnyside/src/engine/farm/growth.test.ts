import { describe, expect, it } from 'vitest'
import {
  effectiveGrowMs,
  computeReadyAt,
  weedIgnorePenaltyMs,
  isWithinWateringWindow,
} from './growth'

describe('effectiveGrowMs — множитель тира грядки (§3.3)', () => {
  const baseGrowSec = 600 // 10 мин, T1-масштаб

  it('tier 0 (Basic) — без изменений', () => {
    expect(effectiveGrowMs(baseGrowSec, 0)).toBe(600_000)
  })

  it('tier 1 (Tilled) — −8%', () => {
    expect(effectiveGrowMs(baseGrowSec, 1)).toBe(Math.round(600_000 * 0.92))
  })

  it('tier 2 (Raised) — −15%', () => {
    expect(effectiveGrowMs(baseGrowSec, 2)).toBe(Math.round(600_000 * 0.85))
  })

  it('tier 3 (Irrigated) — −22%', () => {
    expect(effectiveGrowMs(baseGrowSec, 3)).toBe(Math.round(600_000 * 0.78))
  })

  it('выше тир — короче цикл (монотонность)', () => {
    const d0 = effectiveGrowMs(baseGrowSec, 0)
    const d1 = effectiveGrowMs(baseGrowSec, 1)
    const d2 = effectiveGrowMs(baseGrowSec, 2)
    const d3 = effectiveGrowMs(baseGrowSec, 3)
    expect(d0).toBeGreaterThan(d1)
    expect(d1).toBeGreaterThan(d2)
    expect(d2).toBeGreaterThan(d3)
  })

  it('кидает RangeError на отрицательный growSec', () => {
    expect(() => effectiveGrowMs(-1, 0)).toThrow(RangeError)
  })
})

describe('computeReadyAt', () => {
  it('readyAt = plantedAt + effectiveGrowMs', () => {
    const plantedAt = 1_000_000
    const readyAt = computeReadyAt(plantedAt, 600, 0)
    expect(readyAt).toBe(plantedAt + 600_000)
  })

  it('более высокий тир грядки даёт более ранний readyAt при том же plantedAt', () => {
    const plantedAt = 0
    const basic = computeReadyAt(plantedAt, 600, 0)
    const irrigated = computeReadyAt(plantedAt, 600, 3)
    expect(irrigated).toBeLessThan(basic)
  })
})

describe('weedIgnorePenaltyMs — +10% времени цикла при полном игноре grace (§3.4)', () => {
  it('составляет ровно 10% от effectiveGrowMs', () => {
    const baseGrowSec = 1200
    expect(weedIgnorePenaltyMs(baseGrowSec, 0)).toBe(
      Math.round(effectiveGrowMs(baseGrowSec, 0) * 0.1),
    )
  })

  it('никогда не отрицательный', () => {
    expect(weedIgnorePenaltyMs(60, 3)).toBeGreaterThanOrEqual(0)
  })
})

describe('isWithinWateringWindow — первые 50% таймера (§3.4, гипотеза)', () => {
  const plantedAt = 1_000_000
  const readyAt = plantedAt + 10_000 // 10с цикл

  it('true в самом начале', () => {
    expect(isWithinWateringWindow(plantedAt, readyAt, plantedAt)).toBe(true)
  })

  it('true ровно на границе 50%', () => {
    expect(isWithinWateringWindow(plantedAt, readyAt, plantedAt + 5_000)).toBe(true)
  })

  it('false сразу после границы 50%', () => {
    expect(isWithinWateringWindow(plantedAt, readyAt, plantedAt + 5_001)).toBe(false)
  })

  it('false до посева (now < plantedAt)', () => {
    expect(isWithinWateringWindow(plantedAt, readyAt, plantedAt - 1)).toBe(false)
  })

  it('false для вырожденного нулевого/отрицательного цикла', () => {
    expect(isWithinWateringWindow(plantedAt, plantedAt, plantedAt)).toBe(false)
  })
})
