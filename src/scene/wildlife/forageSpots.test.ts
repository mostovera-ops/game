import { describe, expect, it } from 'vitest'
import { forestFinds, isForage } from './forageSpots'
import { FARM, type Point } from './roam'

/** Кольцо деревьев вокруг фермы: n штук на радиусе r. */
const ring = (n: number, r: number): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: FARM.x + Math.cos(a) * r, z: FARM.z + Math.sin(a) * r }
  })

const countOf = (spots: { kind: string }[], kind: string) =>
  spots.filter((s) => s.kind === kind).length

describe('forestFinds', () => {
  it('без деревьев в лесу пусто', () => {
    expect(forestFinds([])).toEqual([])
  })

  it('деревья вплотную к ферме и за краем кадра не годятся', () => {
    expect(forestFinds(ring(20, 2))).toEqual([])
    expect(forestFinds(ring(20, 15))).toEqual([])
  })

  it('три гриба, ровно одно гнездо и три мухомора, id уникальны', () => {
    const spots = forestFinds(ring(20, 7))
    expect(countOf(spots, 'mushroom')).toBe(3)
    expect(countOf(spots, 'egg')).toBe(1) // яйцо — самая редкая находка
    expect(countOf(spots, 'toadstool')).toBe(3)
    expect(new Set(spots.map((s) => s.id)).size).toBe(7)
  })

  it('мухомор — не находка, остальное собирается', () => {
    const spots = forestFinds(ring(20, 7))
    const forage = spots.filter(isForage)
    expect(forage).toHaveLength(4)
    expect(forage.every((s) => s.kind !== ('toadstool' as never))).toBe(true)
  })

  it('одинаков при каждом вызове: точки не случайны', () => {
    const trees = ring(20, 7)
    expect(forestFinds(trees)).toEqual(forestFinds(trees))
  })

  it('находки не садятся в одну точку', () => {
    const spots = forestFinds(ring(20, 7))
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(0.5)
      }
    }
  })

  it('деревьев мало: все три вида всё равно встречаются', () => {
    // Иначе яичница осталась бы недостижимой на такой раскладке.
    const spots = forestFinds(ring(3, 7))
    expect(spots).toHaveLength(3)
    expect(new Set(spots.map((s) => s.kind))).toEqual(new Set(['mushroom', 'toadstool', 'egg']))
  })

  it('находка отходит от ствола в сторону фермы', () => {
    const tree: Point = { x: FARM.x + 7, z: FARM.z }
    const [spot] = forestFinds([tree])
    expect(spot.x).toBeLessThan(tree.x) // сдвинулась к ферме
    expect(Math.hypot(spot.x - tree.x, spot.z - tree.z)).toBeCloseTo(0.85, 6)
  })
})
