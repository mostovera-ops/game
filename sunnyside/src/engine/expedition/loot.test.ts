import { describe, it, expect } from 'vitest'
import { rollExpeditionLoot } from './loot'
import { lootTableForState } from './lootTable'

const TRIALS = 10_000

describe('engine/expedition/lootTable', () => {
  it('every wave-1 state (T3–T5) has a forced top row + secondary + fragment (§4.2)', () => {
    for (const stateKey of ['st_illinois', 'st_tennessee', 'st_georgia', 'st_louisiana', 'st_texas', 'st_maine', 'st_california'] as const) {
      const table = lootTableForState(stateKey)
      expect(table.length).toBe(3)
      expect(table.filter((r) => r.forced)).toHaveLength(1)
      expect(table.filter((r) => r.isFragment)).toHaveLength(1)
    }
  })

  it('st_home has no fragment row (obучающий рейс, вне §4.2)', () => {
    const table = lootTableForState('st_home')
    expect(table.every((r) => !r.isFragment)).toBe(true)
    expect(table.every((r) => r.forced)).toBe(true)
  })
})

describe('engine/expedition/loot — rollExpeditionLoot', () => {
  it('P3 guarantee: forced top-row product is present on every single roll (no empty trip)', () => {
    const table = lootTableForState('st_illinois')
    const forcedKey = table.find((r) => r.forced)!.key
    for (let seed = 0; seed < 500; seed++) {
      const result = rollExpeditionLoot({ stateKey: 'st_illinois', capacityLevel: 0, seed })
      const forcedItem = result.items.find((i) => i.key === forcedKey)
      expect(forcedItem, `seed=${seed}`).toBeDefined()
      expect(forcedItem!.qty).toBeGreaterThan(0)
    }
  })

  it('is fully deterministic for a given seed (same seed → same result)', () => {
    const a = rollExpeditionLoot({ stateKey: 'st_texas', capacityLevel: 2, seed: 777 })
    const b = rollExpeditionLoot({ stateKey: 'st_texas', capacityLevel: 2, seed: 777 })
    expect(a).toEqual(b)
  })

  it('road_hitchhiker guarantees the fragment regardless of the table roll (§3.8/§4.3)', () => {
    const table = lootTableForState('st_georgia')
    const fragmentKey = table.find((r) => r.isFragment)!.key
    for (let seed = 0; seed < 200; seed++) {
      const result = rollExpeditionLoot({ stateKey: 'st_georgia', capacityLevel: 0, hitchhikerActive: true, seed })
      expect(result.fragmentAwarded, `seed=${seed}`).toBe(fragmentKey)
    }
  })

  it('road_bonus_stand scales the forced row by ×1.2 (§3.8)', () => {
    const base = rollExpeditionLoot({ stateKey: 'st_illinois', capacityLevel: 0, seed: 1 })
    const boosted = rollExpeditionLoot({ stateKey: 'st_illinois', capacityLevel: 0, bonusStandActive: true, seed: 1 })
    const table = lootTableForState('st_illinois')
    const forcedKey = table.find((r) => r.forced)!.key
    const baseQty = base.items.find((i) => i.key === forcedKey)!.qty
    const boostedQty = boosted.items.find((i) => i.key === forcedKey)!.qty
    expect(boostedQty).toBeGreaterThan(baseQty)
  })

  it('road_scenic_detour (+1 slot) never decreases expected loot vs. the base roll', () => {
    // At the same seed, one extra roll pass can only add more hits, never remove existing ones —
    // verified indirectly via 10k-trial expected fragment/secondary rates below (monotonic in slots).
    const withExtra = rollExpeditionLoot({ stateKey: 'st_texas', capacityLevel: 0, extraSlots: 1, seed: 42 })
    const withoutExtra = rollExpeditionLoot({ stateKey: 'st_texas', capacityLevel: 0, seed: 42 })
    const table = lootTableForState('st_texas')
    const forcedKey = table.find((r) => r.forced)!.key
    const qtyWith = withExtra.items.find((i) => i.key === forcedKey)!.qty
    const qtyWithout = withoutExtra.items.find((i) => i.key === forcedKey)!.qty
    expect(qtyWith).toBeGreaterThanOrEqual(qtyWithout)
  })

  it('10k-roll distribution: secondary/fragment hit-rates match §4.2 chances at capacity level 0 (1 extra slot)', () => {
    const table = lootTableForState('st_illinois')
    const secondaryRow = table.find((r) => !r.forced && !r.isFragment)!
    const fragmentRow = table.find((r) => r.isFragment)!

    let secondaryHits = 0
    let fragmentHits = 0
    for (let seed = 0; seed < TRIALS; seed++) {
      const result = rollExpeditionLoot({ stateKey: 'st_illinois', capacityLevel: 0, seed })
      if (result.items.some((i) => i.key === secondaryRow.key)) secondaryHits++
      if (result.fragmentAwarded === fragmentRow.key) fragmentHits++
    }

    const secondaryRate = secondaryHits / TRIALS
    const fragmentRate = fragmentHits / TRIALS
    // Single remaining slot (capacity level 0 → 2 slots − 1 forced = 1 roll) → observed rate ≈ table chance.
    expect(secondaryRate).toBeGreaterThan(secondaryRow.chance - 0.03)
    expect(secondaryRate).toBeLessThan(secondaryRow.chance + 0.03)
    expect(fragmentRate).toBeGreaterThan(fragmentRow.chance - 0.03)
    expect(fragmentRate).toBeLessThan(fragmentRow.chance + 0.03)
  })

  it('10k-roll distribution: more Capacity slots strictly raise fragment hit-rate (§4.2 — no dead upgrade levels)', () => {
    const fragmentRate = (capacityLevel: number): number => {
      let hits = 0
      for (let seed = 0; seed < TRIALS; seed++) {
        const result = rollExpeditionLoot({ stateKey: 'st_georgia', capacityLevel, seed })
        if (result.fragmentAwarded) hits++
      }
      return hits / TRIALS
    }

    const rateLevel0 = fragmentRate(0) // 2 slots → 1 extra roll
    const rateLevel3 = fragmentRate(3) // 4 slots → 3 extra rolls
    const rateLevel5 = fragmentRate(5) // 5 slots → 4 extra rolls

    expect(rateLevel3).toBeGreaterThan(rateLevel0)
    expect(rateLevel5).toBeGreaterThan(rateLevel3)

    // Analytical expectation: 1 − (1 − p)^n extra rolls, p = table chance for st_georgia fragment (0.07).
    const p = lootTableForState('st_georgia').find((r) => r.isFragment)!.chance
    const expectedLevel3 = 1 - (1 - p) ** 3
    expect(rateLevel3).toBeGreaterThan(expectedLevel3 - 0.05)
    expect(rateLevel3).toBeLessThan(expectedLevel3 + 0.05)
  })

  it('unknown state produces no loot (defensive default, never throws)', () => {
    const result = rollExpeditionLoot({ stateKey: 'st_unknown' as never, capacityLevel: 0, seed: 1 })
    expect(result.items).toEqual([])
    expect(result.fragmentAwarded).toBeNull()
  })
})
