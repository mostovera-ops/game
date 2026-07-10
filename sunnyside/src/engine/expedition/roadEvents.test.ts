import { describe, it, expect } from 'vitest'
import { rollRoadEvent, rollRoadEventForTrip } from './roadEvents'
import { ROAD_EVENTS, ROAD_EVENT_WEIGHT_TOTAL } from './constants'

describe('engine/expedition/roadEvents', () => {
  it('weights sum to 100 (§3.8/§4.4 invariant)', () => {
    expect(ROAD_EVENT_WEIGHT_TOTAL).toBe(100)
  })

  it('rollRoadEvent is deterministic for a given seed', () => {
    const a = rollRoadEvent(12345)
    const b = rollRoadEvent(12345)
    expect(a).toBe(b)
  })

  it('rollRoadEventForTrip always returns road_quiet_trip for Truck Contract runs (§3.6/§4.4)', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(rollRoadEventForTrip(seed, true)).toBe('road_quiet_trip')
    }
  })

  it('10k-roll distribution matches §3.8 weights within tolerance', () => {
    const trials = 10_000
    const counts = new Map<string, number>()
    for (let seed = 0; seed < trials; seed++) {
      const event = rollRoadEvent(seed)
      counts.set(event, (counts.get(event) ?? 0) + 1)
    }

    // Every declared event key must appear at least once over 10k rolls (P3 — real variety, no dead entries).
    for (const def of ROAD_EVENTS) {
      const observed = counts.get(def.key) ?? 0
      const expected = (def.weight / 100) * trials
      // ±4 percentage points absolute tolerance around expected share (loose but catches gross skew/bugs).
      const tolerance = 0.04 * trials
      expect(observed, `${def.key}: observed=${observed} expected≈${expected}`).toBeGreaterThan(expected - tolerance)
      expect(observed, `${def.key}: observed=${observed} expected≈${expected}`).toBeLessThan(expected + tolerance)
    }

    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(trials)
  })
})
