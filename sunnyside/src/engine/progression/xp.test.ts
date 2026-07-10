/**
 * xp.test.ts — кривая XP уровня фермы (13-progression §3.5.1). Числа сверяются со
 * спекой: XP_to_next(L) = round(80·L^1.8), кап L=60.
 */

import { describe, it, expect } from 'vitest'
import { xpToNext, cumulativeXp, levelForXp } from './xp'
import { FARM_LEVEL_CAP } from './constants'

describe('xpToNext — round(80·L^1.8) (§3.5.1)', () => {
  it('L=1 → 80 (первые минуты)', () => {
    expect(xpToNext(1)).toBe(80)
  })

  it('ключевые точки таблицы §3.5.1 совпадают с round(80·L^1.8)', () => {
    // Спека даёт «≈» значения; проверяем точную формулу, из которой они выведены.
    expect(xpToNext(5)).toBe(Math.round(80 * Math.pow(5, 1.8))) // ≈1450
    expect(xpToNext(10)).toBe(Math.round(80 * Math.pow(10, 1.8))) // ≈5045
    expect(xpToNext(20)).toBe(Math.round(80 * Math.pow(20, 1.8))) // ≈17570
    expect(xpToNext(50)).toBe(Math.round(80 * Math.pow(50, 1.8))) // ≈91440
  })

  it('согласие с округлёнными точками спеки (±1 от округления)', () => {
    expect(xpToNext(5)).toBeCloseTo(1450, -2)
    expect(xpToNext(10)).toBeCloseTo(5045, -2)
    expect(xpToNext(20)).toBeCloseTo(17570, -2)
  })

  it('на капе (L≥60) переход = 0 (§3.5.1)', () => {
    expect(xpToNext(FARM_LEVEL_CAP)).toBe(0)
    expect(xpToNext(61)).toBe(0)
    expect(xpToNext(999)).toBe(0)
  })

  it('защита границы: L<1 трактуется как 1, не бросает', () => {
    expect(xpToNext(0)).toBe(80)
    expect(xpToNext(-5)).toBe(80)
  })

  it('монотонно растёт до капа', () => {
    for (let l = 1; l < FARM_LEVEL_CAP - 1; l++) {
      expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l))
    }
  })
})

describe('cumulativeXp (§3.5.1)', () => {
  it('cumulative(1)=0 (старт)', () => {
    expect(cumulativeXp(1)).toBe(0)
  })

  it('cumulative(2)=xpToNext(1)=80', () => {
    expect(cumulativeXp(2)).toBe(80)
  })

  it('cumulative(L) = Σ xpToNext(1..L−1)', () => {
    let manual = 0
    for (let i = 1; i < 11; i++) manual += xpToNext(i)
    expect(cumulativeXp(11)).toBe(manual)
  })

  it('накоплено к капу — по точной формуле §4.6 (спека даёт грубую оценку «≈2.4 млн»)', () => {
    // §3.5.1 таблица помечает накопление к 60 как «≈ 2.4 млн» (оценка интегралом);
    // ТОЧНАЯ мастер-формула §4.6 round(80·L^1.8) даёт ~2.66 млн — она авторитетна.
    const total = cumulativeXp(FARM_LEVEL_CAP)
    let manual = 0
    for (let i = 1; i < FARM_LEVEL_CAP; i++) manual += xpToNext(i)
    expect(total).toBe(manual)
    expect(total).toBeGreaterThan(2_600_000)
    expect(total).toBeLessThan(2_700_000)
  })
})

describe('levelForXp — обратна cumulativeXp', () => {
  it('0 XP → уровень 1, всё внутри уровня 0', () => {
    const p = levelForXp(0)
    expect(p.level).toBe(1)
    expect(p.xpIntoLevel).toBe(0)
    expect(p.xpToNext).toBe(80)
    expect(p.capped).toBe(false)
  })

  it('79 XP → всё ещё уровень 1', () => {
    expect(levelForXp(79).level).toBe(1)
  })

  it('ровно 80 XP → уровень 2, 0 внутри', () => {
    const p = levelForXp(80)
    expect(p.level).toBe(2)
    expect(p.xpIntoLevel).toBe(0)
  })

  it('round-trip: cumulativeXp(L) даёт ровно уровень L для 1..60', () => {
    for (let L = 1; L <= FARM_LEVEL_CAP; L++) {
      expect(levelForXp(cumulativeXp(L)).level).toBe(L)
    }
  })

  it('середина уровня: cumulative(L)+need/2 остаётся уровнем L', () => {
    const L = 15
    const mid = cumulativeXp(L) + Math.floor(xpToNext(L) / 2)
    const p = levelForXp(mid)
    expect(p.level).toBe(L)
    expect(p.xpIntoLevel).toBe(Math.floor(xpToNext(L) / 2))
    expect(p.xpToNext).toBe(xpToNext(L))
  })

  it('кап: сверх-XP аккумулируется в xpIntoLevel, xpToNext=0 (§3.5.1/P6)', () => {
    const base = cumulativeXp(FARM_LEVEL_CAP)
    const p = levelForXp(base + 999999)
    expect(p.level).toBe(FARM_LEVEL_CAP)
    expect(p.capped).toBe(true)
    expect(p.xpToNext).toBe(0)
    expect(p.xpIntoLevel).toBe(999999)
  })

  it('отрицательный XP → уровень 1 (защита границы)', () => {
    expect(levelForXp(-100).level).toBe(1)
  })
})
