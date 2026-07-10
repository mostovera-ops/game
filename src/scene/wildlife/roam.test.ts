import { describe, expect, it } from 'vitest'
import {
  clearOf,
  dampAngle,
  forestPoint,
  hopArc,
  seededRandom,
  shortestAngle,
  shuffled,
  yawTo,
  FARM,
  WORLD_HALF,
} from './roam'

describe('shortestAngle', () => {
  it('идёт короткой дугой через ±π, а не через полный круг', () => {
    expect(shortestAngle(3.1, -3.1)).toBeCloseTo(Math.PI * 2 - 6.2, 6)
    expect(Math.abs(shortestAngle(3.1, -3.1))).toBeLessThan(0.1)
  })

  it('ноль на равных углах', () => {
    expect(shortestAngle(1.2, 1.2)).toBeCloseTo(0, 9)
  })
})

describe('dampAngle', () => {
  it('приближается к цели, не перелетая её', () => {
    const next = dampAngle(0, 1, 10, 0.016)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('при большом dt почти доходит до цели', () => {
    expect(dampAngle(0, 1, 10, 1)).toBeCloseTo(1, 3)
  })
})

describe('hopArc', () => {
  it('на земле в начале и в конце, в высшей точке — посередине', () => {
    expect(hopArc(0)).toBeCloseTo(0, 9)
    expect(hopArc(1)).toBeCloseTo(0, 9)
    expect(hopArc(0.5)).toBeCloseTo(1, 9)
  })
})

describe('yawTo', () => {
  it('нулевой поворот смотрит на −Z: туда же, куда модель', () => {
    expect(yawTo(0, -1)).toBeCloseTo(0, 9)
  })

  it('поворот на +90° смотрит на −X', () => {
    expect(yawTo(-1, 0)).toBeCloseTo(Math.PI / 2, 9)
  })
})

describe('clearOf', () => {
  const trees = [{ x: 0, z: 0 }]

  it('точка внутри радиуса — не чистая', () => {
    expect(clearOf(0.5, 0, trees, 1)).toBe(false)
  })

  it('точка за радиусом — чистая', () => {
    expect(clearOf(1.5, 0, trees, 1)).toBe(true)
  })

  it('без деревьев чисто везде', () => {
    expect(clearOf(0, 0, [], 1)).toBe(true)
  })
})

describe('forestPoint', () => {
  it('держится кольца вокруг фермы и не уходит за край земли', () => {
    for (let i = 0; i < 200; i++) {
      const p = forestPoint(6, 12, [], 1)
      const r = Math.hypot(p.x - FARM.x, p.z - FARM.z)
      expect(r).toBeGreaterThanOrEqual(6 - 1e-9)
      expect(r).toBeLessThanOrEqual(12 + 1e-9)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(WORLD_HALF)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(WORLD_HALF)
    }
  })

  it('обходит стволы, когда есть куда', () => {
    // Дерево ровно на внутреннем краю кольца; радиус обхода меньше толщины кольца.
    const trees = [{ x: FARM.x + 6, z: FARM.z }]
    for (let i = 0; i < 100; i++) {
      const p = forestPoint(6, 12, trees, 1.5)
      expect(clearOf(p.x, p.z, trees, 1.5)).toBe(true)
    }
  })
})

describe('seededRandom', () => {
  it('одно зерно — одна последовательность', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('разные зёрна расходятся', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)())
  })

  it('значения лежат в [0, 1)', () => {
    const r = seededRandom(7)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffled', () => {
  it('не трогает исходный массив и сохраняет состав', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffled(src, seededRandom(3))
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual(src)
  })

  it('на одном зерне даёт один и тот же порядок', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffled(src, seededRandom(9))).toEqual(shuffled(src, seededRandom(9)))
  })

  it('перемешивает: хоть какое-то зерно меняет порядок', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const orders = new Set([1, 2, 3, 4].map((s) => shuffled(src, seededRandom(s)).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
