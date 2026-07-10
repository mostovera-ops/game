/**
 * windowGlow.ts — «окна светятся» ночью (22-audio-visual §3.6/§4.5 «Night… точечные
 * неон-источники»). Чистая раскладка позиций окон-акцентов поверх фиксированных построек
 * фермы (`BUILDING_LAYOUT`, `layout.ts`) — только для реально построенных зданий игрока
 * (`farm.buildings`), не для всех девяти ключей канона сразу.
 *
 * ГРАНИЦА: чистые функции, ноль three/react.
 */

import type { Building, BuildingKey } from '@/types'
import { BUILDING_LAYOUT } from './layout'

/** Постройки, у которых рисуем окно-акцент (жилые/рабочие фасады, не силос/леднике/пасека). */
export const GLOWING_BUILDINGS: readonly BuildingKey[] = ['bld_house', 'bld_kitchen', 'bld_diner', 'bld_barn']

/** Смещение окна от центра постройки: чуть вверх и к камере (+Z, см. `layout.ts` оси). */
const WINDOW_OFFSET: readonly [number, number, number] = [0, 0.4, 1.1]

/** Позиции окон-акцентов для реально построенных зданий из `farm.buildings`. */
export function buildingWindowPositions(
  buildings: Partial<Record<BuildingKey, Building>> | undefined,
): [number, number, number][] {
  if (!buildings) return []
  const out: [number, number, number][] = []
  for (const key of GLOWING_BUILDINGS) {
    if (!(key in buildings)) continue
    const pos = BUILDING_LAYOUT[key]
    if (!pos) continue
    out.push([pos[0] + WINDOW_OFFSET[0], pos[1] + WINDOW_OFFSET[1], pos[2] + WINDOW_OFFSET[2]])
  }
  return out
}
