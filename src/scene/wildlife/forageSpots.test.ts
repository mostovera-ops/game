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

const key = (s: { x: number; z: number }) => `${s.x.toFixed(3)}:${s.z.toFixed(3)}`

describe('forestFinds', () => {
  it('без деревьев в лесу пусто', () => {
    expect(forestFinds([])).toEqual([])
  })

  it('деревья вплотную к ферме и за краем кадра не годятся', () => {
    expect(forestFinds(ring(20, 2))).toEqual([])
    expect(forestFinds(ring(20, 15))).toEqual([])
  })

  it('три гриба, ровно одно гнездо и три мухомора, id уникальны', () => {
    const spots = forestFinds(ring(20, 7), 1)
    expect(countOf(spots, 'mushroom')).toBe(3)
    expect(countOf(spots, 'egg')).toBe(1) // яйцо — самая редкая находка
    expect(countOf(spots, 'toadstool')).toBe(3)
    expect(new Set(spots.map((s) => s.id)).size).toBe(7)
  })

  it('мухомор — не находка, остальное собирается', () => {
    const spots = forestFinds(ring(20, 7), 1)
    const forage = spots.filter(isForage)
    expect(forage).toHaveLength(4)
    expect(forage.every((s) => s.kind !== ('toadstool' as never))).toBe(true)
  })

  it('одно зерно — одна раскладка: гриб не прыгает между кадрами', () => {
    const trees = ring(20, 7)
    expect(forestFinds(trees, 3)).toEqual(forestFinds(trees, 3))
  })

  it('новый день — грибы на других деревьях', () => {
    const trees = ring(20, 7)
    const mush = (seed: number) =>
      forestFinds(trees, seed)
        .filter((s) => s.kind === 'mushroom')
        .map(key)
        .sort()
    // Хотя бы одно из зёрен 1..6 должно дать другую раскладку, иначе «в разных
    // местах» — пустые слова. Проверяем весь недельный диапазон.
    const layouts = new Set([1, 2, 3, 4, 5, 6].map((d) => mush(d).join('|')))
    expect(layouts.size).toBeGreaterThan(1)
  })

  it('гнездо — дом: стоит на одном месте в любой день', () => {
    const trees = ring(20, 7)
    const nest = (seed: number) => forestFinds(trees, seed).find((s) => s.kind === 'egg')!
    expect(key(nest(1))).toBe(key(nest(5)))
  })

  it('находки не садятся в одну точку', () => {
    for (const seed of [0, 1, 2, 3]) {
      const spots = forestFinds(ring(20, 7), seed)
      expect(new Set(spots.map(key)).size).toBe(spots.length)
    }
  })

  it('деревьев мало: все три вида всё равно встречаются', () => {
    // Иначе яичница осталась бы недостижимой на такой раскладке.
    const spots = forestFinds(ring(3, 7), 1)
    expect(spots).toHaveLength(3)
    expect(new Set(spots.map((s) => s.kind))).toEqual(new Set(['mushroom', 'toadstool', 'egg']))
  })

  it('находка отходит от ствола в сторону фермы', () => {
    const tree: Point = { x: FARM.x + 7, z: FARM.z }
    const [spot] = forestFinds([tree], 1)
    expect(spot.x).toBeLessThan(tree.x) // сдвинулась к ферме
    expect(Math.hypot(spot.x - tree.x, spot.z - tree.z)).toBeCloseTo(0.85, 6)
  })
})
