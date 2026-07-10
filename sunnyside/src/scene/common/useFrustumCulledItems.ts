/**
 * useFrustumCulledItems.ts — R3F-обёртка над чистой `frustum.ts` (21-client §3.9): раз в
 * `throttleFrames` кадров пересчитывает, какие из `items` попадают в фрустум камеры, и
 * (опционально) обрезает список до `maxCount` ближайших к камере — LOD «переключение по
 * расстоянию» (§3.9: дальние объекты не тянем в кадр вовсе, ближним — полная детализация).
 *
 * Троттлинг: камера орбитальная (`OrbitControls`), кадр-в-кадр видимость почти не меняется —
 * пересчёт каждый кадр был бы лишней нагрузкой. Ре-рендер компонента-потребителя происходит
 * ТОЛЬКО когда набор видимых элементов реально изменился (сравнение по ссылкам, элементы
 * стора стабильны между апдейтами), а не на каждый тик.
 *
 * Живёт в `scene/common/` (не в конкретной `scene/<scene>/`) — общая инфраструктура для всех
 * сцен, симметрично `Rig.tsx` (AGENTS.md §2 «Рендер»).
 */

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { buildFrustum, distanceSquared, filterVisible } from './frustum'

export interface FrustumCullOptions {
  /** Радиус ограничивающей сферы для отсечения (запас на размер типового меша-заглушки). */
  radius?: number
  /** Пересчитывать раз в N кадров (дефолт 6 — ~10 Гц при 60 fps). */
  throttleFrames?: number
  /** Если задано — после отсечения оставить не более N ближайших к камере (LOD-кап). */
  maxCount?: number
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Возвращает подмножество `items`, видимое во фрустуме камеры (+ опциональный LOD-кап по
 * расстоянию). `getPosition` должен быть дешёвым и стабильным по значению для одного и
 * того же item (позиции из `layout.ts`, не пересчитываются на лету).
 */
export function useFrustumCulledItems<T>(
  items: readonly T[],
  getPosition: (item: T) => readonly [number, number, number],
  opts: FrustumCullOptions = {},
): readonly T[] {
  const { camera } = useThree()
  const radius = opts.radius ?? 1.5
  const throttleFrames = opts.throttleFrames ?? 6
  const maxCount = opts.maxCount

  const itemsRef = useRef(items)
  itemsRef.current = items
  const frameCount = useRef(0)
  const [visible, setVisible] = useState<readonly T[]>(items)

  useFrame(() => {
    frameCount.current += 1
    if (frameCount.current % throttleFrames !== 0) return

    const frustum = buildFrustum(camera)
    let next = filterVisible(frustum, itemsRef.current, getPosition, radius)

    if (maxCount !== undefined && next.length > maxCount) {
      const camPos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z]
      next = [...next]
        .sort((a, b) => distanceSquared(getPosition(a), camPos) - distanceSquared(getPosition(b), camPos))
        .slice(0, maxCount)
    }

    setVisible((prev) => (sameItems(prev, next) ? prev : next))
  })

  return visible
}
