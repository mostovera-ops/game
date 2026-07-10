/**
 * interactions.test.ts — чистая логика клика по грядке (node).
 */

import { describe, it, expect } from 'vitest'
import type { Plot } from '@/types'
import {
  plotVisualState,
  plotAction,
  resolvePlotAction,
  isPlotReady,
  growthProgress,
} from './interactions'

const base = (over: Partial<Plot>): Plot => ({ version: 1, id: 'p', slot: 0, state: 'empty', ...over })

describe('plotVisualState', () => {
  it('растущая с истёкшим readyAt показывается готовой', () => {
    const p = base({ state: 'growing', plantedAt: 0, readyAt: 100 })
    expect(plotVisualState(p, 150)).toBe('ready')
  })
  it('растущая до readyAt остаётся растущей', () => {
    const p = base({ state: 'growing', plantedAt: 0, readyAt: 100 })
    expect(plotVisualState(p, 50)).toBe('growing')
  })
  it('пустая/готовая без readyAt не меняются', () => {
    expect(plotVisualState(base({ state: 'empty' }), 999)).toBe('empty')
    expect(plotVisualState(base({ state: 'ready' }), 999)).toBe('ready')
  })
})

describe('plotAction / resolvePlotAction', () => {
  it('состояние → действие', () => {
    expect(plotAction('empty')).toBe('sow')
    expect(plotAction('growing')).toBe('water')
    expect(plotAction('ready')).toBe('harvest')
    expect(plotAction('withered')).toBe('harvest')
  })
  it('созревшая по времени растущая грядка → harvest', () => {
    const p = base({ state: 'growing', plantedAt: 0, readyAt: 100 })
    expect(resolvePlotAction(p, 200)).toBe('harvest')
    expect(resolvePlotAction(p, 10)).toBe('water')
  })
})

describe('isPlotReady', () => {
  it('true только когда визуально ready', () => {
    expect(isPlotReady(base({ state: 'ready' }), 0)).toBe(true)
    expect(isPlotReady(base({ state: 'growing', plantedAt: 0, readyAt: 10 }), 20)).toBe(true)
    expect(isPlotReady(base({ state: 'growing', plantedAt: 0, readyAt: 100 }), 20)).toBe(false)
    expect(isPlotReady(base({ state: 'empty' }), 0)).toBe(false)
  })
})

describe('growthProgress', () => {
  it('пустая → 0, готовая → 1', () => {
    expect(growthProgress(base({ state: 'empty' }), 0)).toBe(0)
    expect(growthProgress(base({ state: 'ready' }), 0)).toBe(1)
  })
  it('линейно между plantedAt и readyAt', () => {
    const p = base({ state: 'growing', plantedAt: 0, readyAt: 100 })
    expect(growthProgress(p, 25)).toBeCloseTo(0.25)
    expect(growthProgress(p, 50)).toBeCloseTo(0.5)
  })
  it('клампится в [0,1]', () => {
    const p = base({ state: 'growing', plantedAt: 0, readyAt: 100 })
    expect(growthProgress(p, -50)).toBe(0)
    expect(growthProgress(p, 500)).toBe(1)
  })
  it('растущая без таймеров → 0.5 (нейтральный рост)', () => {
    expect(growthProgress(base({ state: 'growing' }), 0)).toBe(0.5)
  })
})
