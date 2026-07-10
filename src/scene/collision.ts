/**
 * Столкновения героя с пропсами.
 *
 * Формы не задаются руками: коробки берутся из bbox загруженного GLB, поэтому
 * если пропс поменяет размер в Blender, коллайдер поедет за ним сам.
 *
 * Дом, теплица, фудтрак, грядки и брёвна — повёрнутые прямоугольники.
 * Деревья и кусты — круги: их bbox описывает крону, а упираться игрок должен
 * в ствол, иначе не пройти между деревьями.
 *
 * Разрешение — выталкивание: считаем ближайшую точку фигуры, и если герой
 * ближе своего радиуса, отодвигаем его по нормали. Скольжение вдоль стены
 * получается само: по касательной выталкивания нет.
 */
import * as THREE from 'three'

export interface RectCollider {
  kind: 'rect'
  x: number
  z: number
  /** Поворот вокруг Y, радианы. */
  rot: number
  /** Полуразмеры по локальным осям X и Z. */
  hx: number
  hz: number
}

export interface CircleCollider {
  kind: 'circle'
  x: number
  z: number
  r: number
}

export type Collider = RectCollider | CircleCollider

/** Полуразмеры bbox объекта по X и Z в его собственных координатах. */
export function halfExtentsXZ(object: THREE.Object3D): { hx: number; hz: number } {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  return { hx: size.x / 2, hz: size.z / 2 }
}

/**
 * Отодвигает точку из всех фигур, в которые она провалилась.
 * Несколько проходов: выйдя из одной стены, герой может въехать в соседнюю
 * (внутренний угол дома и грядки).
 */
export function resolveCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: readonly Collider[],
  passes = 3,
): { x: number; z: number } {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false
    for (const c of colliders) {
      const next = c.kind === 'circle' ? pushOutCircle(x, z, radius, c) : pushOutRect(x, z, radius, c)
      if (next) {
        x = next.x
        z = next.z
        moved = true
      }
    }
    if (!moved) break
  }
  return { x, z }
}

function pushOutCircle(
  x: number,
  z: number,
  radius: number,
  c: CircleCollider,
): { x: number; z: number } | null {
  const dx = x - c.x
  const dz = z - c.z
  const minDist = c.r + radius
  const dist = Math.hypot(dx, dz)
  if (dist >= minDist) return null
  // Ровно в центре нормали нет — толкаем в произвольную сторону, лишь бы наружу.
  if (dist < 1e-6) return { x: c.x + minDist, z: c.z }
  const k = minDist / dist
  return { x: c.x + dx * k, z: c.z + dz * k }
}

function pushOutRect(
  x: number,
  z: number,
  radius: number,
  c: RectCollider,
): { x: number; z: number } | null {
  // В локальные координаты прямоугольника. Знаки — как у three: поворот на rot
  // вокруг Y даёт x' = x·cos + z·sin, z' = −x·sin + z·cos, ниже обратное к нему.
  // Ошибиться тут было легко и незаметно: у всех пропсов, кроме фудтрака, rot
  // равен нулю, а на нуле обе версии совпадают.
  const cos = Math.cos(c.rot)
  const sin = Math.sin(c.rot)
  const dx = x - c.x
  const dz = z - c.z
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos

  // Ближайшая точка прямоугольника к герою.
  const px = THREE.MathUtils.clamp(lx, -c.hx, c.hx)
  const pz = THREE.MathUtils.clamp(lz, -c.hz, c.hz)
  const inside = px === lx && pz === lz

  let nx: number
  let nz: number
  if (inside) {
    // Герой внутри: выталкиваем через ближайшую грань.
    const toX = c.hx - Math.abs(lx)
    const toZ = c.hz - Math.abs(lz)
    if (toX < toZ) {
      nx = Math.sign(lx) * (c.hx + radius)
      nz = lz
    } else {
      nx = lx
      nz = Math.sign(lz) * (c.hz + radius)
    }
  } else {
    const ox = lx - px
    const oz = lz - pz
    const dist = Math.hypot(ox, oz)
    if (dist >= radius) return null
    if (dist < 1e-6) return null
    const k = radius / dist
    nx = px + ox * k
    nz = pz + oz * k
  }

  // Обратно в мировые.
  return {
    x: c.x + nx * cos + nz * sin,
    z: c.z - nx * sin + nz * cos,
  }
}
