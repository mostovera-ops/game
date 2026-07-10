import { describe, it, expect } from 'vitest'
import { baseDurationHours, expeditionDurationMs, speedReduction, totalDurationReduction } from './duration'
import { HOUR_MS, MAX_TOTAL_DURATION_REDUCTION } from './constants'

describe('engine/expedition/duration', () => {
  it('base duration matches §3.2/§4.5 wave-1 anchors', () => {
    expect(baseDurationHours('st_home')).toBe(4)
    expect(baseDurationHours('st_illinois')).toBe(6)
    expect(baseDurationHours('st_tennessee')).toBe(6)
    expect(baseDurationHours('st_maine')).toBe(18)
    expect(baseDurationHours('st_california')).toBe(24)
  })

  it('T4 average across wave-1 stops matches §4.5 (13h)', () => {
    const avg = (baseDurationHours('st_georgia') + baseDurationHours('st_louisiana') + baseDurationHours('st_texas')) / 3
    expect(avg).toBe(13)
  })

  it('speedReduction follows §3.4.1 table and clamps out-of-range levels', () => {
    expect(speedReduction(0)).toBe(0)
    expect(speedReduction(1)).toBeCloseTo(0.10)
    expect(speedReduction(5)).toBeCloseTo(0.40)
    expect(speedReduction(99)).toBeCloseTo(0.40) // clamp to max level
    expect(speedReduction(-1)).toBe(0)
    expect(speedReduction(1.5)).toBe(0) // non-integer level → 0 (invalid)
  })

  it('totalDurationReduction sums all three terms and caps at 55% (§4.1/O7)', () => {
    const reduction = totalDurationReduction({ speedLevel: 5, hasStaffGus: true, closedRegionsCoveringStop: 0 })
    expect(reduction).toBeCloseTo(0.55) // 0.40 + 0.15 = 0.55, exactly at cap
    const overCap = totalDurationReduction({ speedLevel: 5, hasStaffGus: true, closedRegionsCoveringStop: 3 })
    expect(overCap).toBe(MAX_TOTAL_DURATION_REDUCTION) // 0.40+0.15+0.15=0.70 → capped to 0.55
  })

  it('expeditionDurationMs applies base × (1−reduction) × truck-contract multiplier', () => {
    const base = expeditionDurationMs({
      stateKey: 'st_illinois',
      speedLevel: 0,
      hasStaffGus: false,
      closedRegionsCoveringStop: 0,
    })
    expect(base).toBe(6 * HOUR_MS)

    const withSpeed = expeditionDurationMs({
      stateKey: 'st_illinois',
      speedLevel: 1,
      hasStaffGus: false,
      closedRegionsCoveringStop: 0,
    })
    expect(withSpeed).toBe(Math.round(6 * HOUR_MS * 0.90))

    const contract = expeditionDurationMs({
      stateKey: 'st_illinois',
      speedLevel: 0,
      hasStaffGus: false,
      closedRegionsCoveringStop: 0,
      isTruckContract: true,
    })
    expect(contract).toBe(Math.round(6 * HOUR_MS * 0.5))
  })

  it('unknown stateKey falls back to st_home base duration (never NaN/undefined)', () => {
    const ms = expeditionDurationMs({
      stateKey: 'st_unknown' as never,
      speedLevel: 0,
      hasStaffGus: false,
      closedRegionsCoveringStop: 0,
    })
    expect(ms).toBe(4 * HOUR_MS)
  })
})
