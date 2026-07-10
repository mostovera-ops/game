/**
 * Каталог объектов, которые стоят на сетке двора.
 *
 * Отдельный модуль, а не часть store.ts: каталог читают и стор, и сцена, а стор
 * от сцены не зависит. Имя GLB-пропса здесь не хранится — это забота
 * assets/scene.ts, как и у культур.
 */
import { canPlace, cellKey, placementCells, type Footprint, type Placed, type Rot } from './grid'

export type BuildableId = 'raised_bed'

export type Category = 'functional' | 'decor'

export interface Buildable {
  footprint: Footprint
  category: Category
  /**
   * Локальные клетки слотов посадки, до поворота. Пусто у всего, во что не сеют.
   * Порядок задаёт номер слота в его id.
   */
  slotCells: readonly (readonly [number, number])[]
  /** Можно ли двигать. Дом и теплица стоят намертво и в каталог не входят вовсе. */
  movable: boolean
}

export const BUILDABLES: Record<BuildableId, Buildable> = {
  raised_bed: {
    footprint: { w: 3, d: 1 },
    category: 'functional',
    slotCells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    movable: true,
  },
}

/** Размещение объекта на сетке. */
export interface Placement extends Placed {
  id: string
  def: BuildableId
}

export const footprintOf = (def: BuildableId): Footprint => BUILDABLES[def].footprint

/**
 * Клетки, занятые всем, кроме размещения `exceptId`.
 *
 * Себя надо исключать: иначе грядка, сдвинутая на клетку, наезжала бы на
 * собственную старую позицию и никуда не двигалась.
 *
 * `staticCells` приходят из сцены — это дом, теплица, лавка и деревья, чьи
 * коробки известны только по GLB. Стор их не выводит, а принимает как данность.
 */
export function blockedCells(
  placements: readonly Placement[],
  staticCells: readonly string[],
  exceptId?: string,
): Set<string> {
  const out = new Set(staticCells)
  for (const p of placements) {
    if (p.id === exceptId) continue
    for (const c of placementCells(p, footprintOf(p.def))) out.add(cellKey(c.gx, c.gz))
  }
  return out
}

/** Влезет ли размещение сюда, с учётом всех остальных. */
export function placeable(
  placements: readonly Placement[],
  staticCells: readonly string[],
  def: BuildableId,
  target: Placed,
  exceptId?: string,
): boolean {
  return canPlace(target, footprintOf(def), blockedCells(placements, staticCells, exceptId))
}

/** Следующая четверть оборота. */
export const nextRot = (rot: Rot): Rot => (((rot + 1) % 4) as Rot)
