import { describe, expect, it } from 'vitest'
import {
  SELECT_CHANCE_BASE,
  SELECT_CHANCE_CAP,
  CARE_BONUS_MAX,
  FERTILIZER_QUALITY_BONUS,
  AGRONOMY_BONUS_BY_LEVEL,
  selectChance,
} from './quality'

describe('selectChance — база и отсутствие ухода (§3.6/§4.3)', () => {
  it('без ухода/бонусов равна базовым 10%', () => {
    expect(selectChance({ plotTier: 0 })).toBeCloseTo(SELECT_CHANCE_BASE, 10)
  })

  it('минимальный исход всегда normal-доступен: P(Select) никогда не 100%', () => {
    expect(
      selectChance({
        wateredOnTime: true,
        weededResolved: true,
        crowsShooed: true,
        qualityFertilizerApplied: true,
        plotTier: 3,
        agronomyLevel: 6,
      }),
    ).toBeLessThan(1)
  })
})

describe('selectChance — аддитивные вклады ухода', () => {
  it('полив вовремя добавляет +15%', () => {
    expect(selectChance({ plotTier: 0, wateredOnTime: true })).toBeCloseTo(
      SELECT_CHANCE_BASE + CARE_BONUS_MAX.wateredOnTime,
      10,
    )
  })

  it('прополка решена добавляет +10%', () => {
    expect(selectChance({ plotTier: 0, weededResolved: true })).toBeCloseTo(
      SELECT_CHANCE_BASE + CARE_BONUS_MAX.weededResolved,
      10,
    )
  })

  it('вороны отогнаны добавляют +10%', () => {
    expect(selectChance({ plotTier: 0, crowsShooed: true })).toBeCloseTo(
      SELECT_CHANCE_BASE + CARE_BONUS_MAX.crowsShooed,
      10,
    )
  })

  it('все три ухода вместе дают +35% (care_bonus максимум)', () => {
    const careTotal =
      CARE_BONUS_MAX.wateredOnTime + CARE_BONUS_MAX.weededResolved + CARE_BONUS_MAX.crowsShooed
    expect(careTotal).toBeCloseTo(0.35, 10)
    expect(
      selectChance({
        plotTier: 0,
        wateredOnTime: true,
        weededResolved: true,
        crowsShooed: true,
      }),
    ).toBeCloseTo(SELECT_CHANCE_BASE + careTotal, 10)
  })
})

describe('selectChance — удобрение, тир грядки, агрономия', () => {
  it('Quality Fertilizer добавляет +20%', () => {
    expect(selectChance({ plotTier: 0, qualityFertilizerApplied: true })).toBeCloseTo(
      SELECT_CHANCE_BASE + FERTILIZER_QUALITY_BONUS,
      10,
    )
  })

  it('тир грядки добавляет 5/10/15% (Tilled/Raised/Irrigated)', () => {
    expect(selectChance({ plotTier: 1 })).toBeCloseTo(SELECT_CHANCE_BASE + 0.05, 10)
    expect(selectChance({ plotTier: 2 })).toBeCloseTo(SELECT_CHANCE_BASE + 0.1, 10)
    expect(selectChance({ plotTier: 3 })).toBeCloseTo(SELECT_CHANCE_BASE + 0.15, 10)
  })

  it('агрономия добавляет 5/10/15% на тирах 2/4/6 дерева', () => {
    expect(selectChance({ plotTier: 0, agronomyLevel: 2 })).toBeCloseTo(
      SELECT_CHANCE_BASE + AGRONOMY_BONUS_BY_LEVEL[2],
      10,
    )
    expect(selectChance({ plotTier: 0, agronomyLevel: 4 })).toBeCloseTo(
      SELECT_CHANCE_BASE + AGRONOMY_BONUS_BY_LEVEL[4],
      10,
    )
    expect(selectChance({ plotTier: 0, agronomyLevel: 6 })).toBeCloseTo(
      SELECT_CHANCE_BASE + AGRONOMY_BONUS_BY_LEVEL[6],
      10,
    )
  })

  it('agronomyLevel=0 не даёт бонуса', () => {
    expect(selectChance({ plotTier: 0, agronomyLevel: 0 })).toBeCloseTo(SELECT_CHANCE_BASE, 10)
  })
})

describe('selectChance — CAP 90% (§3.6)', () => {
  it('максимум всех источников капается на 90%, не выше', () => {
    const maxed = selectChance({
      wateredOnTime: true,
      weededResolved: true,
      crowsShooed: true,
      qualityFertilizerApplied: true,
      plotTier: 3,
      agronomyLevel: 6,
    })
    // Сырая сумма без капа: 10 + 35 + 20 + 15 + 15 = 95% > 90% — проверяем, что капается.
    expect(maxed).toBe(SELECT_CHANCE_CAP)
  })

  it('сумма без капа действительно превышает 90% (проверка, что кап реально срабатывает)', () => {
    const raw =
      SELECT_CHANCE_BASE +
      CARE_BONUS_MAX.wateredOnTime +
      CARE_BONUS_MAX.weededResolved +
      CARE_BONUS_MAX.crowsShooed +
      FERTILIZER_QUALITY_BONUS +
      0.15 + // plot tier max (Irrigated)
      AGRONOMY_BONUS_BY_LEVEL[6]
    expect(raw).toBeGreaterThan(SELECT_CHANCE_CAP)
  })
})
