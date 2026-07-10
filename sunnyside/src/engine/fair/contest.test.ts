/**
 * contest.test.ts — юниты формул конкурсов (09-fair §3.7/§3.8/§4.7).
 * Node без браузера. Веса §3.8, метрика Giant Vegetable §4.7, брекеты/схлопывание §3.7/F8.
 */

import { describe, it, expect } from 'vitest'

import {
  contestScore,
  voteShare,
  giantVegScore,
  divisionForFarmValue,
  collapseDivisions,
  rankDivision,
  type ScoredEntry,
} from './contest'

describe('contestScore — W_npc·NPC + W_vote·VoteShare (§3.8)', () => {
  it('pie_week 0.5/0.5 — баланс качество↔голоса', () => {
    // npc 80/100 → 0.8, voteShare 0.5 → 0.5×0.8 + 0.5×0.5 = 0.65
    expect(contestScore('ct_pie_week', 80, 0.5)).toBeCloseTo(0.65)
  })
  it('giant_veg 1.0/0.0 — только NPC-метрика, голоса игнорятся', () => {
    expect(contestScore('ct_giant_veg', 100, 0)).toBeCloseTo(1.0)
    expect(contestScore('ct_giant_veg', 100, 0.9)).toBeCloseTo(1.0) // голоса не влияют
  })
  it('best_window 0.0/1.0 — только голоса', () => {
    expect(contestScore('ct_best_window', 100, 0.4)).toBeCloseTo(0.4)
    expect(contestScore('ct_best_window', 0, 0.4)).toBeCloseTo(0.4) // NPC не влияет
  })
})

describe('voteShare — доля голосов (§3.8)', () => {
  it('доля от всех голосов; пустой конкурс → 0', () => {
    expect(voteShare(3, 10)).toBeCloseTo(0.3)
    expect(voteShare(1, 0)).toBe(0)
  })
})

describe('giantVegScore — детерминированный вес (§4.7)', () => {
  it('идеальная тыква пробивает потолок в raw, клампится к W_cap, finalScore=1.0', () => {
    const r = giantVegScore({ crop: 'pumpkin', fertilizerTicks: 6, qualityMult: 1.5, agronomyBonus: 1.25 })
    expect(r.weightRaw).toBeGreaterThan(20)
    expect(r.weight).toBe(20)
    expect(r.finalScore).toBeCloseTo(1.0)
  })
  it('нормировка честна между культурами: идеальный кабачок = идеальная тыква = 1.0', () => {
    const pumpkin = giantVegScore({ crop: 'pumpkin', fertilizerTicks: 6, qualityMult: 1.5, agronomyBonus: 1.25 })
    const zucchini = giantVegScore({ crop: 'zucchini', fertilizerTicks: 6, qualityMult: 1.5, agronomyBonus: 1.25 })
    expect(pumpkin.finalScore).toBeCloseTo(zucchini.finalScore)
  })
  it('скромная тыква (без удобрения/бонусов) → 8/20 = 0.4', () => {
    const r = giantVegScore({ crop: 'pumpkin', fertilizerTicks: 0, qualityMult: 1, agronomyBonus: 1 })
    expect(r.weightRaw).toBeCloseTo(8)
    expect(r.finalScore).toBeCloseTo(0.4)
  })
  it('анти-P2W: сверх-удобрение не даёт балл >1.0 (кламп до нормировки, D11)', () => {
    const r = giantVegScore({ crop: 'pumpkin', fertilizerTicks: 999, qualityMult: 9, agronomyBonus: 9 })
    expect(r.finalScore).toBeCloseTo(1.0)
    expect(r.finalScore).toBeLessThanOrEqual(1.0)
  })
})

describe('divisionForFarmValue — брекеты по третям (§3.7)', () => {
  it('нижняя → bronze, средняя → silver, верхняя → gold', () => {
    expect(divisionForFarmValue(50, 100, 200)).toBe('bronze')
    expect(divisionForFarmValue(150, 100, 200)).toBe('silver')
    expect(divisionForFarmValue(250, 100, 200)).toBe('gold')
    expect(divisionForFarmValue(200, 100, 200)).toBe('gold') // на границе верхней трети
  })
})

function mkEntries(counts: { bronze: number; silver: number; gold: number }): ScoredEntry[] {
  const out: ScoredEntry[] = []
  const push = (div: 'bronze' | 'silver' | 'gold', n: number): void => {
    for (let i = 0; i < n; i++) out.push({ id: `${div}${i}`, playerId: `p_${div}${i}`, division: div, score: Math.random() })
  }
  push('bronze', counts.bronze)
  push('silver', counts.silver)
  push('gold', counts.gold)
  return out
}

describe('collapseDivisions — схлопывание вверх при <6 заявках (§3.7/F8)', () => {
  it('полные дивизионы (≥6) не сливаются', () => {
    const e = collapseDivisions(mkEntries({ bronze: 8, silver: 8, gold: 8 }))
    expect(e.filter((x) => x.division === 'bronze')).toHaveLength(8)
    expect(e.filter((x) => x.division === 'silver')).toHaveLength(8)
    expect(e.filter((x) => x.division === 'gold')).toHaveLength(8)
  })
  it('малый bronze вливается в silver, если объединение достигает 6', () => {
    const e = collapseDivisions(mkEntries({ bronze: 3, silver: 3, gold: 10 }))
    expect(e.filter((x) => x.division === 'bronze')).toHaveLength(0)
    expect(e.filter((x) => x.division === 'silver')).toHaveLength(6)
    expect(e.filter((x) => x.division === 'gold')).toHaveLength(10)
  })
  it('оба малых (bronze+silver <6) вливаются в gold', () => {
    const e = collapseDivisions(mkEntries({ bronze: 2, silver: 2, gold: 10 }))
    expect(e.filter((x) => x.division === 'gold')).toHaveLength(14)
    expect(e.filter((x) => x.division !== 'gold')).toHaveLength(0)
  })
})

describe('rankDivision — ранжирование и ленты (§4.8)', () => {
  it('1-е место Blue Ribbon, 2–3 Honorable Mention, сорт по score убыв.', () => {
    const entries: ScoredEntry[] = [
      { id: 'a', playerId: 'pa', division: 'gold', score: 0.5 },
      { id: 'b', playerId: 'pb', division: 'gold', score: 0.9 },
      { id: 'c', playerId: 'pc', division: 'gold', score: 0.7 },
      { id: 'd', playerId: 'pd', division: 'gold', score: 0.1 },
    ]
    const ranked = rankDivision(entries).sort((x, y) => x.rank - y.rank)
    expect(ranked[0]!.id).toBe('b')
    expect(ranked[0]!.blueRibbon).toBe(true)
    expect(ranked[1]!.id).toBe('c')
    expect(ranked[1]!.honorableMention).toBe(true)
    expect(ranked[2]!.honorableMention).toBe(true)
    expect(ranked[3]!.blueRibbon).toBe(false)
    expect(ranked[3]!.honorableMention).toBe(false)
  })
  it('тай-брейк по tieBreak при равном score (§4.7 — больший raw вес выше)', () => {
    const entries: ScoredEntry[] = [
      { id: 'lo', playerId: 'p1', division: 'silver', score: 1.0, tieBreak: 22 },
      { id: 'hi', playerId: 'p2', division: 'silver', score: 1.0, tieBreak: 28.5 },
    ]
    const ranked = rankDivision(entries).sort((x, y) => x.rank - y.rank)
    expect(ranked[0]!.id).toBe('hi')
  })
  it('дивизионы ранжируются независимо (своя таблица)', () => {
    const entries: ScoredEntry[] = [
      { id: 'g1', playerId: 'pg1', division: 'gold', score: 0.3 },
      { id: 's1', playerId: 'ps1', division: 'silver', score: 0.9 },
    ]
    const ranked = rankDivision(entries)
    // Оба — первые в своих дивизионах.
    expect(ranked.find((r) => r.id === 'g1')!.rank).toBe(1)
    expect(ranked.find((r) => r.id === 's1')!.rank).toBe(1)
  })
})
