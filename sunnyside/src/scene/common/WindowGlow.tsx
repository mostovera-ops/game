/**
 * WindowGlow.tsx — «окна светятся» ночью (22-audio-visual §3.6/§4.5). Дешёвые emissive-точки
 * (`MeshBasicMaterial`, `toneMapped={false}`, без bloom-пайплайна — см. докстринг `NeonSign.tsx`
 * про то же ограничение) поверх фасадов построек, позиции — из `scene/farm/windowGlow.ts`.
 *
 * Днём (`dayNightIntensity=0`) полностью прозрачны — постройки остаются дневными
 * (`PlaceholderMesh`, чужая зона — этот компонент только добавляет акцент рядом, не трогает
 * геометрию/материалы построек).
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { color as canonColor } from '@/assets/placeholders/registry'

export interface WindowGlowProps {
  positions: readonly [number, number, number][]
  /** Доля суточного цикла 0..1 (`useDayNightIntensity`, 22-av §4.5). */
  dayNightIntensity: number
}

const WINDOW_SIZE = 0.22
/** Лёгкое мерцание (не резкое мигание — P1 «дружелюбно»), общее на все окна. */
const FLICKER_SPEED = 1.3
const FLICKER_DEPTH = 0.15

export function WindowGlow({ positions, dayNightIntensity }: WindowGlowProps) {
  const mats = useRef<(MeshBasicMaterial | null)[]>([])
  const meshes = useRef<(Mesh | null)[]>([])

  useFrame((state) => {
    const night = Math.max(0, Math.min(1, dayNightIntensity))
    const flicker = 1 - FLICKER_DEPTH + FLICKER_DEPTH * Math.sin(state.clock.elapsedTime * FLICKER_SPEED)
    const opacity = 0.55 * night * flicker
    for (let i = 0; i < mats.current.length; i++) {
      const mat = mats.current[i]
      if (mat) mat.opacity = opacity
    }
    for (let i = 0; i < meshes.current.length; i++) {
      const mesh = meshes.current[i]
      if (mesh) mesh.visible = night > 0.01
    }
  })

  if (positions.length === 0) return null

  return (
    <group>
      {positions.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          position={p}
        >
          <planeGeometry args={[WINDOW_SIZE, WINDOW_SIZE]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color={canonColor('pal_neon_yellow')}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
