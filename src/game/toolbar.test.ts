import { describe, expect, it } from 'vitest'
import {
  emptyToolbar,
  hotkeyFor,
  moveItem,
  reconcileToolbar,
  TOOLBAR_CELLS,
  type ToolbarItem,
} from './toolbar'
import { itemId } from './toolbar'
import type { CropId, Inventory, Seeds } from './store'

const noSeeds: Seeds = { carrot: 0, greens: 0, tomato: 0 }
const none: Inventory = { carrot: 0, greens: 0, tomato: 0, mushroom: 0, egg: 0 }
const bag = (over: Partial<Inventory>): Inventory => ({ ...none, ...over })
const seed = (crop: CropId): ToolbarItem => ({ kind: 'seed', crop })
const item = (id: CropId): ToolbarItem => ({ kind: 'item', item: id })

/** Компактный вид раскладки для сравнений: `seed:carrot` или `-`. */
const view = (layout: (ToolbarItem | null)[]) =>
  layout.map((i) => (i ? `${i.kind}:${itemId(i)}` : '-'))

describe('раскладка тулбара', () => {
  it('всегда ровно десять ячеек', () => {
    expect(reconcileToolbar(emptyToolbar(), noSeeds, none).length).toBe(TOOLBAR_CELLS)
  })

  it('клавиши идут 1…9, потом 0', () => {
    expect(hotkeyFor(0)).toBe('1')
    expect(hotkeyFor(8)).toBe('9')
    expect(hotkeyFor(9)).toBe('0')
  })

  it('новые предметы садятся в первые свободные ячейки слева', () => {
    const seeds: Seeds = { carrot: 3, greens: 3, tomato: 3 }
    expect(view(reconcileToolbar(emptyToolbar(), seeds, none)).slice(0, 4)).toEqual([
      'seed:carrot',
      'seed:greens',
      'seed:tomato',
      '-',
    ])
  })

  it('кончившийся предмет освобождает ячейку, соседи не сдвигаются', () => {
    const seeds: Seeds = { carrot: 3, greens: 3, tomato: 3 }
    const layout = reconcileToolbar(emptyToolbar(), seeds, none)
    const after = reconcileToolbar(layout, { ...seeds, greens: 0 }, none)
    expect(view(after).slice(0, 3)).toEqual(['seed:carrot', '-', 'seed:tomato'])
  })

  it('появившийся урожай занимает освободившуюся ячейку, а не хвост', () => {
    const seeds: Seeds = { carrot: 3, greens: 0, tomato: 3 }
    const layout = reconcileToolbar(emptyToolbar(), { carrot: 3, greens: 3, tomato: 3 }, none)
    const after = reconcileToolbar(layout, seeds, bag({ carrot: 2 }))
    expect(view(after).slice(0, 4)).toEqual(['seed:carrot', 'item:carrot', 'seed:tomato', '-'])
  })

  it('раскладка переживает изменение счётчика: предмет остаётся в своей ячейке', () => {
    const layout = reconcileToolbar(emptyToolbar(), { carrot: 3, greens: 3, tomato: 3 }, none)
    const after = reconcileToolbar(layout, { carrot: 1, greens: 3, tomato: 3 }, none)
    expect(view(after)).toEqual(view(layout))
  })

  it('перетаскивание в свободную ячейку переносит предмет', () => {
    const layout = [seed('carrot'), null, ...Array(8).fill(null)] as (ToolbarItem | null)[]
    expect(view(moveItem(layout, 0, 5))[5]).toBe('seed:carrot')
    expect(view(moveItem(layout, 0, 5))[0]).toBe('-')
  })

  it('перетаскивание в занятую ячейку меняет предметы местами', () => {
    const layout = [seed('carrot'), item('tomato'), ...Array(8).fill(null)] as (
      | ToolbarItem
      | null
    )[]
    expect(view(moveItem(layout, 0, 1)).slice(0, 2)).toEqual(['item:tomato', 'seed:carrot'])
  })

  it('перетаскивание пустой ячейки ничего не делает', () => {
    const layout = reconcileToolbar(emptyToolbar(), noSeeds, none)
    expect(moveItem(layout, 3, 4)).toBe(layout)
  })
})
