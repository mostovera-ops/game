import { describe, it, expect } from 'vitest'
import {
  capacityLevelDef,
  routeSlotsAtLevel,
  routeSlotsUpgradeCost,
  speedUpgradeCost,
  speedUpgradeCostDimes,
  totalRouteSlots,
} from './upgrades'

describe('engine/expedition/upgrades', () => {
  it('speedUpgradeCost matches §3.4.1 table', () => {
    expect(speedUpgradeCost(0)).toBe(0)
    expect(speedUpgradeCost(1)).toBe(800)
    expect(speedUpgradeCost(5)).toBe(45_000)
  })

  it('speedUpgradeCostDimes only charges ◉ at max level (§3.4.1)', () => {
    expect(speedUpgradeCostDimes(4)).toBe(0)
    expect(speedUpgradeCostDimes(5)).toBe(200)
  })

  it('capacityLevelDef matches §3.4.2 table (slots/multiplier/cost)', () => {
    expect(capacityLevelDef(0)).toEqual({ slots: 2, multiplier: 1.0, cost: 0 })
    expect(capacityLevelDef(3)).toEqual({ slots: 4, multiplier: 1.8, cost: 9_000 })
    expect(capacityLevelDef(5)).toEqual({ slots: 5, multiplier: 2.5, cost: 50_000 })
  })

  it('routeSlotsAtLevel/cost matches §3.4.3 (level 1 = base, 1 slot, 0 cost)', () => {
    expect(routeSlotsAtLevel(1)).toBe(1)
    expect(routeSlotsAtLevel(2)).toBe(2)
    expect(routeSlotsAtLevel(3)).toBe(3)
    expect(routeSlotsUpgradeCost(1)).toBe(0)
    expect(routeSlotsUpgradeCost(2)).toBe(15_000)
    expect(routeSlotsUpgradeCost(3)).toBe(60_000)
  })

  it('totalRouteSlots adds staff_buck bonus beyond max upgrade level (§3.4.3, practical cap 4)', () => {
    expect(totalRouteSlots(3, true)).toBe(4)
    expect(totalRouteSlots(3, false)).toBe(3)
    expect(totalRouteSlots(1, false)).toBe(1)
  })

  it('out-of-range levels clamp instead of throwing/returning undefined', () => {
    expect(() => capacityLevelDef(99)).not.toThrow()
    expect(capacityLevelDef(99)).toEqual(capacityLevelDef(5))
    expect(() => routeSlotsAtLevel(-1)).not.toThrow()
  })
})
