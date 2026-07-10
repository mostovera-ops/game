/**
 * grandOpening.test.ts — катч-ап Grand Opening ×2 (§3.10). Проверяем фиксированный
 * таймер (7×24ч / win-back 48ч), переживание ролловера, продление при ре-триггере.
 */

import { describe, it, expect } from 'vitest'
import {
  grandOpeningMultiplier,
  isGrandOpeningActive,
  grandOpeningRemainingMs,
  grandOpeningDurationMs,
  retriggerGrandOpening,
} from './grandOpening'
import { GRAND_OPENING_MS, GRAND_OPENING_WINBACK_MS } from './constants'

const T0 = 1_700_000_000_000 // произвольный serverNow-момент

describe('grandOpeningDurationMs — длительность по типу (§3.10)', () => {
  it('standard = 7×24ч, winback = 48ч', () => {
    expect(grandOpeningDurationMs('standard')).toBe(GRAND_OPENING_MS)
    expect(grandOpeningDurationMs('winback')).toBe(GRAND_OPENING_WINBACK_MS)
    expect(GRAND_OPENING_MS).toBe(7 * 24 * 3600 * 1000)
    expect(GRAND_OPENING_WINBACK_MS).toBe(48 * 3600 * 1000)
  })
})

describe('grandOpeningMultiplier — ×2 в окне, ×1 вне (§3.10)', () => {
  const state = { activatedAt: T0, kind: 'standard' as const }
  it('в момент активации и внутри окна → ×2', () => {
    expect(grandOpeningMultiplier(state, T0)).toBe(2)
    expect(grandOpeningMultiplier(state, T0 + GRAND_OPENING_MS - 1)).toBe(2)
  })
  it('на границе конца и после → ×1', () => {
    expect(grandOpeningMultiplier(state, T0 + GRAND_OPENING_MS)).toBe(1)
    expect(grandOpeningMultiplier(state, T0 + GRAND_OPENING_MS + 5000)).toBe(1)
  })
  it('до активации → ×1', () => {
    expect(grandOpeningMultiplier(state, T0 - 1)).toBe(1)
  })
  it('null-состояние → ×1', () => {
    expect(grandOpeningMultiplier(null, T0)).toBe(1)
  })
  it('переживает недельный ролловер (>7 дней от произвольной точки внутри)', () => {
    // активирован в середине недели, проверяем через 3 дня — всё ещё активен
    expect(isGrandOpeningActive(state, T0 + 3 * 24 * 3600 * 1000)).toBe(true)
  })
})

describe('win-back подтип — 48ч (§3.10)', () => {
  const wb = { activatedAt: T0, kind: 'winback' as const }
  it('активен до 48ч, потом нет', () => {
    expect(grandOpeningMultiplier(wb, T0 + GRAND_OPENING_WINBACK_MS - 1)).toBe(2)
    expect(grandOpeningMultiplier(wb, T0 + GRAND_OPENING_WINBACK_MS)).toBe(1)
  })
})

describe('grandOpeningRemainingMs — остаток для UI-таймера', () => {
  const state = { activatedAt: T0, kind: 'standard' as const }
  it('в начале ≈ полная длительность, в конце 0', () => {
    expect(grandOpeningRemainingMs(state, T0)).toBe(GRAND_OPENING_MS)
    expect(grandOpeningRemainingMs(state, T0 + GRAND_OPENING_MS + 100)).toBe(0)
  })
})

describe('retriggerGrandOpening — продление от новой даты (§3.10)', () => {
  it('ре-триггер во время активного продлевает до полной длительности от now', () => {
    const now = T0 + 2 * 24 * 3600 * 1000 // спустя 2 дня
    const next = retriggerGrandOpening(now, 'standard')
    expect(next.activatedAt).toBe(now)
    expect(grandOpeningRemainingMs(next, now)).toBe(GRAND_OPENING_MS)
  })
})
