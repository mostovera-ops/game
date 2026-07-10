import { describe, expect, it } from 'vitest'
import { buildToolbar, hotkeyFor, TOOLBAR_CELLS } from './toolbar'
import type { Inventory } from '../game/store'

const none: Inventory = { carrot: 0, greens: 0, tomato: 0 }
const kinds = (seeds: Inventory, inv: Inventory, phase: 'farm' | 'truck' = 'farm') =>
  buildToolbar(phase, seeds, inv).map((s) => (s.cell ? s.cell.kind : null))

describe('раскладка тулбара', () => {
  it('всегда ровно десять ячеек', () => {
    expect(buildToolbar('farm', none, none).length).toBe(TOOLBAR_CELLS)
    expect(buildToolbar('truck', none, none).length).toBe(TOOLBAR_CELLS)
  })

  it('клавиши идут 1…9, потом 0', () => {
    expect(hotkeyFor(0)).toBe('1')
    expect(hotkeyFor(8)).toBe('9')
    expect(hotkeyFor(9)).toBe('0')
  })

  it('семян нет — ячейки нет, соседи сдвигаются влево', () => {
    const seeds: Inventory = { carrot: 0, greens: 2, tomato: 0 }
    expect(kinds(seeds, none)).toEqual([
      'seed', // зелень
      'tool', // лейка
      'tool', // рука
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('урожай занимает ячейки следом за инструментами', () => {
    const seeds: Inventory = { carrot: 1, greens: 0, tomato: 0 }
    const inv: Inventory = { carrot: 0, greens: 3, tomato: 5 }
    const slots = buildToolbar('farm', seeds, inv)
    expect(slots[0].cell).toEqual({ kind: 'seed', crop: 'carrot' })
    expect(slots[1].cell).toEqual({ kind: 'tool', tool: 'can' })
    expect(slots[2].cell).toEqual({ kind: 'tool', tool: 'hand' })
    expect(slots[3].cell).toEqual({ kind: 'crop', crop: 'greens', count: 3 })
    expect(slots[4].cell).toEqual({ kind: 'crop', crop: 'tomato', count: 5 })
    expect(slots[5].cell).toBeNull()
  })

  it('нулевого урожая в тулбаре нет', () => {
    const inv: Inventory = { carrot: 0, greens: 0, tomato: 4 }
    const slots = buildToolbar('truck', none, inv)
    expect(slots[0].cell).toEqual({ kind: 'crop', crop: 'tomato', count: 4 })
    expect(slots[1].cell).toBeNull()
  })

  it('в день торговли инструментов и семян нет', () => {
    const seeds: Inventory = { carrot: 3, greens: 3, tomato: 3 }
    expect(kinds(seeds, none, 'truck').every((k) => k === null)).toBe(true)
  })

  it('всё сразу помещается в десять ячеек', () => {
    const full: Inventory = { carrot: 9, greens: 9, tomato: 9 }
    const slots = buildToolbar('farm', full, full)
    expect(slots.filter((s) => s.cell).length).toBe(8) // 3 семени + 2 инструмента + 3 урожая
  })
})
