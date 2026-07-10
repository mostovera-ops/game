import { describe, it, expect } from 'vitest'
import {
  DROP_RATES,
  PITY_RARE_CAP,
  PITY_CHASE_CAP,
  initialPity,
  rollRarity,
  pullOnce,
  toysOf,
  pickToy,
  simulatePulls,
  type Rng,
} from './prizeMachine'
import { TOY_SERIES_KEYS } from '@/types/collections'
import { toys } from '@/data/catalogs/toys'

/** mulberry32 — маленький детерминированный ГПСЧ для воспроизводимых тестов. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** rng, всегда роллящий «common» органически (не задевает пороги pity). */
const alwaysCommonRng: Rng = () => 0.1

describe('DROP_RATES (17-collections §3.4 таблица)', () => {
  it('суммируются в 1', () => {
    const sum = DROP_RATES.common + DROP_RATES.uncommon + DROP_RATES.rare + DROP_RATES.chase
    expect(sum).toBeCloseTo(1, 10)
  })

  it('точные значения из спеки', () => {
    expect(DROP_RATES.common).toBeCloseTo(0.68)
    expect(DROP_RATES.uncommon).toBeCloseTo(0.24)
    expect(DROP_RATES.rare).toBeCloseTo(0.065)
    expect(DROP_RATES.chase).toBeCloseTo(0.015)
  })
})

describe('rollRarity — пороги кумулятивные', () => {
  it('r=0 → common, r чуть меньше 0.68 → common, r=0.68 → uncommon', () => {
    expect(rollRarity(() => 0)).toBe('common')
    expect(rollRarity(() => 0.679)).toBe('common')
    expect(rollRarity(() => 0.68)).toBe('uncommon')
  })

  it('r=0.92 → rare, r=0.9851 → chase, r чуть меньше 1 → chase', () => {
    expect(rollRarity(() => 0.92)).toBe('rare')
    // Граница common+uncommon+rare — 0.985 с погрешностью float (0.9850000000000001);
    // берём значение заведомо выше неё, чтобы тест не зависел от FP-артефакта.
    expect(rollRarity(() => 0.9851)).toBe('chase')
    expect(rollRarity(() => 0.999999)).toBe('chase')
  })
})

describe('pullOnce — гарантированная детерминированная последовательность (rare pity каждые 10, chase pity на 40-м, приоритет chase — C4)', () => {
  it('с органическим rng=«всегда common»: rare форсится на 10/20/30, chase форсится на 40 (переопределяя rare pity)', () => {
    let pity = initialPity('toy_highway_dinos')
    const rarities: string[] = []
    const forced: (string | null)[] = []
    for (let i = 1; i <= 40; i++) {
      const step = pullOnce(pity, alwaysCommonRng)
      pity = step.pityAfter
      rarities.push(step.rarity)
      forced.push(step.forcedBy)
    }

    const expectedForcedIdx = [10, 20, 30, 40].map((n) => n - 1)
    for (let i = 0; i < 40; i++) {
      if (expectedForcedIdx.includes(i) && i !== 39) {
        expect(rarities[i]).toBe('rare')
        expect(forced[i]).toBe('rare')
      } else if (i === 39) {
        // 40-й пулл: pullsSinceChase тоже достиг 40 → приоритет chase (C4).
        expect(rarities[i]).toBe('chase')
        expect(forced[i]).toBe('chase')
      } else {
        expect(rarities[i]).toBe('common')
        expect(forced[i]).toBeNull()
      }
    }

    // Оба счётчика обнулены после chase (C4: chase удовлетворяет условие Rare+ тоже).
    expect(pity.pullsSinceRare).toBe(0)
    expect(pity.pullsSinceChase).toBe(0)
  })

  it('pity не переносится между сериями — независимые начальные состояния', () => {
    const a = initialPity('toy_cosmos_57')
    const b = initialPity('toy_chrome_rockets')
    expect(a.pullsSinceRare).toBe(0)
    expect(b.pullsSinceRare).toBe(0)
    expect(a.series).not.toBe(b.series)
  })
})

describe('toysOf / pickToy — каталог 40 фигурок, 4 редкости × 5 серий', () => {
  it('каждая серия имеет 4 common, 2 uncommon, 1 rare, 1 chase', () => {
    for (const series of TOY_SERIES_KEYS) {
      expect(toysOf(series, 'common').length).toBe(4)
      expect(toysOf(series, 'uncommon').length).toBe(2)
      expect(toysOf(series, 'rare').length).toBe(1)
      expect(toysOf(series, 'chase').length).toBe(1)
    }
  })

  it('всего 40 записей в каталоге', () => {
    expect(toys.length).toBe(40)
  })

  it('pickToy всегда возвращает фигурку требуемой серии/редкости', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const series = TOY_SERIES_KEYS[i % TOY_SERIES_KEYS.length] as (typeof TOY_SERIES_KEYS)[number]
      const toy = pickToy(series, 'rare', rng)
      expect(toy.series).toBe(series)
      expect(toy.rarity).toBe('rare')
    }
  })
})

describe('simulatePulls — 10 000 симуляций: инварианты открытого pity держатся всегда', () => {
  const seeds = [1, 42, 1234, 999_999, 7]

  for (const seed of seeds) {
    it(`seed=${seed}: между двумя Rare+ не больше ${PITY_RARE_CAP} пуллов, между двумя Chase — не больше ${PITY_CHASE_CAP}`, () => {
      const rng = mulberry32(seed)
      const pity0 = initialPity('toy_diner_mascots')
      const { results, pityAfter } = simulatePulls(pity0, 10_000, rng)

      let sinceRare = 0
      let sinceChase = 0
      let maxSinceRare = 0
      let maxSinceChase = 0
      const counts = { common: 0, uncommon: 0, rare: 0, chase: 0 }

      for (const r of results) {
        counts[r.rarity]++
        sinceRare++
        sinceChase++
        if (r.rarity === 'rare' || r.rarity === 'chase') sinceRare = 0
        if (r.rarity === 'chase') sinceChase = 0
        maxSinceRare = Math.max(maxSinceRare, sinceRare)
        maxSinceChase = Math.max(maxSinceChase, sinceChase)
      }

      expect(results.length).toBe(10_000)
      expect(maxSinceRare).toBeLessThanOrEqual(PITY_RARE_CAP)
      expect(maxSinceChase).toBeLessThanOrEqual(PITY_CHASE_CAP)
      // pity финального состояния тоже в допустимых границах (не «перегорело»).
      expect(pityAfter.pullsSinceRare).toBeLessThan(PITY_RARE_CAP)
      expect(pityAfter.pullsSinceChase).toBeLessThan(PITY_CHASE_CAP)

      // Статистическая проверка (широкие допуски — часть исходов форсирована pity,
      // органическое распределение слегка смещается вверх для rare/chase).
      const n = results.length
      expect(counts.common / n).toBeGreaterThan(0.55)
      expect(counts.common / n).toBeLessThan(0.76)
      expect(counts.rare / n).toBeGreaterThan(DROP_RATES.rare * 0.5)
      expect(counts.chase / n).toBeGreaterThan(DROP_RATES.chase * 0.5)
    })
  }

  it('дубликаты внутри батча и относительно уже имеющихся фигурок отмечаются верно', () => {
    const rng = mulberry32(2024)
    const pity0 = initialPity('toy_route_critters')
    const commonToy = toysOf('toy_route_critters', 'common')[0]
    if (!commonToy) throw new Error('test setup: нет common-фигурки в toy_route_critters')
    const owned = new Set([commonToy.key])
    const { results } = simulatePulls(pity0, 500, rng, owned)
    const anyDuplicateFlagged = results.some((r) => r.duplicate)
    expect(anyDuplicateFlagged).toBe(true)
    // Любой результат с уже принадлежащим ключом обязан быть помечен как дубль.
    for (const r of results) {
      if (r.toyKey === commonToy.key) expect(r.duplicate).toBe(true)
    }
  })
})
