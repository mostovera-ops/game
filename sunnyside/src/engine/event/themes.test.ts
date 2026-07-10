/**
 * themes.test.ts — Festival/Drive-in/Harvest множители, freshness, вымпел, versus.
 * §3.6, §3.10–3.12, §3.14, §4.6/§4.9. Node.
 */

import { describe, it, expect } from 'vitest'
import {
  tentForCategory,
  festivalSubGoal,
  festivalBalanceRatio,
  festivalBalanceMultiplier,
  utcHour,
  isEveningWindow,
  driveInMultiplier,
  harvestComboMultiplier,
  varietyStreakBonus,
  themeMultiplier,
  freshness,
  floodThreshold,
  decayRecent,
  streetScore,
  pennantTier,
  townScore,
  versusOutcome,
} from './index'

describe('Festival — палатки и Balance Bonus §3.10', () => {
  it('маршрутизация категорий в палатки', () => {
    expect(tentForCategory('cat_snacks')).toBe('tent_concessions')
    expect(tentForCategory('cat_drinks')).toBe('tent_concessions')
    expect(tentForCategory('cat_grill')).toBe('tent_grill')
    expect(tentForCategory('cat_desserts')).toBe('tent_sweets')
  })
  it('под-цели: Concessions 2/4, Grill/Sweets по 1/4 (сумма = Goal_100)', () => {
    expect(festivalSubGoal('tent_concessions', 140_000)).toBe(70_000)
    expect(festivalSubGoal('tent_grill', 140_000)).toBe(35_000)
    expect(festivalSubGoal('tent_sweets', 140_000)).toBe(35_000)
    const sum =
      festivalSubGoal('tent_concessions', 140_000) +
      festivalSubGoal('tent_grill', 140_000) +
      festivalSubGoal('tent_sweets', 140_000)
    expect(sum).toBe(140_000)
  })
  it('ratio по НОРМИРОВАННЫМ заполнениям (не абсолютный FP)', () => {
    // идеальный баланс: все палатки на 50% своей под-цели → ratio 1
    const balanced = festivalBalanceRatio(
      { tent_concessions: 35_000, tent_grill: 17_500, tent_sweets: 17_500 },
      140_000,
    )
    expect(balanced).toBeCloseTo(1)
    // перекос в Concessions → ratio падает
    const skewed = festivalBalanceRatio(
      { tent_concessions: 70_000, tent_grill: 0, tent_sweets: 0 },
      140_000,
    )
    expect(skewed).toBe(0)
  })
  it('Balance Bonus 1 + 0.25×ratio (идеал → ×1.25)', () => {
    expect(festivalBalanceMultiplier(1)).toBeCloseTo(1.25)
    expect(festivalBalanceMultiplier(0)).toBeCloseTo(1.0)
    expect(festivalBalanceMultiplier(0.5)).toBeCloseTo(1.125)
  })
})

describe('Drive-in — evening window 18:00–02:00 UTC §3.11', () => {
  it('час UTC из времени', () => {
    expect(utcHour(Date.UTC(2026, 0, 1, 20, 0, 0))).toBe(20)
  })
  it('окно оборачивается через полночь', () => {
    expect(isEveningWindow(18)).toBe(true)
    expect(isEveningWindow(23)).toBe(true)
    expect(isEveningWindow(0)).toBe(true)
    expect(isEveningWindow(1)).toBe(true)
    expect(isEveningWindow(2)).toBe(false)
    expect(isEveningWindow(12)).toBe(false)
  })
  it('снеки/напитки ×1.5 вечером, иначе ×1.0', () => {
    const evening = Date.UTC(2026, 0, 1, 20, 0, 0)
    const noon = Date.UTC(2026, 0, 1, 12, 0, 0)
    expect(driveInMultiplier('cat_snacks', evening)).toBe(1.5)
    expect(driveInMultiplier('cat_drinks', evening)).toBe(1.5)
    expect(driveInMultiplier('cat_grill', evening)).toBe(1.0) // не фокус-категория
    expect(driveInMultiplier('cat_snacks', noon)).toBe(1.0) // не вечер
  })
})

describe('Harvest — combo и variety §3.11', () => {
  it('Blue Plate combo ×1.5', () => {
    expect(harvestComboMultiplier(true)).toBe(1.5)
    expect(harvestComboMultiplier(false)).toBe(1.0)
  })
  it('Variety Streak: все 4 категории → +10% личного FP', () => {
    const all = new Set(['cat_snacks', 'cat_grill', 'cat_desserts', 'cat_drinks'] as const)
    expect(varietyStreakBonus(all)).toBeCloseTo(1.1)
    expect(varietyStreakBonus(new Set(['cat_snacks'] as const))).toBe(1.0)
  })
})

describe('themeMultiplier — диспетчер M_theme §3.3', () => {
  it('Glutton → фазовый/Grand Craving', () => {
    expect(themeMultiplier('ev_glutton', 'cat_desserts', { phaseIndex: 0 })).toBe(2.0)
    expect(themeMultiplier('ev_glutton', 'cat_grill', { grandCraving: 'cat_grill' })).toBe(3.0)
  })
  it('Festival → balance multiplier', () => {
    expect(themeMultiplier('ev_big_festival', 'cat_grill', { balanceRatio: 1 })).toBeCloseTo(1.25)
  })
  it('Harvest → combo', () => {
    expect(themeMultiplier('ev_harvest_homecoming', 'cat_grill', { isCombo: true })).toBe(1.5)
  })
  it('Drive-in → evening window (нужен now)', () => {
    expect(
      themeMultiplier('ev_drivein_night', 'cat_snacks', { now: Date.UTC(2026, 0, 1, 20) }),
    ).toBe(1.5)
    expect(themeMultiplier('ev_drivein_night', 'cat_snacks')).toBe(1.0) // без now
  })
  it('Showdown → нейтральная шкала ×1.0', () => {
    expect(themeMultiplier('ev_state_fair_showdown', 'cat_grill')).toBe(1.0)
  })
})

describe('freshness — F(category) анти-флуд §3.14', () => {
  it('норма потока (≤8% Goal_100) → F=1.0', () => {
    expect(floodThreshold(140_000)).toBeCloseTo(11_200) // 8%
    expect(freshness(0, 140_000)).toBeCloseTo(1.0)
    expect(freshness(11_200, 140_000)).toBeCloseTo(0.5) // ровно порог → F по формуле
  })
  it('двойной перекорм → пол 0.5 (категорию не «убить»)', () => {
    expect(freshness(11_200, 140_000)).toBeCloseTo(0.5)
    expect(freshness(50_000, 140_000)).toBe(0.5) // клампится к полу
  })
  it('промежуточный перекорм между 1.0 и 0.5', () => {
    // recent = 5600 (половина порога) → 1 − 0.5×0.5 = 0.75
    expect(freshness(5_600, 140_000)).toBeCloseTo(0.75)
  })
  it('нулевая цель → F=1.0 (защита от деления)', () => {
    expect(freshness(100, 0)).toBe(1.0)
  })
})

describe('decayRecent — линейное восстановление за 120 мин §3.14', () => {
  const HOUR = 3_600_000
  it('полное восстановление за 120 мин', () => {
    expect(decayRecent(1000, 2 * HOUR)).toBe(0)
  })
  it('половина окна → половина остатка', () => {
    expect(decayRecent(1000, HOUR)).toBeCloseTo(500)
  })
  it('без времени — без затухания', () => {
    expect(decayRecent(1000, 0)).toBe(1000)
  })
})

describe('streetScore / pennantTier — вымпел per-capita §3.6/§4.6', () => {
  it('делитель — размер ростера (не активные)', () => {
    expect(streetScore(30_000, 10)).toBe(3000)
  })
  it('min_floor=5 гасит микро-стрит', () => {
    expect(streetScore(3000, 2)).toBe(600) // /max(2,5)=/5
  })
  it('добавление вкладчика не роняет score (числитель растёт, знаменатель фикс)', () => {
    expect(streetScore(31_000, 10)).toBeGreaterThan(streetScore(30_000, 10))
  })
  it('пороговые вымпелы Bronze/Silver/Gold', () => {
    expect(pennantTier(4000)).toBe('pennant_gold')
    expect(pennantTier(2500)).toBe('pennant_silver')
    expect(pennantTier(1500)).toBe('pennant_bronze')
    expect(pennantTier(1499)).toBeNull()
  })
})

describe('versus — State Fair Showdown per-capita §3.12', () => {
  it('TownScore = Σ FP / max(active, 30)', () => {
    expect(townScore(300_000, 100)).toBe(3000)
    expect(townScore(300_000, 10)).toBe(10_000) // /max(10,30)=/30
  })
  it('исход по per-capita; ничья → win обоим (позитив-сум P3)', () => {
    expect(versusOutcome(3000, 2000)).toBe('versus_win')
    expect(versusOutcome(2000, 3000)).toBe('versus_lose')
    expect(versusOutcome(3000, 3000)).toBe('versus_win')
  })
})
