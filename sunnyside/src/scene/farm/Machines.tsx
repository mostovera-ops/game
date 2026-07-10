/**
 * Machines.tsx — станки кухни на ферме (04-machines). Читает `farm.machines` селектором,
 * выстраивает в ряд перед кухней (`layout.ts`). Клик по станку → кухонный оверлей
 * (Recipe Box / очереди станков, 19-ui-ux §3.3) через `useFarmActions.openKitchen`.
 */

import { memo } from 'react'
import { useStore } from '@/state'
import type { MachineInstance } from '@/types'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useHoverCursor } from '../common/useHoverCursor'
import { machineAssetId } from './assetMap'
import { machinePosition } from './layout'
import { useFarmActions } from './systems'

const MachineProp = memo(function MachineProp({ machine, index }: { machine: MachineInstance; index: number }) {
  const actions = useFarmActions()
  const { onPointerOver, onPointerOut } = useHoverCursor()
  return (
    <group
      position={machinePosition(index)}
      onClick={(e) => {
        e.stopPropagation()
        actions.openKitchen(machine.id)
      }}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <PlaceholderMesh id={machineAssetId(machine.key)} />
    </group>
  )
})

export function Machines() {
  const machines = useStore((s) => s.farm?.machines)
  if (!machines || machines.length === 0) return null

  return (
    <group>
      {machines.map((machine, i) => (
        <MachineProp key={machine.id} machine={machine} index={i} />
      ))}
    </group>
  )
}
