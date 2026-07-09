/**
 * <Farm /> — читает scene-layout.json и раскладывает пропсы. Только рендер.
 * Растения и грядки в Task 1 не рисуем, покачивания нет.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF, Instances, Instance } from '@react-three/drei'
import {
  useJSON,
  applyPalette,
  meshParts,
  type SceneLayout,
  type Palette,
  type PropInstance,
} from '../assets/scene'

const propUrl = (asset: string) => `/assets/props/${asset}.glb`

// Одиночные пропсы (по инстансу в scene-layout).
const SINGLETON_ASSETS = [
  'house',
  'greenhouse',
  'food_truck',
  'brick_path',
  'log_table',
  'sit_log',
  'ladybug',
] as const

// Массовые пропсы — через инстансинг.
const INSTANCED_ASSETS = ['tree', 'bush'] as const

// Тень отбрасывают только эти (см. Task 1).
const CASTERS = new Set(['house', 'greenhouse', 'food_truck', 'tree', 'raised_bed'])

for (const a of [...SINGLETON_ASSETS, ...INSTANCED_ASSETS]) useGLTF.preload(propUrl(a))

function Singleton({
  url,
  inst,
  palette,
  cast,
}: {
  url: string
  inst: PropInstance
  palette: Palette
  cast: boolean
}) {
  const { scene } = useGLTF(url)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast })
    return clone
  }, [scene, palette, cast])
  return (
    <primitive
      object={object}
      position={inst.position}
      rotation={[0, inst.rotationY, 0]}
      scale={inst.scale}
    />
  )
}

function InstancedProp({
  url,
  list,
  palette,
  cast,
}: {
  url: string
  list: PropInstance[]
  palette: Palette
  cast: boolean
}) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => meshParts(scene, palette), [scene, palette])
  return (
    <>
      {parts.map((part, i) => (
        <Instances
          key={i}
          limit={list.length}
          range={list.length}
          geometry={part.geometry}
          material={part.material}
          castShadow={cast}
        >
          {list.map((inst, j) => (
            <Instance
              key={j}
              position={inst.position}
              rotation={[0, inst.rotationY, 0]}
              scale={inst.scale}
            />
          ))}
        </Instances>
      ))}
    </>
  )
}

function Ground({ size, color }: { size: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

export function Farm() {
  const layout = useJSON<SceneLayout>('/assets/scene-layout.json')
  const palette = useJSON<Palette>('/assets/palette.json')

  const byAsset = useMemo(() => {
    const map: Record<string, PropInstance[]> = {}
    for (const p of layout.props) (map[p.asset] ??= []).push(p)
    return map
  }, [layout])

  // sun.direction — куда светит; позиция источника в противоположной стороне.
  const sunPos = useMemo(() => {
    const d = layout.sun.direction
    return new THREE.Vector3(-d[0], -d[1], -d[2]).normalize().multiplyScalar(30)
  }, [layout])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={sunPos.toArray()}
        intensity={layout.sun.energy * 0.4}
        color={layout.sun.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
      />

      <Ground size={layout.ground.size} color={palette[layout.ground.material] ?? '#5a8f33'} />

      {SINGLETON_ASSETS.flatMap((asset) =>
        (byAsset[asset] ?? []).map((inst, i) => (
          <Singleton
            key={`${asset}-${i}`}
            url={propUrl(asset)}
            inst={inst}
            palette={palette}
            cast={CASTERS.has(asset)}
          />
        )),
      )}

      {INSTANCED_ASSETS.map((asset) => {
        const list = byAsset[asset] ?? []
        if (!list.length) return null
        return (
          <InstancedProp
            key={asset}
            url={propUrl(asset)}
            list={list}
            palette={palette}
            cast={CASTERS.has(asset)}
          />
        )
      })}
    </>
  )
}
