/**
 * layout.test.ts — детерминированная планировка A-слотов и пропсов (node).
 */

import { describe, it, expect } from 'vitest'
import {
  plotGridPosition,
  machinePosition,
  animalPosition,
  PLOT_SPACING,
  PLOT_COLS,
  BUILDING_LAYOUT,
} from './layout'

describe('plotGridPosition', () => {
  it('слот 0 — в начале координат поля', () => {
    const p = plotGridPosition(0)
    expect(p).toHaveLength(3)
    expect(p[1]).toBe(0) // лежит на земле
  })
  it('соседний слот в ряду сдвинут ровно на PLOT_SPACING по X', () => {
    const a = plotGridPosition(0)
    const b = plotGridPosition(1)
    expect(b[0] - a[0]).toBeCloseTo(PLOT_SPACING)
    expect(b[2]).toBeCloseTo(a[2]) // тот же ряд
  })
  it('перенос на новый ряд каждые PLOT_COLS', () => {
    const first = plotGridPosition(0)
    const nextRow = plotGridPosition(PLOT_COLS)
    expect(nextRow[2] - first[2]).toBeCloseTo(PLOT_SPACING) // ряд глубже по Z
    expect(nextRow[0]).toBeCloseTo(first[0]) // тот же столбец
  })
  it('детерминирован: одинаковый вход → одинаковый выход', () => {
    expect(plotGridPosition(7)).toEqual(plotGridPosition(7))
  })
  it('дробный/отрицательный слот нормализуется', () => {
    expect(plotGridPosition(-3)).toEqual(plotGridPosition(0))
    expect(plotGridPosition(2.9)).toEqual(plotGridPosition(2))
  })
})

describe('machinePosition / animalPosition', () => {
  it('станки выстраиваются вправо', () => {
    expect(machinePosition(1)[0]).toBeGreaterThan(machinePosition(0)[0])
  })
  it('животные разнесены по X', () => {
    expect(animalPosition(1)[0]).toBeGreaterThan(animalPosition(0)[0])
  })
})

describe('BUILDING_LAYOUT', () => {
  it('9 канон-построек имеют позицию', () => {
    const keys = Object.keys(BUILDING_LAYOUT)
    expect(keys).toContain('bld_house')
    expect(keys).toContain('bld_apiary')
    expect(keys.length).toBe(9)
  })
})
