import { describe, expect, it } from 'vitest'
import { forageSpots } from './forageSpots'
import { FARM, type Point } from './roam'

/** Кольцо деревьев вокруг фермы: n штук на радиусе r. */
const ring = (n: number, r: number): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: FARM.x + Math.cos(a) * r, z: FARM.z + Math.sin(a) * r }
  })

describe('forageSpots', () => {
  it('без деревьев находок нет', () => {
    expect(forageSpots([])).toEqual([])
  })

  it('деревья вплотную к ферме и за краем кадра не годятся', () => {
    expect(forageSpots(ring(20, 2))).toEqual([])
    expect(forageSpots(ring(20, 15))).toEqual([])
  })

  it('четыре гриба и два гнезда, id уникальны', () => {
    const spots = forageSpots(ring(20, 7))
    expect(spots.filter((s) => s.item === 'mushroom')).toHaveLength(4)
    expect(spots.filter((s) => s.item === 'egg')).toHaveLength(2)
    expect(new Set(spots.map((s) => s.id)).size).toBe(6)
  })

  it('одинаков при каждом вызове: точки не случайны', () => {
    const trees = ring(20, 7)
    expect(forageSpots(trees)).toEqual(forageSpots(trees))
  })

  it('находки не садятся в одну точку', () => {
    const spots = forageSpots(ring(20, 7))
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(0.5)
      }
    }
  })

  it('деревьев меньше, чем находок: гнездо всё равно есть', () => {
    // Иначе яичница осталась бы недостижимой на такой раскладке.
    const spots = forageSpots(ring(3, 7))
    expect(spots).toHaveLength(3)
    expect(spots.some((s) => s.item === 'egg')).toBe(true)
    expect(spots.some((s) => s.item === 'mushroom')).toBe(true)
  })

  it('находка отходит от ствола в сторону фермы', () => {
    const tree: Point = { x: FARM.x + 7, z: FARM.z }
    const [spot] = forageSpots([tree])
    expect(spot.x).toBeLessThan(tree.x) // сдвинулась к ферме
    expect(Math.hypot(spot.x - tree.x, spot.z - tree.z)).toBeCloseTo(0.85, 6)
  })
})
