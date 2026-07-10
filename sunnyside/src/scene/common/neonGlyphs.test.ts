/**
 * neonGlyphs.test.ts — чистое отображение конфига вывески в примитивы (node).
 */

import { describe, it, expect } from 'vitest'
import { layoutNeonLine, neonGlowAt, resolveNeonHex, NEON_FALLBACK_HEX, NEON_COLOR_HEX } from './neonGlyphs'

describe('resolveNeonHex', () => {
  it('берёт hex первого известного colorId', () => {
    expect(resolveNeonHex(['teal'])).toBe(NEON_COLOR_HEX.teal)
    expect(resolveNeonHex(['gold', 'purple'])).toBe(NEON_COLOR_HEX.gold)
  })
  it('фолбэк на неизвестный/пустой/отсутствующий список', () => {
    expect(resolveNeonHex(undefined)).toBe(NEON_FALLBACK_HEX)
    expect(resolveNeonHex([])).toBe(NEON_FALLBACK_HEX)
    expect(resolveNeonHex(['nonsense'])).toBe(NEON_FALLBACK_HEX)
  })
})

describe('layoutNeonLine', () => {
  it('пустая строка → пустой массив', () => {
    expect(layoutNeonLine('')).toEqual([])
  })
  it('центрирует символы, пропускает пробелы', () => {
    const glyphs = layoutNeonLine('AB CD')
    expect(glyphs.map((g) => g.char)).toEqual(['A', 'B', 'C', 'D'])
    // Симметрично относительно 0.
    const xs = glyphs.map((g) => g.x)
    expect(xs[0]!).toBeCloseTo(-xs[xs.length - 1]!, 5)
  })
  it('одна буква — по центру (x=0)', () => {
    expect(layoutNeonLine('A')).toEqual([{ char: 'A', x: 0 }])
  })
})

describe('neonGlowAt', () => {
  it('steady — всегда 1', () => {
    expect(neonGlowAt('steady', 0, 0)).toBe(1)
    expect(neonGlowAt('steady', 123.4, 5)).toBe(1)
  })
  it('blink — колеблется, никогда не гаснет до нуля (P1 «дружелюбно»)', () => {
    for (let t = 0; t < 10; t += 0.3) {
      const v = neonGlowAt('blink', t, 0)
      expect(v).toBeGreaterThan(0.5)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('chase — разные буквы светятся с разной фазой', () => {
    const a = neonGlowAt('chase', 1, 0)
    const b = neonGlowAt('chase', 1, 3)
    expect(a).not.toBeCloseTo(b, 5)
  })
  it('chase — значение всегда в [0.4,1]', () => {
    for (let t = 0; t < 6; t += 0.2) {
      const v = neonGlowAt('chase', t, 2)
      expect(v).toBeGreaterThanOrEqual(0.4)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
