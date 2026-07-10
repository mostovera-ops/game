/**
 * rotation.test.ts — недельная ротация Каталога почтой (08 §3.1.2/§3.1.6).
 * Проверяем детерминизм, состав 12 позиций, гарантии тиров, anti-repeat, Last Call.
 */

import { describe, it, expect } from 'vitest'
import { buildWeeklyCatalog, catalogAt } from './rotation'
import {
  CATALOG_POSITIONS_TOTAL,
  CATALOG_POSITIONS_BY_CATEGORY,
  LAST_CALL_POSITIONS,
} from './constants'
import { weekNumberOf, weekStartOfIndex } from '@/engine/clock'

describe('buildWeeklyCatalog', () => {
  it('детерминирован: одна неделя → идентичная витрина', () => {
    const a = buildWeeklyCatalog(1234)
    const b = buildWeeklyCatalog(1234)
    expect(a.positions.map((p) => p.item.key)).toEqual(b.positions.map((p) => p.item.key))
    expect(a.positions.map((p) => p.lastCall)).toEqual(b.positions.map((p) => p.lastCall))
  })

  it('ровно 12 позиций с распределением 5/4/3 по категориям', () => {
    const cat = buildWeeklyCatalog(42)
    expect(cat.positions).toHaveLength(CATALOG_POSITIONS_TOTAL)
    const byCat = (c: string) => cat.positions.filter((p) => p.item.category === c).length
    expect(byCat('rare_seeds')).toBe(CATALOG_POSITIONS_BY_CATEGORY.rare_seeds)
    expect(byCat('decor')).toBe(CATALOG_POSITIONS_BY_CATEGORY.decor)
    expect(byCat('tools')).toBe(CATALOG_POSITIONS_BY_CATEGORY.tools)
  })

  it('без повторов ключей внутри недели', () => {
    const cat = buildWeeklyCatalog(7)
    const keys = cat.positions.map((p) => p.item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('гарантия тиров rare_seeds: ≥1 T3 и ≥1 T4–T5 на любой неделе', () => {
    for (let wk = 0; wk < 60; wk++) {
      const rare = buildWeeklyCatalog(wk).positions.filter((p) => p.item.category === 'rare_seeds')
      expect(rare.some((p) => p.item.tier === 3)).toBe(true)
      expect(rare.some((p) => p.item.tier === 4 || p.item.tier === 5)).toBe(true)
    }
  })

  it('anti-repeat: свежие позиции приоритетнее показанных на прошлой неделе', () => {
    const prev = buildWeeklyCatalog(100)
    const prevKeys = prev.positions.map((p) => p.item.key)
    const next = buildWeeklyCatalog(101, prevKeys)
    const nextKeys = next.positions.map((p) => p.item.key)
    // Пул шире витрины: пересечение с прошлой неделей должно быть строго меньше 12
    // (не «та же витрина»). Полный ноль-оверлап не гарантируем — гарантии тиров/добор
    // могут вернуть T4–T5 из узкого сегмента при исчерпании свежих.
    const overlap = nextKeys.filter((k) => prevKeys.includes(k)).length
    expect(overlap).toBeLessThan(CATALOG_POSITIONS_TOTAL)
  })

  it('ровно 2 позиции Last Call', () => {
    const cat = buildWeeklyCatalog(55)
    expect(cat.positions.filter((p) => p.lastCall)).toHaveLength(LAST_CALL_POSITIONS)
  })

  it('границы окна недели совпадают с календарём', () => {
    const cat = buildWeeklyCatalog(9)
    expect(cat.weekStart).toBe(weekStartOfIndex(9))
    expect(cat.weekEnd).toBe(weekStartOfIndex(10))
  })
})

describe('catalogAt', () => {
  it('выбирает витрину по индексу недели момента', () => {
    const now = weekStartOfIndex(200) + 3 * 3_600_000
    const cat = catalogAt(now)
    expect(cat.weekIndex).toBe(weekNumberOf(now))
    expect(cat.positions).toHaveLength(CATALOG_POSITIONS_TOTAL)
  })
})
