import { describe, expect, it } from 'vitest'
import {
  CELL,
  canPlace,
  cellCenter,
  cellKey,
  inYard,
  localToCell,
  overlaps,
  placementCells,
  placementCenter,
  ringCells,
  rotatedSize,
  rotationY,
  worldToCell,
  type Footprint,
  type Placed,
} from './grid'

/** Грядка: три слота в ряд, глубиной в клетку. */
const BED: Footprint = { w: 3, d: 1 }

const blocked = (cells: [number, number][]) => new Set(cells.map(([x, z]) => cellKey(x, z)))

describe('клетка и мир', () => {
  it('клетка (0,0) лежит в первом квадранте, её центр — не начало координат', () => {
    expect(cellCenter(0, 0)).toEqual({ x: 0.25, z: 0.25 })
    expect(cellCenter(-1, -1)).toEqual({ x: -0.25, z: -0.25 })
  })

  it('worldToCell обратна cellCenter', () => {
    for (const [gx, gz] of [
      [0, 0],
      [-3, 7],
      [12, -8],
    ]) {
      const { x, z } = cellCenter(gx, gz)
      expect(worldToCell(x, z)).toEqual({ gx, gz })
    }
  })

  it('точка на границе клетки принадлежит правой клетке', () => {
    expect(worldToCell(0, 0)).toEqual({ gx: 0, gz: 0 })
    expect(worldToCell(-CELL, -CELL)).toEqual({ gx: -1, gz: -1 })
  })
})

describe('поворот', () => {
  it('нечётные четверти меняют стороны местами', () => {
    expect(rotatedSize(BED, 0)).toEqual({ w: 3, d: 1 })
    expect(rotatedSize(BED, 1)).toEqual({ w: 1, d: 3 })
    expect(rotatedSize(BED, 2)).toEqual({ w: 3, d: 1 })
    expect(rotatedSize(BED, 3)).toEqual({ w: 1, d: 3 })
  })

  it('угол меша — четверть оборота', () => {
    expect(rotationY(0)).toBe(0)
    expect(rotationY(1)).toBeCloseTo(Math.PI / 2)
    expect(rotationY(3)).toBeCloseTo((3 * Math.PI) / 2)
  })

  it('слоты грядки при любом повороте лежат внутри её же клеток и не совпадают', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const p: Placed = { gx: 4, gz: -2, rot }
      const own = new Set(placementCells(p, BED).map((c) => cellKey(c.gx, c.gz)))
      const slots = [0, 1, 2].map((i) => localToCell(p, BED, i, 0))
      for (const s of slots) expect(own.has(cellKey(s.gx, s.gz))).toBe(true)
      expect(new Set(slots.map((s) => cellKey(s.gx, s.gz))).size).toBe(3)
    }
  })

  it('поворот на 90° разворачивает ряд слотов из строки в столбец', () => {
    const p: Placed = { gx: 0, gz: 0, rot: 1 }
    const slots = [0, 1, 2].map((i) => localToCell(p, BED, i, 0))
    expect(slots).toEqual([
      { gx: 0, gz: 0 },
      { gx: 0, gz: 1 },
      { gx: 0, gz: 2 },
    ])
  })

  it('поворот на 180° переворачивает порядок слотов, но не место грядки', () => {
    const a: Placed = { gx: 2, gz: 3, rot: 0 }
    const b: Placed = { gx: 2, gz: 3, rot: 2 }
    expect(placementCenter(a, BED)).toEqual(placementCenter(b, BED))
    expect(localToCell(a, BED, 0, 0)).toEqual(localToCell(b, BED, 2, 0))
  })
})

describe('центр и клетки', () => {
  it('центр грядки 3×1 стоит в центре средней клетки', () => {
    const p: Placed = { gx: 7, gz: 2, rot: 0 }
    expect(placementCenter(p, BED)).toEqual(cellCenter(8, 2))
  })

  it('центр пропса с чётной стороной ложится на линию сетки', () => {
    expect(placementCenter({ gx: -3, gz: -3, rot: 0 }, { w: 6, d: 6 })).toEqual({ x: 0, z: 0 })
  })

  it('клеток ровно w×d, и все разные', () => {
    const cells = placementCells({ gx: 0, gz: 0, rot: 1 }, BED)
    expect(cells).toHaveLength(3)
    expect(new Set(cells.map((c) => cellKey(c.gx, c.gz))).size).toBe(3)
  })
})

describe('двор', () => {
  it('грядка у самого края двора помещается, за краем — нет', () => {
    expect(inYard({ gx: 11, gz: 7, rot: 0 }, BED)).toBe(true)
    expect(inYard({ gx: 12, gz: 7, rot: 0 }, BED)).toBe(false)
    expect(inYard({ gx: -14, gz: -8, rot: 0 }, BED)).toBe(true)
    expect(inYard({ gx: -15, gz: -8, rot: 0 }, BED)).toBe(false)
  })

  it('повёрнутая грядка упирается в другую границу', () => {
    expect(inYard({ gx: 13, gz: 5, rot: 1 }, BED)).toBe(true)
    expect(inYard({ gx: 13, gz: 6, rot: 1 }, BED)).toBe(false)
  })
})

describe('пересечения', () => {
  it('соседние грядки не пересекаются, наехавшие — да', () => {
    const a: Placed = { gx: 0, gz: 0, rot: 0 }
    expect(overlaps(a, BED, { gx: 3, gz: 0, rot: 0 }, BED)).toBe(false)
    expect(overlaps(a, BED, { gx: 2, gz: 0, rot: 0 }, BED)).toBe(true)
    expect(overlaps(a, BED, { gx: 0, gz: 1, rot: 0 }, BED)).toBe(false)
  })

  it('поворот учитывается: то, что мимо вдоль, задевает поперёк', () => {
    const a: Placed = { gx: 0, gz: 0, rot: 0 }
    expect(overlaps(a, BED, { gx: 1, gz: -1, rot: 0 }, BED)).toBe(false)
    expect(overlaps(a, BED, { gx: 1, gz: -1, rot: 1 }, BED)).toBe(true)
  })
})

describe('canPlace', () => {
  it('на пустом дворе можно', () => {
    expect(canPlace({ gx: 0, gz: 0, rot: 0 }, BED, new Set())).toBe(true)
  })

  it('нельзя за границей двора', () => {
    expect(canPlace({ gx: 13, gz: 0, rot: 0 }, BED, new Set())).toBe(false)
  })

  it('нельзя поверх занятой клетки — хватает и одной', () => {
    expect(canPlace({ gx: 0, gz: 0, rot: 0 }, BED, blocked([[2, 0]]))).toBe(false)
  })

  it('нельзя замуровать: если весь периметр занят, ставить некуда', () => {
    const p: Placed = { gx: 0, gz: 0, rot: 0 }
    const ring = ringCells(p, BED).map((c): [number, number] => [c.gx, c.gz])
    expect(canPlace(p, BED, blocked(ring))).toBe(false)
    // Освободили одну клетку периметра — подойти уже можно.
    expect(canPlace(p, BED, blocked(ring.slice(1)))).toBe(true)
  })

  it('периметр — восемь клеток без углов', () => {
    const ring = ringCells({ gx: 0, gz: 0, rot: 0 }, BED)
    expect(ring).toHaveLength(3 * 2 + 1 * 2)
    expect(ring).not.toContainEqual({ gx: -1, gz: -1 })
  })
})
