/**
 * Что и где растёт в лесу.
 *
 * Точки не случайны и не хранятся в сохранении: они выводятся из расстановки
 * деревьев, а значит одинаковы в каждой сессии. Стор помнит лишь id собранных
 * за сегодня — так game/ ничего не знает о координатах, а сцена не знает о
 * правилах (см. CLAUDE.md о границе).
 *
 * Находок два вида — гриб и гнездо, — но растёт в лесу и третье: мухомор.
 * Он не собирается и в стор не попадает, поэтому лежит здесь же, а не в
 * game/: для правил его не существует, он декорация с репликой.
 *
 * Всё это жмётся к стволу со стороны фермы: у самого дерева видно, а герой
 * дотягивается, не упираясь в коллайдер ствола.
 */
import type { ForageId } from '../../game/store'
import { FARM, type Point } from './roam'

/** Мухомор — не находка: съесть его нельзя, можно только пожалеть об этом. */
export type FindKind = ForageId | 'toadstool'

export interface FindSpot {
  /** `mushroom:0`, `egg:1`, `toadstool:2`. Первые два стор кладёт в takenForage. */
  id: string
  kind: FindKind
  x: number
  z: number
  /** Поворот вокруг Y, чтобы одинаковые пропсы не выглядели штампованными. */
  rotationY: number
}

/** Точка, которую можно подобрать. */
export type ForageSpot = FindSpot & { kind: ForageId }

export const isForage = (spot: FindSpot): spot is ForageSpot => spot.kind !== 'toadstool'

/** Ближе этого к ферме находок нет: лес начинается за грядками. */
const R_MIN = 5

/** Дальше — за пределами кадра, и игрок их не найдёт. */
const R_MAX = 10

/** Насколько отступаем от ствола: радиус коллайдера дерева 0.26, плюс запас. */
const TRUNK_OFFSET = 0.85

/**
 * Что растёт у i-го выбранного дерева.
 *
 * Порядок перемешан намеренно: деревья отсортированы по расстоянию от фермы, и
 * при сплошных блоках все грибы оказались бы у ближней опушки, а гнёзда — у
 * дальней. Первые три вида покрывают все три: даже если деревьев хватило только
 * на три точки, игрок увидит и гриб, и гнездо, и мухомор.
 */
const KIND_ORDER: readonly FindKind[] = [
  'mushroom',
  'toadstool',
  'egg',
  'mushroom',
  'mushroom',
  'toadstool',
  'egg',
  'mushroom',
  'toadstool',
]

/**
 * Находки при деревьях из кольца вокруг фермы.
 *
 * Деревья берём не подряд, а с равным шагом по списку, отсортированному по
 * расстоянию: подряд идущие в scene-layout.json ёлки часто стоят кучей, и
 * четыре гриба выросли бы в одном углу.
 */
export function forestFinds(trees: readonly Point[]): FindSpot[] {
  const ring = trees
    .map((t) => ({ t, r: Math.hypot(t.x - FARM.x, t.z - FARM.z) }))
    .filter((e) => e.r >= R_MIN && e.r <= R_MAX)
    .sort((a, b) => a.r - b.r)

  if (!ring.length) return []

  // Деревьев в кольце может оказаться меньше, чем находок. Тогда режем их
  // число, а не берём дерево дважды: два гриба в одной точке не разделить.
  const count = Math.min(KIND_ORDER.length, ring.length)
  const step = ring.length / count
  const seen: Partial<Record<FindKind, number>> = {}
  const spots: FindSpot[] = []

  for (let i = 0; i < count; i++) {
    const { t } = ring[Math.floor(i * step)]
    // Смещаем к ферме: находка оказывается на видимой стороне ствола.
    const dx = FARM.x - t.x
    const dz = FARM.z - t.z
    const len = Math.hypot(dx, dz) || 1
    const kind = KIND_ORDER[i]
    const index = seen[kind] ?? 0
    seen[kind] = index + 1
    spots.push({
      id: `${kind}:${index}`,
      kind,
      x: t.x + (dx / len) * TRUNK_OFFSET,
      z: t.z + (dz / len) * TRUNK_OFFSET,
      // Поворот выводим из координат, а не из Math.random: он должен пережить
      // перерисовку, иначе гриб дёргался бы на каждом кадре React.
      rotationY: (t.x * 1.7 + t.z * 2.3) % (Math.PI * 2),
    })
  }

  return spots
}
