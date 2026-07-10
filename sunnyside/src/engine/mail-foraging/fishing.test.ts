/**
 * fishing.test.ts — покрытие чистой логики мини-игры рыбалки (08-mail-foraging §3.2.4,
 * BACKLOG BL-1). node-окружение, ноль browser/three (AGENTS.md §4 уровень 1).
 */
import { describe, it, expect } from 'vitest'
import {
  catchBarMarkerPosition,
  clampHits,
  greenZoneWidth,
  isHit,
  rarityByHitsHypothesis,
  rollCatchRarity,
  rollLegendFish,
  resolveFishCast,
  CATCH_ODDS_BY_HITS,
} from './fishing'
import { FISHING_ATTEMPTS_PER_CAST, FISHING_ROD_ZONE_BONUS, LEGEND_FISH_CHANCE } from './constants'

describe('greenZoneWidth', () => {
  it('Bamboo (tier 0) — базовая ширина без бонуса', () => {
    expect(greenZoneWidth(0)).toBeCloseTo(0.30, 5)
  })
  it('Steel/Chrome — растущий бонус (§3.2.7)', () => {
    expect(greenZoneWidth(1)).toBeCloseTo(0.35, 5)
    expect(greenZoneWidth(2)).toBeCloseTo(0.40, 5)
  })
  it('неизвестный/мусорный tier — тёплый фолбэк на базовую ширину, не исключение', () => {
    expect(greenZoneWidth(99)).toBeCloseTo(0.30, 5)
    expect(greenZoneWidth(-1)).toBeCloseTo(0.30, 5)
    expect(greenZoneWidth(Number.NaN)).toBeCloseTo(0.30, 5)
  })
  it('никогда не превышает 1 (защита от абсурдного бонуса)', () => {
    expect(greenZoneWidth(FISHING_ROD_ZONE_BONUS.length - 1)).toBeLessThanOrEqual(1)
  })
})

describe('catchBarMarkerPosition', () => {
  it('стартует с 0', () => {
    expect(catchBarMarkerPosition(0, 1200)).toBe(0)
  })
  it('растёт к 1 на середине периода', () => {
    expect(catchBarMarkerPosition(600, 1200)).toBeCloseTo(1, 5)
  })
  it('падает обратно к ~0 на конце периода', () => {
    expect(catchBarMarkerPosition(1199, 1200)).toBeCloseTo(0, 1)
  })
  it('циклична — период оборачивается', () => {
    expect(catchBarMarkerPosition(1200 + 300, 1200)).toBeCloseTo(catchBarMarkerPosition(300, 1200), 5)
  })
  it('всегда в [0,1]', () => {
    for (let t = 0; t < 5000; t += 37) {
      const pos = catchBarMarkerPosition(t, 1200)
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(1)
    }
  })
})

describe('isHit', () => {
  it('центр полосы — попадание при любой положительной ширине зоны', () => {
    expect(isHit(0.5, 0.3)).toBe(true)
  })
  it('край зоны — попадание (включительно)', () => {
    expect(isHit(0.65, 0.3)).toBe(true) // 0.5 + 0.15
    expect(isHit(0.35, 0.3)).toBe(true) // 0.5 - 0.15
  })
  it('за пределами зоны — промах', () => {
    expect(isHit(0.66, 0.3)).toBe(false)
    expect(isHit(0.0, 0.3)).toBe(false)
    expect(isHit(1.0, 0.3)).toBe(false)
  })
})

describe('clampHits', () => {
  it('в диапазоне — не трогает', () => {
    expect(clampHits(0)).toBe(0)
    expect(clampHits(2)).toBe(2)
    expect(clampHits(FISHING_ATTEMPTS_PER_CAST)).toBe(FISHING_ATTEMPTS_PER_CAST)
  })
  it('округляет дробные', () => {
    expect(clampHits(1.6)).toBe(2)
  })
  it('зажимает мусорные/отрицательные/превышающие значения', () => {
    expect(clampHits(-5)).toBe(0)
    expect(clampHits(999)).toBe(FISHING_ATTEMPTS_PER_CAST)
    expect(clampHits(Number.NaN)).toBe(0)
  })
})

describe('rarityByHitsHypothesis (спека §3.2.4 п.5 — только для UI-подсказки/справки)', () => {
  it('0 попаданий → common', () => {
    expect(rarityByHitsHypothesis(0)).toBe('common')
  })
  it('1 попадание → good', () => {
    expect(rarityByHitsHypothesis(1)).toBe('good')
  })
  it('2–3 попадания → prime', () => {
    expect(rarityByHitsHypothesis(2)).toBe('prime')
    expect(rarityByHitsHypothesis(3)).toBe('prime')
  })
})

describe('rollCatchRarity (анти-чит модификатор — hits двигает шансы, не гарантирует исход)', () => {
  it('детерминированно мапит roll на пороги CATCH_ODDS_BY_HITS[hits]', () => {
    const odds = CATCH_ODDS_BY_HITS[0]!
    expect(rollCatchRarity(0, () => 0)).toBe('common')
    expect(rollCatchRarity(0, () => odds.common + 1e-9)).toBe('good')
    expect(rollCatchRarity(0, () => odds.common + odds.good + 1e-9)).toBe('prime')
  })
  it('большее число попаданий строго не уменьшает шанс Prime (монотонность модификатора)', () => {
    let prevPrime = -1
    for (let hits = 0; hits <= FISHING_ATTEMPTS_PER_CAST; hits++) {
      const odds = CATCH_ODDS_BY_HITS[hits]!
      expect(odds.prime).toBeGreaterThanOrEqual(prevPrime)
      prevPrime = odds.prime
    }
  })
  it('вероятности каждого hits-бакета суммируются в 1 (полное покрытие исходов)', () => {
    for (let hits = 0; hits <= FISHING_ATTEMPTS_PER_CAST; hits++) {
      const odds = CATCH_ODDS_BY_HITS[hits]!
      expect(odds.common + odds.good + odds.prime).toBeCloseTo(1, 5)
    }
  })
  it('0 попаданий — Prime возможен (не ноль), но не гарантирован (маленький срез, не 100%)', () => {
    expect(rollCatchRarity(0, () => 0.5)).not.toBe('prime') // середина диапазона — всё ещё common
    expect(rollCatchRarity(0, () => 0.999999)).toBe('prime') // самый край — маленький, но существующий срез
  })
})

describe('rollLegendFish', () => {
  it('roll чуть ниже порога — успех', () => {
    expect(rollLegendFish(() => LEGEND_FISH_CHANCE - 1e-9)).toBe(true)
  })
  it('roll на пороге/выше — неудача', () => {
    expect(rollLegendFish(() => LEGEND_FISH_CHANCE)).toBe(false)
    expect(rollLegendFish(() => 0.99)).toBe(false)
  })
})

describe('resolveFishCast', () => {
  it('Legend-ролл подменяет обычный улов целиком (§3.2.4 п.5 — «вместо», не поверх)', () => {
    // Первый вызов rng() уходит на rollLegendFish — форсируем успех.
    const rng = () => 0
    expect(resolveFishCast(0, rng)).toEqual({ rarity: 'legendary', legend: true })
  })
  it('без Legend — считает обычную редкость по hits', () => {
    let call = 0
    const rng = () => (call++ === 0 ? 0.99 : 0) // Legend-ролл мимо, затем common
    const outcome = resolveFishCast(3, rng)
    expect(outcome.legend).toBe(false)
    expect(outcome.rarity).toBe('common')
  })
  it('никогда не проваливается пустым уловом — итог всегда одна из известных редкостей', () => {
    const known = new Set(['common', 'good', 'prime', 'legendary'])
    for (let i = 0; i < 50; i++) {
      const outcome = resolveFishCast(i % 4, Math.random)
      expect(known.has(outcome.rarity)).toBe(true)
    }
  })
})
