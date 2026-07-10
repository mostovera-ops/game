/**
 * Buildings.tsx — постройки фермы (canon §3.8) по фиксированной планировке (`layout.ts`).
 * Читает `farm.buildings` селектором. Клик по кухне/дайнеру → кухонный оверлей (19-ui-ux
 * §3.3); клик по силосу/леднику → Storage (F4, farm-ui-seams); прочие постройки — пассивные
 * заглушки (апгрейд-панель F3 — ui-агент).
 */

import { memo } from 'react'
import { useStore } from '@/state'
import type { BuildingKey } from '@/types'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useHoverCursor } from '../common/useHoverCursor'
import { BUILDING_LAYOUT, KITCHEN_BUILDINGS, STORAGE_BUILDINGS } from './layout'
import { useFarmActions, type FarmActions } from './systems'

/** Обработчик клика по постройке данного ключа — `undefined`, если постройка пассивна. */
function clickHandlerFor(key: BuildingKey, actions: FarmActions): (() => void) | undefined {
  if (KITCHEN_BUILDINGS.includes(key)) return () => actions.openKitchen()
  if (STORAGE_BUILDINGS.includes(key)) return () => actions.openStorage()
  return undefined
}

const BuildingProp = memo(function BuildingProp({
  buildingKey,
  position,
  onClick,
}: {
  buildingKey: BuildingKey
  position: [number, number, number]
  onClick: (() => void) | undefined
}) {
  // SCN-2: hook всегда вызывается (правила хуков) — cleanup на unmount снимает курсор
  // независимо от того, интерактивна ли эта конкретная постройка.
  const { onPointerOver, onPointerOut } = useHoverCursor()
  return (
    <group
      position={position}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      onPointerOver={onClick ? onPointerOver : undefined}
      onPointerOut={onClick ? onPointerOut : undefined}
    >
      <PlaceholderMesh id={buildingKey} />
    </group>
  )
})

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
        return <BuildingProp key={key} buildingKey={key} position={position} onClick={onClick} />
      })}
    </group>
  )
}
