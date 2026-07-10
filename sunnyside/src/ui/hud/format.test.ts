/**
 * format.test.ts — чистые форматтеры HUD (node, без jsdom).
 */
import { describe, it, expect } from 'vitest'
import { formatAmount, formatCountdown } from './format'

describe('formatAmount', () => {
  it('разделяет тысячи и округляет', () => {
    expect(formatAmount(12480)).toBe('12,480')
    expect(formatAmount(999.6)).toBe('1,000')
    expect(formatAmount(0)).toBe('0')
  })
})

describe('formatCountdown', () => {
  it('< 1ч → M:SS', () => {
    expect(formatCountdown(65_000)).toBe('1:05')
  })
  it('≥ 1ч → H:MM:SS', () => {
    expect(formatCountdown(3_661_000)).toBe('1:01:01')
  })
  it('отрицательное/просроченное → 0:00 (никогда не наказывает отрицательным)', () => {
    expect(formatCountdown(-5000)).toBe('0:00')
  })
})
