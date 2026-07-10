/**
 * Buildings.tsx — постройки фермы (canon §3.8) по фиксированной планировке (`layout.ts`).
 * Читает `farm.buildings` селектором. Клик по кухне/дайнеру → кухонный оверлей (19-ui-ux
 * §3.3); клик по силосу/леднику → Storage (F4, farm-ui-seams); прочие постройки — пассивные
 * заглушки (апгрейд-панель F3 — ui-агент).
 */

import { useStore } from '@/state'
import type { BuildingKey } from '@/types'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { BUILDING_LAYOUT, KITCHEN_BUILDINGS, STORAGE_BUILDINGS } from './layout'
import { useFarmActions, type FarmActions } from './systems'

function setCursor(value: string) {
  if (typeof document !== 'undefined') document.body.style.cursor = value
}

/** Обработчик клика по постройке данного ключа — `undefined`, если постройка пассивна. */
function clickHandlerFor(key: BuildingKey, actions: FarmActions): (() => void) | undefined {
  if (KITCHEN_BUILDINGS.includes(key)) return () => actions.openKitchen()
  if (STORAGE_BUILDINGS.includes(key)) return () => actions.openStorage()
  return undefined
}

export function Buildings() {
  const buildings = useStore((s) => s.farm?.buildings)
  const actions = useFarmActions()
  if (!buildings) return null

  const keys = Object.keys(buildings) as BuildingKey[]

  return (
    <group>
      {keys.map((key) => {
        const position = BUILDING_LAYOUT[key]
        if (!position) return null
        const onClick = clickHandlerFor(key, actions)
        return (
          <group
            key={key}
            position={position}
            onClick={
              onClick
                ? (e) => {
                    e.stopPropagation()
                    onClick()
                  }
                : undefined
            }
            onPointerOver={
              onClick
                ? (e) => {
                    e.stopPropagation()
                    setCursor('pointer')
                  }
                : undefined
            }
            onPointerOut={onClick ? () => setCursor('auto') : undefined}
          >
            <PlaceholderMesh id={key} />
          </group>
        )
      })}
    </group>
  )
}
