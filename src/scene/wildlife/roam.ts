/**
 * Общая геометрия блужданий: где живности можно ходить и как ей поворачивать.
 *
 * Чистый модуль без three-объектов в состоянии — его считают все движки
 * живности, и разъехаться им нельзя. Тесты рядом, в roam.test.ts.
 */

const TAU = Math.PI * 2

/**
 * Центр фермы. Не начало координат: дом стоит в (0, 0), но грядки, фудтрак и
 * лавка сдвинуты, и «подальше от построек» считается от их середины.
 */
export const FARM = { x: 2.0, z: -1.5 }

/** Полуразмер земли (plane 40×40). Дальше живность не уходит — там ничего нет. */
export const WORLD_HALF = 19

export const rand = (min: number, max: number): number => min + Math.random() * (max - min)

export const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/** Кратчайший поворот из from в to, в пределах ±π. */
export function shortestAngle(from: number, to: number): number {
  return (((to - from + Math.PI) % TAU) + TAU) % TAU - Math.PI
}

/**
 * Кадронезависимый доворот к целевому углу. Тот же экспоненциальный закон, что
 * у THREE.MathUtils.damp, но по кратчайшей дуге: иначе поворот с 3.1 на −3.1
 * шёл бы через полный круг.
 */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + shortestAngle(current, target) * (1 - Math.exp(-lambda * dt))
}

/** Куда смотреть, чтобы видеть точку (dx, dz). Все модели глядят на −Z. */
export function yawTo(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/** Высота прыжка: 0 на концах, 1 в середине. */
export const hopArc = (t: number): number => Math.sin(Math.PI * t)

export interface Point {
  x: number
  z: number
}

/** Дальше ли точка, чем minDist, от каждой из points. */
export function clearOf(x: number, z: number, points: readonly Point[], minDist: number): boolean {
  const sq = minDist * minDist
  for (const p of points) {
    const dx = x - p.x
    const dz = z - p.z
    if (dx * dx + dz * dz < sq) return false
  }
  return true
}

/**
 * Случайная точка в кольце вокруг фермы, не ближе minDist к стволам.
 *
 * Кольцо, а не круг: внутри построек живности делать нечего, а за WORLD_HALF
 * кончается земля. Радиус берём через корень — иначе точки скучиваются у
 * внутреннего края, где кольцо у́же.
 *
 * Если за tries попыток чистого места не нашлось (густой лес), возвращаем
 * последнюю попытку: кролик разок пройдёт сквозь ёлку, и это лучше, чем
 * бесконечный цикл в useFrame.
 */
export function forestPoint(
  rMin: number,
  rMax: number,
  trees: readonly Point[],
  minDist: number,
  tries = 12,
): Point {
  let last: Point = FARM
  for (let i = 0; i < tries; i++) {
    const angle = Math.random() * TAU
    const r = Math.sqrt(rand(rMin * rMin, rMax * rMax))
    last = { x: FARM.x + Math.cos(angle) * r, z: FARM.z + Math.sin(angle) * r }
    if (Math.abs(last.x) > WORLD_HALF || Math.abs(last.z) > WORLD_HALF) continue
    if (clearOf(last.x, last.z, trees, minDist)) return last
  }
  return last
}
