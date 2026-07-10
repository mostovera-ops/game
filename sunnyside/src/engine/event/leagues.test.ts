/**
 * leagues.test.ts — лиги по историческому вкладу + личные сундуки (§3.5, §3.7, §4.5/§4.7).
 * ГАРДРЕЙЛ §4: лига по FP, не по спенду; participation-floor Bronze (EV1). Node.
 */

import { describe, it, expect } from 'vitest'
import {
  leagueForScore,
  leagueByKey,
  chestThreshold,
  chestsUnlocked,
  carryLeagueScore,
} from './index'

describe('leagueForScore — по накопленному за сезон FP §4.7', () => {
  it('пороги пяти лиг', () => {
    expect(leagueForScore(0).key).toBe('lg_sprout')
    expect(leagueForScore(15_000).key).toBe('lg_cook')
    expect(leagueForScore(50_000).key).toBe('lg_chef')
    expect(leagueForScore(120_000).key).toBe('lg_head_chef')
    expect(leagueForScore(260_000).key).toBe('lg_legend')
  })
  it('берёт высшую достигнутую лигу', () => {
    expect(leagueForScore(14_999).key).toBe('lg_sprout')
    expect(leagueForScore(300_000).key).toBe('lg_legend')
  })
  it('отрицательный/ноль → Sprout', () => {
    expect(leagueForScore(-100).key).toBe('lg_sprout')
  })
})

describe('leagueByKey', () => {
  it('находит определение по ключу', () => {
    expect(leagueByKey('lg_chef')?.chestThresholdMult).toBe(1.3)
    expect(leagueByKey('lg_sprout')?.minSeasonFp).toBe(0)
  })
})

describe('chestThreshold — база × множитель лиги, Bronze без множителя §3.5', () => {
  const cook = leagueForScore(15_000) // ×1.15
  const chef = leagueForScore(50_000) // ×1.30
  it('Bronze — participation floor, множитель НЕ применяется', () => {
    expect(chestThreshold('chest_bronze', cook)).toBe(600)
    expect(chestThreshold('chest_bronze', chef)).toBe(600)
  })
  it('Silver+ дорожает с лигой (челлендж сохраняется)', () => {
    expect(chestThreshold('chest_silver', cook)).toBeCloseTo(1840) // 1600×1.15
    expect(chestThreshold('chest_gold', chef)).toBeCloseTo(4160) // 3200×1.30
  })
})

describe('chestsUnlocked §3.5', () => {
  const sprout = leagueForScore(0)
  const legend = leagueForScore(260_000)
  it('нет вклада → нет сундуков', () => {
    expect(chestsUnlocked(0, sprout, false)).toEqual([])
  })
  it('participation floor: ≥1 блюдо → Bronze даже ниже 600 FP и в высшей лиге (EV1)', () => {
    expect(chestsUnlocked(500, legend, true)).toEqual(['chest_bronze'])
  })
  it('накопительно: медианный активный ~2820 FP берёт Silver, тянется к Gold', () => {
    expect(chestsUnlocked(2820, sprout, true)).toEqual(['chest_bronze', 'chest_silver'])
    expect(chestsUnlocked(3200, sprout, true)).toEqual(['chest_bronze', 'chest_silver', 'chest_gold'])
  })
  it('лига поднимает порог Silver+: 1840 нужно в Cook вместо 1600', () => {
    const cook = leagueForScore(15_000)
    expect(chestsUnlocked(1700, cook, true)).toEqual(['chest_bronze']) // 1700 < 1840
    expect(chestsUnlocked(1840, cook, true)).toEqual(['chest_bronze', 'chest_silver'])
  })
})

describe('carryLeagueScore — мягкий перенос 25% между сезонами §3.7', () => {
  it('переносит четверть', () => {
    expect(carryLeagueScore(100_000)).toBe(25_000)
  })
  it('отрицательный → 0', () => {
    expect(carryLeagueScore(-5)).toBe(0)
  })
})
