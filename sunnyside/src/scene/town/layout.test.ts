/**
 * layout.test.ts — чистая раскладка Town Map. Ноль three/react/canvas — обычный
 * node-vitest (как engine/), см. AGENTS.md §4 «уровень 1».
 */

import { describe, expect, it } from 'vitest'
import {
  constructionScale,
  farmPosition,
  FORAGE_ASSET_BY_KIND,
  layoutForagePoints,
  orderedStreets,
  PROJECT_RING_ORDER,
  projectRingPosition,
  projectStage,
  ringPosition,
  streetAngle,
  streetSignPosition,
} from './layout'
import type { Street, TownProject } from '@/types'

describe('ringPosition / projectRingPosition', () => {
  it('первый объект кольца лежит на радиусе на оси X', () => {
    const [x, y, z] = ringPosition(0, 6, 10)
    expect(x).toBeCloseTo(10)
    expect(y).toBe(0)
    expect(z).toBeCloseTo(0)
  })

  it('6 объектов кольца равномерно распределены (сумма углов покрывает круг)', () => {
    const positions = Array.from({ length: 6 }, (_, i) => ringPosition(i, 6, 5))
    // Соседние точки на равном расстоянии друг от друга (хорда правильного 6-угольника = радиусу).
    const dist = (a: typeof positions[0], b: typeof positions[0]) =>
      Math.hypot(a[0] - b[0], a[2] - b[2])
    const d01 = dist(positions[0]!, positions[1]!)
    const d12 = dist(positions[1]!, positions[2]!)
    expect(d01).toBeCloseTo(d12, 5)
    expect(d01).toBeCloseTo(5, 5)
  })

  it('projectRingPosition расставляет все 6 town-project ключей канона по кольцу', () => {
    expect(PROJECT_RING_ORDER.length).toBe(6)
    const positions = PROJECT_RING_ORDER.map((_, i) => projectRingPosition(i))
    expect(new Set(positions.map((p) => p.join(','))).size).toBe(6)
  })
})

describe('projectStage', () => {
  const base: TownProject = { version: 1, key: 'tp_bandstand', progress: 0, goal: 100, built: false, myContribution: 0 }

  it('нет записи проекта → стадия 1 (леса, ничего не начато)', () => {
    expect(projectStage(undefined)).toBe(1)
  })

  it('built:true → стадия 3 независимо от progress/goal', () => {
    expect(projectStage({ ...base, progress: 0, goal: 100, built: true })).toBe(3)
  })

  it('< 50% прогресса → стадия 1', () => {
    expect(projectStage({ ...base, progress: 49, goal: 100 })).toBe(1)
  })

  it('>= 50% прогресса, но не built → стадия 2', () => {
    expect(projectStage({ ...base, progress: 50, goal: 100 })).toBe(2)
    expect(projectStage({ ...base, progress: 99, goal: 100 })).toBe(2)
  })

  it('goal:0 не делит на ноль (frac=0 → стадия 1)', () => {
    expect(projectStage({ ...base, progress: 0, goal: 0, built: false })).toBe(1)
  })
})

describe('constructionScale', () => {
  it('монотонно растёт по стадиям 1 → 2 → 3', () => {
    expect(constructionScale(1)).toBeLessThan(constructionScale(2))
    expect(constructionScale(2)).toBeLessThan(constructionScale(3))
    expect(constructionScale(3)).toBe(1)
  })
})

describe('streetAngle / streetSignPosition', () => {
  it('стриты равномерно распределены и сдвинуты на полшага от нуля', () => {
    const a0 = streetAngle(0, 4)
    const a1 = streetAngle(1, 4)
    expect(a1 - a0).toBeCloseTo(Math.PI / 2, 5)
    expect(a0).toBeCloseTo(Math.PI / 4, 5) // половина шага 90° = 45°
  })

  it('table пуст (total=0) не делит на ноль', () => {
    expect(streetAngle(0, 0)).toBe(0)
  })

  it('табличка улицы стоит ближе к центру, чем первая ферма', () => {
    const sign = streetSignPosition(0, 2)
    const farm0 = farmPosition(0, 2, 0)
    const distSign = Math.hypot(sign[0], sign[2])
    const distFarm = Math.hypot(farm0[0], farm0[2])
    expect(distSign).toBeLessThan(distFarm)
  })
})

describe('farmPosition', () => {
  it('дома чередуются по разные стороны оси улицы (чёт/нечет)', () => {
    const p0 = farmPosition(0, 2, 0)
    const p1 = farmPosition(0, 2, 1)
    // Разные позиции — не совпадают, и расстояние растёт с индексом вдоль луча.
    expect(p0).not.toEqual(p1)
    const angle = streetAngle(0, 2)
    const projectedRadius = (p: typeof p0) => p[0] * Math.cos(angle) + p[2] * Math.sin(angle)
    expect(projectedRadius(p1)).toBeGreaterThan(projectedRadius(p0))
  })

  it('детерминирована: одинаковые аргументы → одинаковая позиция', () => {
    expect(farmPosition(1, 3, 4)).toEqual(farmPosition(1, 3, 4))
  })
})

describe('orderedStreets', () => {
  it('orderedStreets стабилен по id (не зависит от порядка снапшота)', () => {
    const streets: Street[] = [
      { id: 'street-b', name: 'Cherry Lane', memberCount: 1, farmIds: [] },
      { id: 'street-a', name: 'Maple Street', memberCount: 1, farmIds: [] },
    ]
    expect(orderedStreets(streets).map((s) => s.id)).toEqual(['street-a', 'street-b'])
  })
})

describe('layoutForagePoints', () => {
  it('генерирует запрошенное число точек с уникальными id', () => {
    const points = layoutForagePoints('town-1', 6)
    expect(points).toHaveLength(6)
    expect(new Set(points.map((p) => p.id)).size).toBe(6)
  })

  it('детерминирована по seedKey (тот же город → та же раскладка)', () => {
    expect(layoutForagePoints('town-1')).toEqual(layoutForagePoints('town-1'))
  })

  it('разные города дают разную раскладку', () => {
    const a = layoutForagePoints('town-1')
    const b = layoutForagePoints('town-2')
    expect(a).not.toEqual(b)
  })

  it('каждый вид фуражинга смаплен на существующий ассет-ключ сцены', () => {
    for (const kind of ['mushroom', 'berry', 'herb', 'flower'] as const) {
      expect(FORAGE_ASSET_BY_KIND[kind]).toBeTruthy()
    }
  })
})
