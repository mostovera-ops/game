/**
 * frustum.ts — чистая математика фрустум-отсечения (21-client §3.9 «frustum-culling»).
 * Ноль React/R3F — только `three`-математика (Matrix4/Frustum/Sphere), поэтому
 * node-тестируема vitest'ом без Canvas/WebGL (см. frustum.test.ts): PerspectiveCamera
 * из `three` считает матрицы чисто в JS, GPU-контекст не нужен.
 *
 * Используется хуком `useFrustumCulledItems.ts` (R3F-обёртка с `useFrame`/`useThree`),
 * который живёт отдельно, чтобы эту чистую часть можно было гонять в `environment: node`.
 */

import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three'

/** Строит фрустум камеры в мировых координатах (проекция × инверс мировой матрицы). */
export function buildFrustum(camera: Camera): Frustum {
  const m = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  return new Frustum().setFromProjectionMatrix(m)
}

/** Пересекает ли сфера с центром `center` и радиусом `radius` данный фрустум. */
export function isSphereVisible(frustum: Frustum, center: readonly [number, number, number], radius: number): boolean {
  return frustum.intersectsSphere(new Sphere(new Vector3(center[0], center[1], center[2]), radius))
}

/**
 * Фильтрует `items` до тех, чья ограничивающая сфера (радиус `radius`, дефолт 1.5 —
 * консервативный охват типового заглушки-меша, 22-av §7.1) видна во фрустуме.
 * Порядок входного массива сохраняется (важно для стабильности рендера/тестов).
 */
export function filterVisible<T>(
  frustum: Frustum,
  items: readonly T[],
  getPosition: (item: T) => readonly [number, number, number],
  radius = 1.5,
): T[] {
  return items.filter((item) => isSphereVisible(frustum, getPosition(item), radius))
}

/** Квадрат дистанции до точки — для дистанционной сортировки (LOD, §3.9 «переключение по
 *  расстоянию до камеры»), без дорогого `Math.sqrt`. */
export function distanceSquared(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return dx * dx + dy * dy + dz * dz
}
