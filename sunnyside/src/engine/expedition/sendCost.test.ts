import { describe, it, expect } from 'vitest'
import { averageSendCost, dimesSpeedupCost, sendCostRange, sendCostTierKey } from './sendCost'

describe('engine/expedition/sendCost', () => {
  it('sendCostTierKey maps tiers to §3.5 buckets', () => {
    expect(sendCostTierKey(1)).toBe('T1_T2')
    expect(sendCostTierKey(2)).toBe('T1_T2')
    expect(sendCostTierKey(3)).toBe('T3')
    expect(sendCostTierKey(4)).toBe('T4')
    expect(sendCostTierKey(5)).toBe('T5')
  })

  it('sendCostRange matches §3.5 table', () => {
    expect(sendCostRange(3)).toEqual({ min: 150, max: 250, dimesPerHalfHour: 1, dimesCap: 40 })
    expect(sendCostRange(5)).toEqual({ min: 900, max: 1_400, dimesPerHalfHour: 1, dimesCap: 150 })
  })

  it('averageSendCost matches §4.5 summary (T3≈200, T4≈550, T5≈1150)', () => {
    expect(averageSendCost(3)).toBe(200)
    expect(averageSendCost(4)).toBe(550)
    expect(averageSendCost(5)).toBe(1_150)
  })

  it('st_home (T1–T2) is free — no send cost, no dimes speedup', () => {
    expect(averageSendCost(1)).toBe(0)
    expect(dimesSpeedupCost(1, 4 * 60 * 60_000)).toBe(0)
  })

  it('dimesSpeedupCost rounds started half-hours up and respects the per-tier cap', () => {
    // 1h remaining = 2 started half-hours → ◉2 at T3 rate 1/30min.
    expect(dimesSpeedupCost(3, 60 * 60_000)).toBe(2)
    // 1 minute remaining still counts as one started half-hour → ◉1.
    expect(dimesSpeedupCost(3, 60_000)).toBe(1)
    // huge remaining time is capped at the tier's dimesCap (§3.5).
    expect(dimesSpeedupCost(3, 100 * 60 * 60_000)).toBe(40)
    expect(dimesSpeedupCost(5, 100 * 60 * 60_000)).toBe(150)
  })

  it('zero or negative remaining time costs nothing', () => {
    expect(dimesSpeedupCost(4, 0)).toBe(0)
    expect(dimesSpeedupCost(4, -1)).toBe(0)
  })
})
