/**
 * simulation.test.ts — детерминированная очередь смены (09-fair §3.4/§3.5, анти-чит §3.6).
 */

import { describe, it, expect } from 'vitest'
import type { ProductKey } from '@/types/ingredients'

import { makeRng, phaseAt, generateQueue, patienceRemaining } from './simulation'

const POOL = [
  { key: 'crop_cherry' as ProductKey, tier: 3 },
  { key: 'crop_tomato' as ProductKey, tier: 1 },
]

describe('makeRng — детерминированный PRNG', () => {
  it('один seed → одинаковая последовательность', () => {
    const a = makeRng(123)
    const b = makeRng(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('разные seed → разные последовательности', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)())
  })
  it('значения в [0,1)', () => {
    const r = makeRng(999)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('phaseAt — фазы смены (§3.4)', () => {
  it('warm-up 0–60, rush 60–480, last_call 480+', () => {
    expect(phaseAt(0)).toBe('warmup')
    expect(phaseAt(59)).toBe('warmup')
    expect(phaseAt(60)).toBe('rush')
    expect(phaseAt(479)).toBe('rush')
    expect(phaseAt(480)).toBe('last_call')
    expect(phaseAt(700)).toBe('last_call')
  })
})

describe('generateQueue — очередь от seed (§3.5)', () => {
  it('детерминирована: тот же seed → идентичная очередь', () => {
    const q1 = generateQueue({ seed: 42, durationSec: 660, tentLevel: 1, dishPool: POOL })
    const q2 = generateQueue({ seed: 42, durationSec: 660, tentLevel: 1, dishPool: POOL })
    expect(q1).toEqual(q2)
  })
  it('пустой пул стока → пустая очередь (гейт входа F2)', () => {
    expect(generateQueue({ seed: 42, durationSec: 660, tentLevel: 1, dishPool: [] })).toEqual([])
  })
  it('VIP появляются только в Last Call (§3.5 — vipChance>0 лишь там)', () => {
    const guests = generateQueue({ seed: 7, durationSec: 660, tentLevel: 1, dishPool: POOL })
    for (const g of guests) {
      if (g.vip) expect(phaseAt(g.spawnAtMs / 1000)).toBe('last_call')
    }
  })
  it('терпение растёт с уровнем палатки (+2 с с ур.3, §3.6)', () => {
    const l1 = generateQueue({ seed: 5, durationSec: 660, tentLevel: 1, dishPool: POOL })[0]!
    const l3 = generateQueue({ seed: 5, durationSec: 660, tentLevel: 3, dishPool: POOL })[0]!
    expect(l3.patienceSec).toBe(l1.patienceSec + 2)
  })
  it('заказы собраны из реального пула (dishTiers из POOL)', () => {
    const guests = generateQueue({ seed: 3, durationSec: 200, tentLevel: 1, dishPool: POOL })
    const allowed = new Set(POOL.map((p) => p.tier))
    for (const g of guests) for (const t of g.dishTiers) expect(allowed.has(t)).toBe(true)
  })
})

describe('patienceRemaining — остаток терпения [0..1] (§3.5)', () => {
  it('до спавна → 1, на спавне → 1, после истечения → 0', () => {
    const g = generateQueue({ seed: 9, durationSec: 660, tentLevel: 1, dishPool: POOL })[0]!
    const spawnSec = g.spawnAtMs / 1000
    expect(patienceRemaining(g, spawnSec - 1)).toBe(1)
    expect(patienceRemaining(g, spawnSec)).toBe(1)
    expect(patienceRemaining(g, spawnSec + g.patienceSec)).toBe(0)
    expect(patienceRemaining(g, spawnSec + g.patienceSec + 100)).toBe(0)
    expect(patienceRemaining(g, spawnSec + g.patienceSec / 2)).toBeCloseTo(0.5, 1)
  })
})
