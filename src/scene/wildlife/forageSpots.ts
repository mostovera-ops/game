/**
 * Что и где растёт в лесу.
 *
 * Точки не хранятся в сохранении: они выводятся из расстановки деревьев и
 * номера дня. Стор помнит лишь id собранных точек — так game/ ничего не знает
 * о координатах, а сцена не знает о правилах (см. CLAUDE.md о границе).
 *
 * Грибы и мухоморы каждую ночь вырастают на новых деревьях: зерно случайности —
 * номер дня, поэтому раскладка одна и та же весь день и переживает любую
 * перерисовку React. Игрок не может запомнить, у какого ствола гриб съедобный, —
 * ему приходится смотреть на шапку.
 *
 * Гнездо, наоборот, всегда на одном месте: это дом, а не урожай. Яйцо в нём
 * появляется и пропадает, само гнездо стоит.
 *
 * Всё это жмётся к стволу со стороны фермы: у самого дерева видно, а герой
 * дотягивается, не упираясь в коллайдер ствола.
 */
import type { ForageId } from '../../game/store'
import { FARM, seededRandom, shuffled, type Point } from './roam'

/** Мухомор — не находка: съесть его нельзя, можно только пожалеть об этом. */
export type FindKind = ForageId | 'toadstool'

export interface FindSpot {
  /** `mushroom:0`, `egg:0`, `toadstool:2`. Первые два вида стор кладёт в takenForage. */
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
 * Сколько грибов и мухоморов растёт одновременно. Грибов трое: спрос на них
 * вдвое выше (два на порцию), и отрастают они неохотнее — см. MUSHROOM_REGROW
 * в game/store.ts. Гнездо ровно одно: яйцо — самая редкая находка.
 */
const MUSHROOMS = 3
const TOADSTOOLS = 3

/**
 * Из скольких деревьев выбираем. Больше числа находок: иначе «новое место»
 * каждую ночь означало бы одни и те же шесть стволов в другом порядке.
 */
const CANDIDATES = 10

/** Место находки у ствола: сдвинуто к ферме, на видимую сторону дерева. */
function spotAt(tree: Point, id: string, kind: FindKind): FindSpot {
  const dx = FARM.x - tree.x
  const dz = FARM.z - tree.z
  const len = Math.hypot(dx, dz) || 1
  return {
    id,
    kind,
    x: tree.x + (dx / len) * TRUNK_OFFSET,
    z: tree.z + (dz / len) * TRUNK_OFFSET,
    // Поворот выводим из координат, а не из случайности: он должен пережить
    // перерисовку, иначе гриб дёргался бы на каждом кадре React.
    rotationY: (tree.x * 1.7 + tree.z * 2.3) % (Math.PI * 2),
  }
}

/**
 * Находки при деревьях из кольца вокруг фермы.
 *
 * `seed` — номер дня. Деревья-кандидаты берём не подряд, а с равным шагом по
 * списку, отсортированному по расстоянию: подряд идущие в scene-layout.json
 * ёлки часто стоят кучей, и все грибы выросли бы в одном углу.
 *
 * Грибы и мухоморы раздаём по перемешанным кандидатам вперемешку, через одного.
 * Так при трёх деревьях в лесу окажется и гриб, и мухомор, и гнездо, а не три
 * гриба: яичница иначе была бы недостижима.
 */
export function forestFinds(trees: readonly Point[], seed = 0): FindSpot[] {
  const ring = trees
    .map((t) => ({ t, r: Math.hypot(t.x - FARM.x, t.z - FARM.z) }))
    .filter((e) => e.r >= R_MIN && e.r <= R_MAX)
    .sort((a, b) => a.r - b.r)

  if (!ring.length) return []

  const count = Math.min(CANDIDATES, ring.length)
  const step = ring.length / count
  const candidates = Array.from({ length: count }, (_, i) => ring[Math.floor(i * step)].t)

  // Гнездо занимает середину кольца и никуда не переезжает.
  const nestAt = Math.floor(count / 2)
  const nest = spotAt(candidates[nestAt], 'egg:0', 'egg')

  const rest = shuffled(
    candidates.filter((_, i) => i !== nestAt),
    seededRandom(seed),
  )

  const spots: FindSpot[] = [nest]
  let mushrooms = 0
  let toadstools = 0
  for (const tree of rest) {
    if (mushrooms >= MUSHROOMS && toadstools >= TOADSTOOLS) break
    // Через одного: гриб, мухомор, гриб… Пока квота одного вида не кончится.
    const wantMushroom = mushrooms <= toadstools
    if (wantMushroom && mushrooms < MUSHROOMS) {
      spots.push(spotAt(tree, `mushroom:${mushrooms}`, 'mushroom'))
      mushrooms++
    } else if (toadstools < TOADSTOOLS) {
      spots.push(spotAt(tree, `toadstool:${toadstools}`, 'toadstool'))
      toadstools++
    } else {
      spots.push(spotAt(tree, `mushroom:${mushrooms}`, 'mushroom'))
      mushrooms++
    }
  }

  return spots
}
