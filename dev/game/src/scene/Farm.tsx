/**
 * <Farm /> — читает scene-layout.json и раскладывает пропсы. Только рендер.
 * Растения и грядки в Task 1 не рисуем, покачивания нет.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Instances, Instance } from '@react-three/drei'
import {
  useJSON,
  applyPalette,
  meshParts,
  type SceneLayout,
  type Palette,
  type PropInstance,
  type Vec3,
} from '../assets/scene'
import { useGameStore } from '../game/store'
import { swayUniforms } from './sway'
import { Beds } from './Beds'
import { Slot } from './Slot'

export interface CamView {
  pos: Vec3
  target: Vec3
  zoom: number
}

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

const PLANT_ASSETS = ['raised_bed', 'carrot', 'greens', 'tomato_bush'] as const

for (const a of [...SINGLETON_ASSETS, ...INSTANCED_ASSETS, ...PLANT_ASSETS])
  useGLTF.preload(propUrl(a))

/** Один uniform времени на всю сцену — двигает покачивание культур. */
function SwayClock() {
  useFrame((_, dt) => {
    swayUniforms.uTime.value += dt
  })
  return null
}

/** Гонит таймер/очередь дня фудтрека, пока идёт фаза truck. */
function TruckTick() {
  const tick = useGameStore((s) => s.tickTruck)
  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (st.phase === 'truck' && st.truck && !st.truck.ended) tick(Math.min(dt, 0.1))
  })
  return null
}

type OrbitLike = { enabled: boolean; target: THREE.Vector3; update: () => void }

const toView = (v: CamView) => ({
  pos: new THREE.Vector3(...v.pos),
  target: new THREE.Vector3(...v.target),
  zoom: v.zoom,
})

/** На дне 7 плавно переводит камеру на фудтрек; обратно — на ферму. */
function CameraRig({ farm, truck }: { farm: CamView; truck: CamView }) {
  const phase = useGameStore((s) => s.phase)
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const controls = useThree((s) => s.controls) as OrbitLike | null

  const views = useMemo(() => ({ farm: toView(farm), truck: toView(truck) }), [farm, truck])

  const anim = useRef<{
    t: number
    from: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number }
    to: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number }
  } | null>(null)
  const prevPhase = useRef(phase)

  useEffect(() => {
    if (phase === prevPhase.current) return
    prevPhase.current = phase
    const to = phase === 'truck' ? views.truck : views.farm
    const target = controls?.target.clone() ?? new THREE.Vector3(...farm.target)
    anim.current = { t: 0, from: { pos: camera.position.clone(), target, zoom: camera.zoom }, to }
    if (controls) controls.enabled = false
  }, [phase, camera, controls, views, farm.target])

  useFrame((_, dt) => {
    const a = anim.current
    if (!a) return
    a.t = Math.min(1, a.t + dt / 1.1)
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2 // easeInOutQuad
    camera.position.lerpVectors(a.from.pos, a.to.pos, e)
    camera.zoom = THREE.MathUtils.lerp(a.from.zoom, a.to.zoom, e)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.lerpVectors(a.from.target, a.to.target, e)
      controls.update()
    }
    if (a.t >= 1) {
      anim.current = null
      if (controls) controls.enabled = true
    }
  })
  return null
}

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

export function Farm({
  farmCam,
  truckCam,
  rig = true,
}: {
  farmCam: CamView
  truckCam: CamView
  rig?: boolean
}) {
  const layout = useJSON<SceneLayout>('/assets/scene-layout.json')
  const palette = useJSON<Palette>('/assets/palette.json')

  const byAsset = useMemo(() => {
    const map: Record<string, PropInstance[]> = {}
    for (const p of layout.props) (map[p.asset] ??= []).push(p)
    return map
  }, [layout])

  // slotId (`${bed}:${slot}`) → мировая позиция из plots[].
  const slotPositions = useMemo(() => {
    const out: { id: string; position: PropInstance['position'] }[] = []
    for (const plot of layout.plots) {
      plot.slots.forEach((position, i) => out.push({ id: `${plot.id}:${i}`, position }))
    }
    return out
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

      <Beds plots={layout.plots} palette={palette} />
      {slotPositions.map((s) => (
        <Slot key={s.id} slotId={s.id} position={s.position} palette={palette} />
      ))}
      <SwayClock />
      <TruckTick />
      {rig && <CameraRig farm={farmCam} truck={truckCam} />}
    </>
  )
}
