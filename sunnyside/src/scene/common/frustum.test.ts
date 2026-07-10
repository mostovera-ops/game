/**
 * frustum.test.ts — юниты чистой фрустум-математики (AGENTS.md §4 «уровень 1»: node,
 * без Canvas/WebGL — `PerspectiveCamera` из `three` считает матрицы в чистом JS).
 */

import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { buildFrustum, distanceSquared, filterVisible, isSphereVisible } from './frustum'

function cameraLookingDownNegativeZ(): PerspectiveCamera {
  const cam = new PerspectiveCamera(50, 1, 0.1, 100)
  cam.position.set(0, 0, 10)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

describe('buildFrustum / isSphereVisible', () => {
  it('точка перед камерой видна', () => {
    const frustum = buildFrustum(cameraLookingDownNegativeZ())
    expect(isSphereVisible(frustum, [0, 0, 0], 1)).toBe(true)
  })

  it('точка далеко за камерой (позади) не видна', () => {
    const frustum = buildFrustum(cameraLookingDownNegativeZ())
    expect(isSphereVisible(frustum, [0, 0, 50], 1)).toBe(false)
  })

  it('точка далеко в стороне (вне угла обзора) не видна', () => {
    const frustum = buildFrustum(cameraLookingDownNegativeZ())
    expect(isSphereVisible(frustum, [500, 0, 0], 1)).toBe(false)
  })
})

describe('filterVisible', () => {
  it('оставляет только видимые элементы, сохраняя порядок', () => {
    const frustum = buildFrustum(cameraLookingDownNegativeZ())
    const items = [
      { id: 'in-front', pos: [0, 0, 0] as [number, number, number] },
      { id: 'behind', pos: [0, 0, 50] as [number, number, number] },
      { id: 'in-front-2', pos: [1, 0, 1] as [number, number, number] },
      { id: 'far-side', pos: [500, 0, 0] as [number, number, number] },
    ]
    const visible = filterVisible(frustum, items, (i) => i.pos)
    expect(visible.map((i) => i.id)).toEqual(['in-front', 'in-front-2'])
  })

  it('пустой список -> пустой результат', () => {
    const frustum = buildFrustum(cameraLookingDownNegativeZ())
    expect(filterVisible(frustum, [], () => [0, 0, 0])).toEqual([])
  })
})

describe('distanceSquared', () => {
  it('считает квадрат евклидова расстояния', () => {
    expect(distanceSquared([0, 0, 0], [3, 4, 0])).toBe(25)
  })

  it('ноль для совпадающих точек', () => {
    expect(distanceSquared([1, 2, 3], [1, 2, 3])).toBe(0)
  })
})
