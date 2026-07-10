import { describe, expect, it } from 'vitest'
import { blockedCells, footprintOf, nextRot, placeable, type Placement } from './buildables'
import { cellKey, placementCells } from './grid'

const bed = (id: string, gx: number, gz: number, rot: 0 | 1 | 2 | 3 = 0): Placement => ({
  id,
  def: 'raised_bed',
  gx,
  gz,
  rot,
})

describe('nextRot', () => {
  it('идёт по кругу четвертями', () => {
    expect([nextRot(0), nextRot(1), nextRot(2), nextRot(3)]).toEqual([1, 2, 3, 0])
  })
})

describe('blockedCells', () => {
  it('собирает клетки всех размещений и статики', () => {
    const cells = blockedCells([bed('a', 0, 0)], [cellKey(9, 9)])
    expect(cells.has(cellKey(0, 0))).toBe(true)
    expect(cells.has(cellKey(2, 0))).toBe(true)
    expect(cells.has(cellKey(9, 9))).toBe(true)
  })

  it('исключает указанное размещение — грядка не мешает сама себе', () => {
    const cells = blockedCells([bed('a', 0, 0)], [], 'a')
    for (const c of placementCells(bed('a', 0, 0), footprintOf('raised_bed'))) {
      expect(cells.has(cellKey(c.gx, c.gz))).toBe(false)
    }
  })
})

describe('placeable', () => {
  const yard = { gx: 0, gz: 0 }

  it('на пустой двор — можно', () => {
    expect(placeable([], [], 'raised_bed', { ...yard, rot: 0 })).toBe(true)
  })

  it('поверх другой грядки — нельзя', () => {
    const existing = [bed('a', 0, 0)]
    expect(placeable(existing, [], 'raised_bed', { gx: 1, gz: 0, rot: 0 })).toBe(false)
  })

  it('вплотную рядом — можно', () => {
    const existing = [bed('a', 0, 0)]
    expect(placeable(existing, [], 'raised_bed', { gx: 0, gz: 1, rot: 0 })).toBe(true)
  })

  it('грядка на своё же место со сдвигом — можно, если себя исключить', () => {
    const existing = [bed('a', 0, 0)]
    // Без exceptId клетка (1,0) занята самой грядкой.
    expect(placeable(existing, [], 'raised_bed', { gx: 1, gz: 0, rot: 0 })).toBe(false)
    expect(placeable(existing, [], 'raised_bed', { gx: 1, gz: 0, rot: 0 }, 'a')).toBe(true)
  })
})
