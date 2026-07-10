/**
 * anim.test.ts — чистые кривые процедурных анимаций (node).
 */

import { describe, it, expect } from 'vitest'
import { popTick, swayRotation, growScale, readyPulse, POP_DURATION_MS } from './anim'

describe('popTick', () => {
  it('старт — масштаб 1, не завершён', () => {
    const r = popTick(0)
    expect(r.scale).toBeCloseTo(1)
    expect(r.done).toBe(false)
  })
  it('пик в середине — масштаб 1.4', () => {
    expect(popTick(POP_DURATION_MS * 0.5).scale).toBeCloseTo(1.4)
  })
  it('конец — масштаб 0 и done', () => {
    const r = popTick(POP_DURATION_MS)
    expect(r.scale).toBeCloseTo(0)
    expect(r.done).toBe(true)
  })
  it('за пределом длительности — done, без отрицательного масштаба', () => {
    const r = popTick(POP_DURATION_MS * 2)
    expect(r.done).toBe(true)
    expect(r.scale).toBeGreaterThanOrEqual(0)
  })
})

describe('swayRotation', () => {
  it('ограничена амплитудой', () => {
    for (const t of [0, 1, 2.5, 10]) {
      expect(Math.abs(swayRotation(t, 0, 0.08))).toBeLessThanOrEqual(0.08 + 1e-9)
    }
  })
  it('фаза разводит соседние грядки', () => {
    expect(swayRotation(1, 0)).not.toBeCloseTo(swayRotation(1, Math.PI))
  })
})

describe('growScale', () => {
  it('0 → росток (0.2), 1 → полный (1)', () => {
    expect(growScale(0)).toBeCloseTo(0.2)
    expect(growScale(1)).toBeCloseTo(1)
    expect(growScale(0.5)).toBeCloseTo(0.6)
  })
  it('клампит вход', () => {
    expect(growScale(-1)).toBeCloseTo(0.2)
    expect(growScale(2)).toBeCloseTo(1)
  })
})

describe('readyPulse', () => {
  it('bob и scale колеблются около базы', () => {
    const r = readyPulse(0.3)
    expect(r.bobY).toBeGreaterThan(0)
    expect(r.scale).toBeGreaterThan(0.9)
    expect(r.scale).toBeLessThan(1.1)
  })
})
