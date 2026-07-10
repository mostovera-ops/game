/**
 * Animals.tsx — животные фермы (03-animals). Читает `farm.animals` селектором, ставит во
 * дворе (`layout.ts`). Клик по животному → покормить (`useFarmActions.feed`). Лёгкий idle-bob.
 */

import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Animal } from '@/types'
import { useStore } from '@/state'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useHoverCursor } from '../common/useHoverCursor'
import { animalAssetId } from './assetMap'
import { animalPosition } from './layout'
import { useFarmActions } from './systems'

const AnimalProp = memo(function AnimalProp({ animal, index }: { animal: Animal; index: number }) {
  const actions = useFarmActions()
  const ref = useRef<Group>(null)
  const { onPointerOver, onPointerOut } = useHoverCursor()

  useFrame((state) => {
    const g = ref.current
    if (!g) return
    // Лёгкое покачивание/подпрыгивание — животное «живое».
    const t = state.clock.elapsedTime + index
    g.position.y = 0.08 * Math.abs(Math.sin(t * 1.6))
    g.rotation.y = 0.15 * Math.sin(t * 0.6)
  })

  return (
    <group position={animalPosition(index)}>
      <group
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          actions.feed([animal.id])
        }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <PlaceholderMesh id={animalAssetId(animal.kind)} />
      </group>
    </group>
  )
})

export function Animals() {
  const animals = useStore((s) => s.farm?.animals)
  if (!animals || animals.length === 0) return null
  return (
    <group>
      {animals.map((animal, i) => (
        <AnimalProp key={animal.id} animal={animal} index={i} />
      ))}
    </group>
  )
}
