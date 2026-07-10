import { describe, it, expect } from 'vitest'
import {
  masteryTierFor,
  nextMasteryTier,
  craftsToNextStar,
  masteryProgress,
  applyMasteryTime,
  applyMasteryPrice,
  RECIPE_MASTERY_CURVE,
} from './mastery'

describe('masteryTierFor (06-recipes R18 §3.3 curve)', () => {
  it('★1 (база) на 0 приготовлений', () => {
    expect(masteryTierFor(0).stars).toBe(1)
  })

  it('остаётся ★1 до порога ★2 (9 приготовлений)', () => {
    expect(masteryTierFor(9).stars).toBe(1)
  })

  it('переходит в ★2 ровно на пороге (10)', () => {
    expect(masteryTierFor(10).stars).toBe(2)
  })

  it('★3 на 30, ★4 на 75, ★5 на 150', () => {
    expect(masteryTierFor(30).stars).toBe(3)
    expect(masteryTierFor(75).stars).toBe(4)
    expect(masteryTierFor(150).stars).toBe(5)
  })

  it('остаётся на ★5 сколь угодно далеко', () => {
    expect(masteryTierFor(1_000_000).stars).toBe(5)
  })

  it('монотонна: тир не убывает при росте счётчика', () => {
    let prevStars = 0
    for (let n = 0; n <= 200; n++) {
      const stars = masteryTierFor(n).stars
      expect(stars).toBeGreaterThanOrEqual(prevStars)
      prevStars = stars
    }
  })
})

describe('nextMasteryTier / craftsToNextStar', () => {
  it('на ★1 следующий — ★2 через 10', () => {
    expect(nextMasteryTier(0)?.stars).toBe(2)
    expect(craftsToNextStar(0)).toBe(10)
  })

  it('на максимуме (★5) следующего тира нет', () => {
    expect(nextMasteryTier(150)).toBeNull()
    expect(craftsToNextStar(150)).toBe(0)
  })

  it('craftsToNextStar никогда не отрицателен', () => {
    for (const n of [0, 5, 10, 29, 30, 74, 75, 149, 150, 151]) {
      expect(craftsToNextStar(n)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('masteryProgress', () => {
  it('fraction в [0,1] на любом входе', () => {
    for (const n of [0, 1, 9, 10, 15, 29, 30, 74, 75, 149, 150, 500]) {
      const p = masteryProgress(n)
      expect(p.fraction).toBeGreaterThanOrEqual(0)
      expect(p.fraction).toBeLessThanOrEqual(1)
    }
  })

  it('fraction=1 на максимуме', () => {
    expect(masteryProgress(150).fraction).toBe(1)
    expect(masteryProgress(9999).fraction).toBe(1)
  })
})

describe('applyMasteryTime / applyMasteryPrice (модификаторы каталога, не переопределяем числа)', () => {
  it('на ★1 не меняют базу', () => {
    expect(applyMasteryTime(100, 0)).toBe(100)
    expect(applyMasteryPrice(10, 0)).toBe(10)
  })

  it('на ★5 применяют финальные -20%/+25% из каталога', () => {
    const tier5 = RECIPE_MASTERY_CURVE.find((t) => t.stars === 5)!
    expect(applyMasteryTime(100, 150)).toBeCloseTo(100 * (1 + tier5.timeBonusPct / 100), 6)
    expect(applyMasteryPrice(10, 150)).toBeCloseTo(10 * (1 + tier5.priceBonusPct / 100), 6)
  })

  it('никогда не уходят в минус', () => {
    expect(applyMasteryTime(0, 150)).toBeGreaterThanOrEqual(0)
    expect(applyMasteryPrice(0, 150)).toBeGreaterThanOrEqual(0)
  })
})
