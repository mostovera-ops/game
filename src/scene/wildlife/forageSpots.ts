/**
 * Где в лесу лежат находки.
 *
 * Точки не случайны и не хранятся в сохранении: они выводятся из расстановки
 * деревьев, а значит одинаковы в каждой сессии. Стор помнит лишь id собранных
 * за сегодня — так game/ ничего не знает о координатах, а сцена не знает о
 * правилах (см. CLAUDE.md о границе).
 *
 * Гриб и гнездо жмутся к стволу со стороны фермы: у самого дерева их видно,
 * а герой дотягивается, не упираясь в коллайдер ствола.
 */
import type { ForageId } from '../../game/store'
import { FARM, type Point } from './roam'

export interface ForageSpot {
  /** `mushroom:0`, `egg:1` — этот id стор кладёт в takenForage. */
  id: string
  item: ForageId
  x: number
  z: number
  /** Поворот вокруг Y, чтобы одинаковые пропсы не выглядели штампованными. */
  rotationY: number
}

/** Ближе этого к ферме находок нет: лес начинается за грядками. */
const R_MIN = 5

/** Дальше — за пределами кадра, и игрок их не найдёт. */
const R_MAX = 10

/** Насколько отступаем от ствола: радиус коллайдера дерева 0.26, плюс запас. */
const TRUNK_OFFSET = 0.85

const MUSHROOMS = 4
const NESTS = 2

/**
 * Находки при деревьях из кольца вокруг фермы.
 *
 * Деревья берём не подряд, а с равным шагом по списку, отсортированному по
 * расстоянию: подряд идущие в scene-layout.json ёлки часто стоят кучей, и
 * четыре гриба выросли бы в одном углу.
 */
export function forageSpots(trees: readonly Point[]): ForageSpot[] {
  const ring = trees
    .map((t) => ({ t, r: Math.hypot(t.x - FARM.x, t.z - FARM.z) }))
    .filter((e) => e.r >= R_MIN && e.r <= R_MAX)
    .sort((a, b) => a.r - b.r)

  const total = MUSHROOMS + NESTS
  if (!ring.length) return []

  // Деревьев в кольце может оказаться меньше, чем находок. Тогда режем число
  // находок, а не берём дерево дважды: два гриба в одной точке не разделить.
  const count = Math.min(total, ring.length)
  const mushrooms = Math.min(MUSHROOMS, Math.max(1, count - NESTS))
  const step = ring.length / count
  const spots: ForageSpot[] = []

  for (let i = 0; i < count; i++) {
    const { t } = ring[Math.floor(i * step)]
    // Смещаем к ферме: находка оказывается на видимой стороне ствола.
    const dx = FARM.x - t.x
    const dz = FARM.z - t.z
    const len = Math.hypot(dx, dz) || 1
    const item: ForageId = i < mushrooms ? 'mushroom' : 'egg'
    const index = i < mushrooms ? i : i - mushrooms
    spots.push({
      id: `${item}:${index}`,
      item,
      x: t.x + (dx / len) * TRUNK_OFFSET,
      z: t.z + (dz / len) * TRUNK_OFFSET,
      // Поворот выводим из координат, а не из Math.random: он должен пережить
      // перерисовку, иначе гриб дёргался бы на каждом кадре React.
      rotationY: (t.x * 1.7 + t.z * 2.3) % (Math.PI * 2),
    })
  }

  return spots
}
