import { describe, expect, it } from 'vitest'
import { buildToolbar, hotkeyFor, TOOLBAR_CELLS } from './toolbar'
import type { Inventory, Seeds } from '../game/store'

const noSeeds: Seeds = { carrot: 0, greens: 0, tomato: 0 }
const empty: Inventory = { carrot: 0, greens: 0, tomato: 0, mushroom: 0, egg: 0 }
const bag = (patch: Partial<Inventory>): Inventory => ({ ...empty, ...patch })

const kinds = (seeds: Seeds, inv: Inventory, phase: 'farm' | 'truck' = 'farm') =>
  buildToolbar(phase, seeds, inv).map((s) => (s.cell ? s.cell.kind : null))

describe('раскладка тулбара', () => {
  it('всегда ровно десять ячеек', () => {
    expect(buildToolbar('farm', noSeeds, empty).length).toBe(TOOLBAR_CELLS)
    expect(buildToolbar('truck', noSeeds, empty).length).toBe(TOOLBAR_CELLS)
  })

  it('клавиши идут 1…9, потом 0', () => {
    expect(hotkeyFor(0)).toBe('1')
    expect(hotkeyFor(8)).toBe('9')
    expect(hotkeyFor(9)).toBe('0')
  })

  it('семян нет — ячейки нет, соседи сдвигаются влево', () => {
    const seeds: Seeds = { carrot: 0, greens: 2, tomato: 0 }
    expect(kinds(seeds, empty)).toEqual([
      'seed', // зелень
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('в ячейках только имущество: инструментов там нет', () => {
    const seeds: Seeds = { carrot: 3, greens: 3, tomato: 3 }
    const slots = buildToolbar('farm', seeds, bag({ carrot: 1 }))
    expect(slots.every((s) => s.cell?.kind !== ('tool' as never))).toBe(true)
  })

  it('урожай занимает ячейки следом за семенами', () => {
    const seeds: Seeds = { carrot: 1, greens: 0, tomato: 0 }
    const slots = buildToolbar('farm', seeds, bag({ greens: 3, tomato: 5 }))
    expect(slots[0].cell).toEqual({ kind: 'seed', crop: 'carrot' })
    expect(slots[1].cell).toEqual({ kind: 'item', item: 'greens', count: 3 })
    expect(slots[2].cell).toEqual({ kind: 'item', item: 'tomato', count: 5 })
    expect(slots[3].cell).toBeNull()
  })

  it('находки идут после урожая, в той же сумке', () => {
    const slots = buildToolbar('farm', noSeeds, bag({ tomato: 1, mushroom: 2, egg: 1 }))
    expect(slots[0].cell).toEqual({ kind: 'item', item: 'tomato', count: 1 })
    expect(slots[1].cell).toEqual({ kind: 'item', item: 'mushroom', count: 2 })
    expect(slots[2].cell).toEqual({ kind: 'item', item: 'egg', count: 1 })
    expect(slots[3].cell).toBeNull()
  })

  it('нулевого урожая в тулбаре нет', () => {
    const slots = buildToolbar('truck', noSeeds, bag({ tomato: 4 }))
    expect(slots[0].cell).toEqual({ kind: 'item', item: 'tomato', count: 4 })
    expect(slots[1].cell).toBeNull()
  })

  it('в день торговли семян нет: остаётся только урожай', () => {
    const seeds: Seeds = { carrot: 3, greens: 3, tomato: 3 }
    expect(kinds(seeds, empty, 'truck').every((k) => k === null)).toBe(true)
  })

  it('всё сразу помещается в десять ячеек', () => {
    const seeds: Seeds = { carrot: 9, greens: 9, tomato: 9 }
    const full: Inventory = { carrot: 9, greens: 9, tomato: 9, mushroom: 9, egg: 9 }
    const slots = buildToolbar('farm', seeds, full)
    expect(slots.filter((s) => s.cell).length).toBe(8) // 3 семени + 3 урожая + 2 находки
  })
})
