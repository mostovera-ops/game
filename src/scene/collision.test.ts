import { describe, expect, it } from 'vitest'
import { resolveCollisions, type Collider } from './collision'

const R = 0.2 // радиус героя в тестах

describe('выталкивание из круга', () => {
  const tree: Collider = { kind: 'circle', x: 0, z: 0, r: 0.5 }

  it('снаружи не трогает', () => {
    const p = resolveCollisions(2, 0, R, [tree])
    expect(p).toEqual({ x: 2, z: 0 })
  })

  it('внутри выталкивает ровно на сумму радиусов', () => {
    const p = resolveCollisions(0.3, 0, R, [tree])
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.7, 5)
    expect(p.z).toBeCloseTo(0, 5)
  })

  it('из самого центра всё равно выходит наружу', () => {
    const p = resolveCollisions(0, 0, R, [tree])
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.7, 5)
  })
})

describe('выталкивание из прямоугольника', () => {
  const house: Collider = { kind: 'rect', x: 0, z: 0, rot: 0, hx: 1.5, hz: 1.5 }

  it('снаружи не трогает', () => {
    expect(resolveCollisions(3, 0, R, [house])).toEqual({ x: 3, z: 0 })
  })

  it('у грани отодвигает по нормали, вдоль стены не двигает', () => {
    const p = resolveCollisions(1.6, 0.9, R, [house])
    expect(p.x).toBeCloseTo(1.7, 5) // hx + R
    expect(p.z).toBeCloseTo(0.9, 5) // скольжение вдоль стены сохраняется
  })

  it('изнутри выходит через ближайшую грань', () => {
    const p = resolveCollisions(1.4, 0.1, R, [house])
    expect(p.x).toBeCloseTo(1.7, 5)
  })

  it('угол выталкивает по диагонали', () => {
    const p = resolveCollisions(1.55, 1.55, R, [house])
    const dx = p.x - 1.5
    const dz = p.z - 1.5
    expect(Math.hypot(dx, dz)).toBeCloseTo(R, 5)
  })
})

describe('повёрнутый прямоугольник (грядка)', () => {
  // Грядка 1.6×0.6, повёрнутая на 90°: длинная сторона теперь вдоль Z.
  const bed: Collider = { kind: 'rect', x: 0, z: 0, rot: Math.PI / 2, hx: 0.8, hz: 0.3 }

  it('вдоль короткой стороны препятствие узкое', () => {
    // По X теперь полуширина 0.3 — точка на 0.6 снаружи.
    expect(resolveCollisions(0.6, 0, R, [bed])).toEqual({ x: 0.6, z: 0 })
  })

  it('вдоль длинной стороны препятствие широкое', () => {
    // По Z полудлина 0.8 — точка на 0.6 внутри, её выталкивает.
    const p = resolveCollisions(0, 0.6, R, [bed])
    expect(Math.abs(p.z)).toBeCloseTo(1.0, 5) // 0.8 + 0.2
  })
})

describe('несколько препятствий', () => {
  it('внутренний угол не выпихивает обратно в стену', () => {
    const walls: Collider[] = [
      { kind: 'rect', x: 0, z: 0, rot: 0, hx: 1, hz: 1 },
      { kind: 'rect', x: 2.2, z: 0, rot: 0, hx: 1, hz: 1 },
    ]
    // Щель между стенами шириной 0.2 — герой радиусом 0.2 не пролезает,
    // но и не должен остаться внутри какой-либо из коробок.
    const p = resolveCollisions(1.1, 0, R, walls)
    const inA = Math.abs(p.x - 0) < 1 && Math.abs(p.z) < 1
    const inB = Math.abs(p.x - 2.2) < 1 && Math.abs(p.z) < 1
    expect(inA || inB).toBe(false)
  })
})
