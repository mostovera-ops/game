/**
 * Мост между сеткой двора (game/grid, чистая арифметика) и трёхмерной сценой.
 *
 * Здесь и только здесь клетки становятся мировыми координатами three, а коробки
 * пропсов — занятыми клетками. game/ про метры не знает, scene/ про правила
 * размещения — тоже: посередине стоит этот модуль.
 */
import {
  CELL,
  YARD,
  cellCenter,
  cellKey,
  localToCell,
  placementCenter,
  rotatedSize,
  rotationY,
  worldToCell,
  type Placed,
} from '../game/grid'
import { BUILDABLES, footprintOf, type BuildableId, type Placement } from '../game/buildables'
import type { Collider, RectCollider } from './collision'

/** Верх почвы: на этой высоте сидят растения (совпадает с _export_bed.py). */
export const SOIL_TOP_Y = 0.295

export interface BedTransform {
  x: number
  z: number
  rotationY: number
}

/** Куда и как повёрнуто ставить меш грядки. */
export function bedTransform(p: Placed, def: BuildableId): BedTransform {
  const c = placementCenter(p, footprintOf(def))
  return { x: c.x, z: c.z, rotationY: rotationY(p.rot) }
}

export interface SlotPos {
  id: string
  position: [number, number, number]
}

/** Мировые позиции всех слотов посадки размещения. */
export function slotPositions(p: Placement): SlotPos[] {
  const fp = footprintOf(p.def)
  return BUILDABLES[p.def].slotCells.map((local, i) => {
    const cell = localToCell(p, fp, local[0], local[1])
    const { x, z } = cellCenter(cell.gx, cell.gz)
    return { id: `${p.id}:${i}`, position: [x, SOIL_TOP_Y, z] }
  })
}

/**
 * Прямоугольный коллайдер грядки из её клеток. Повороты кратны 90°, поэтому
 * прямоугольник остаётся выровненным по осям: rot не нужен, стороны уже
 * переставлены в rotatedSize.
 */
export function bedCollider(p: Placement): RectCollider {
  const s = rotatedSize(footprintOf(p.def), p.rot)
  const c = placementCenter(p, footprintOf(p.def))
  return { kind: 'rect', x: c.x, z: c.z, rot: 0, hx: (s.w * CELL) / 2, hz: (s.d * CELL) / 2 }
}

/**
 * Клетки двора, занятые неподвижными коллайдерами (дом, теплица, деревья).
 *
 * Клетку считаем занятой, если её центр попадает в фигуру, расширенную на
 * полклетки: пропс, задевший клетку краем, всё равно мешает поставить туда
 * грядку. Оценка чуть щедрая — и это правильная сторона ошибки: лучше не дать
 * построить впритык к стене, чем дать грядке наехать на угол дома.
 */
export function staticYardCells(colliders: readonly Collider[]): string[] {
  const out: string[] = []
  const half = CELL / 2
  for (let gx = YARD.gx0; gx <= YARD.gx1; gx++) {
    for (let gz = YARD.gz0; gz <= YARD.gz1; gz++) {
      const { x, z } = cellCenter(gx, gz)
      if (colliders.some((c) => hits(c, x, z, half))) out.push(cellKey(gx, gz))
    }
  }
  return out
}

function hits(c: Collider, x: number, z: number, margin: number): boolean {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) <= c.r + margin
  const cos = Math.cos(c.rot)
  const sin = Math.sin(c.rot)
  const dx = x - c.x
  const dz = z - c.z
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  return Math.abs(lx) <= c.hx + margin && Math.abs(lz) <= c.hz + margin
}

/** Клетка под мировой точкой — для клика по земле в режиме стройки. */
export { worldToCell }
