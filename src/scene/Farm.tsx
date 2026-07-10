/**
 * <Farm /> — читает scene-layout.json и раскладывает пропсы. Только рендер.
 * Растения и грядки в Task 1 не рисуем, покачивания нет.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
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
import { slotActionable, useGameStore } from '../game/store'
import { swayUniforms } from './sway'
import { Beds } from './Beds'
import { Slot } from './Slot'
import { Hero } from './Hero'
import { Customers } from './Customers'
import { heroTarget } from './heroTarget'
import { hero, distanceToHero, REACH } from './heroState'
import { intent, clearIntent, setIntent } from './intent'
import { halfExtentsXZ, type Collider } from './collision'
import { say } from './heroSpeech'
import { PHRASES } from './phrases'
import { HATCH_LAMBDA, HATCH_OPEN } from './truckStage'

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
  'food_truck_open',
  'brick_path',
  'log_table',
  'sit_log',
  'ladybug',
  'seed_store',
] as const

// Массовые пропсы — через инстансинг.
const INSTANCED_ASSETS = ['tree', 'bush'] as const

// Тень отбрасывают только эти (см. Task 1).
const CASTERS = new Set(['house', 'greenhouse', 'food_truck_open', 'tree', 'raised_bed', 'seed_store'])

const PLANT_ASSETS = ['raised_bed', 'carrot', 'greens', 'tomato_bush'] as const

// Стартовая точка героя: перед дверью дома (та смотрит в +X), в 0.67 м от стены.
// Камера фермы (FARM_CAM в App.tsx) нацелена сюда же — герой стоит в центре кадра.
const HERO_START: Vec3 = [2.17, 0, -0.39]

// Через что герой не проходит. Дорожка и божья коровка — не препятствия.
const SOLID_SINGLETONS = [
  'house',
  'greenhouse',
  'food_truck_open',
  'log_table',
  'sit_log',
  'seed_store',
] as const

// Деревья и кусты бьются кругом по стволу: их bbox — это крона, и по нему
// между двумя ёлками было бы не пройти.
const TRUNK_RADIUS: Record<string, number> = { tree: 0.26, bush: 0.34 }

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

/**
 * Сколько герой должен простоять без движения, прежде чем мы признаем цель
 * недостижимой. В кадре клика он ещё не тронулся, поэтому нужен запас.
 */
const STUCK_SEC = 0.4

/**
 * Исполняет отложенное действие, когда герой дошёл до цели и повернулся к ней.
 *
 * Один на всю сцену, а не по компоненту на слот: намерение всегда одно, и
 * девять слотов, каждый кадр меряющих расстояние, — лишняя работа.
 */
function Interactions() {
  const idle = useRef(0)

  useFrame((_, rawDt) => {
    const it = intent.current
    if (!it) {
      idle.current = 0
      return
    }

    const st = useGameStore.getState()

    // День 7 застал героя в пути — дело отменяется, он за прилавком фудтрака.
    // Это верно и для грядки, и для лавки: та в день ярмарки закрыта.
    if (st.phase !== 'farm') {
      clearIntent()
      return
    }

    // Слот мог измениться, пока герой шёл: росток погиб, сосед его полил.
    // Действие решаем по состоянию на момент прихода, а не на момент клика.
    if (it.kind === 'slot') {
      const slot = st.slots.find((s) => s.id === it.id)
      if (!slot || !slotActionable(slot, st.tool)) {
        clearIntent()
        return
      }
    }

    if (distanceToHero(it.x, it.z) <= it.reach) {
      // Дошёл — дальше идти незачем, иначе упрётся в борт грядки.
      heroTarget.set(hero.pos.x, 0, hero.pos.z)
      // Сперва развернуться лицом к цели: доворот крутит <Hero>, мы его ждём.
      hero.faceAt = { x: it.x, z: it.z }
      if (!hero.facing) return

      if (it.kind === 'shop') st.openShop()
      else if (it.kind === 'speak') say(it.text)
      else if (st.tool === 'can') st.water(it.id)
      else if (st.tool === 'hand') st.harvest(it.id)
      else st.plant(it.id)
      clearIntent()
      return
    }

    // Не дошёл и никуда не идёт — значит упёрся: цель недостижима. Про грядку
    // и лавку говорим игроку, про болтовню молчим: это не сорванное дело.
    idle.current = hero.moving ? 0 : idle.current + Math.min(rawDt, 0.1)
    if (idle.current >= STUCK_SEC) {
      if (it.kind !== 'speak') st.notify('too-far')
      clearIntent()
    }
  })
  return null
}

type OrbitLike = { enabled: boolean; target: THREE.Vector3; update: () => void }

/** Как резво камера догоняет идущего героя. */
const FOLLOW_LAMBDA = 2.5

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
  const follow = useRef(new THREE.Vector3())

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
    if (!a) {
      // Герой пошёл — камера подкатывается к нему. Пока он стоит, не трогаем:
      // игрок волен отвести камеру и разглядеть ферму.
      if (phase === 'farm' && controls && hero.moving) {
        const k = 1 - Math.exp(-FOLLOW_LAMBDA * Math.min(dt, 0.1))
        follow.current.copy(hero.pos).sub(controls.target).multiplyScalar(k)
        controls.target.add(follow.current)
        camera.position.add(follow.current) // смещаем вместе, чтобы сохранить ракурс и зум
        controls.update()
      }
      return
    }
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

/** Имя материала объекта, либо '' если материала нет. */
function materialName(object: THREE.Object3D): string {
  const mat = (object as THREE.Mesh).material
  if (!mat) return ''
  return Array.isArray(mat) ? (mat[0]?.name ?? '') : mat.name
}

/**
 * Клик по пропсу: если у материала есть реплика — герой идёт к пропсу и говорит
 * её, придя. Как с грядкой, реплику выдаёт <Interactions>, а не этот клик.
 * Если реплики нет (стена, крыша, теплица), событие не перехватываем: оно дойдёт
 * до земли, и герой просто пойдёт туда.
 */
function speak(e: ThreeEvent<MouseEvent>) {
  // Обработчик зовётся на каждом пересечении луча по очереди, а не только на
  // ближнем. Без этой проверки клик по молчаливому пропсу спереди озвучивал бы
  // тот, что стоит за ним (стекло теплицы → куст).
  if (e.intersections[0]?.object !== e.object) return

  // У инстансов (деревья, кусты) e.object — прокси drei без материала;
  // сам InstancedMesh с материалом лежит в eventObject.
  const name = materialName(e.object) || materialName(e.eventObject)
  const text = PHRASES[name]
  if (!text) return
  e.stopPropagation()
  // Целимся в точку клика, а не в центр пропса: у дома это стена, у дерева —
  // крона над стволом. Герой упрётся в коллайдер рядом с ней, и REACH хватит.
  // Высота не важна: дистанцию до цели меряем по земле.
  setIntent({ kind: 'speak', text, x: e.point.x, z: e.point.z, reach: REACH })
  heroTarget.set(e.point.x, 0, e.point.z)
}

function Singleton({
  url,
  inst,
  palette,
  cast,
  onClick = speak,
}: {
  url: string
  inst: PropInstance
  palette: Palette
  cast: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
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
      onClick={onClick}
    />
  )
}

/**
 * Фудтрак: тот же Singleton, но с живой створкой раздачи.
 *
 * В GLB створка закрыта и лежит отдельным узлом `Hatch` с origin на петле, а
 * подпорки под неё — узлом `HatchProps` с origin на прилавке (см.
 * tools/_export_food_truck_open.py). Потому их и не смержили с кузовом.
 *
 * На седьмой день створка поднимается, открывая окно и героя внутри, а из-под
 * неё вырастают подпорки; на ферме всё складывается обратно. Обе вещи ведёт
 * одна доля открытия, иначе стойки упирались бы в воздух посреди хода.
 * Затухание, а не клип: один угол и один масштаб, AnimationMixer тут лишний.
 *
 * Крутим напрямую в useFrame, мимо React: фаза меняется раз в день, а кадров у
 * перехода шестьдесят.
 */
function FoodTruck(props: { url: string; inst: PropInstance; palette: Palette; cast: boolean }) {
  const group = useRef<THREE.Group>(null)
  const parts = useRef<{ hatch: THREE.Object3D; props: THREE.Object3D } | null>(null)
  const open = useRef(0)

  useFrame((_, dt) => {
    if (!parts.current) {
      const hatch = group.current?.getObjectByName('Hatch')
      const struts = group.current?.getObjectByName('HatchProps')
      if (!hatch || !struts) return
      parts.current = { hatch, props: struts }
    }
    const { hatch, props: struts } = parts.current

    const want = useGameStore.getState().phase === 'truck' ? 1 : 0
    open.current = THREE.MathUtils.damp(open.current, want, HATCH_LAMBDA, Math.min(dt, 0.1))

    hatch.rotation.x = open.current * HATCH_OPEN
    // Нулевой масштаб вырождает матрицу — вместо него прячем стойки целиком.
    struts.visible = open.current > 0.02
    struts.scale.y = Math.max(open.current, 0.02)
  })

  return (
    <group ref={group}>
      <Singleton {...props} />
    </group>
  )
}

/**
 * Лавка семян: тот же Singleton, но клик по ней — не реплика, а поход за
 * семенами. Торговлю откроет <Interactions>, когда герой дойдёт.
 *
 * Цель — центр пропса, а лавка сама себе коллайдер: вплотную к центру герой не
 * подойдёт и обычного REACH не хватит. Поэтому радиус — REACH плюс полкорпуса,
 * снятые с bbox самой GLB, как и у коллайдеров: лавка вырастет в Blender —
 * вырастет и он.
 *
 * В день фудтрака лавка закрыта: продавец уехал на ярмарку вместе с игроком.
 */
function SeedStore(props: { url: string; inst: PropInstance; palette: Palette; cast: boolean }) {
  const { inst, url } = props
  const { scene } = useGLTF(url)

  const reach = useMemo(() => {
    const { hx, hz } = halfExtentsXZ(scene)
    return REACH + Math.max(hx * inst.scale[0], hz * inst.scale[2])
  }, [scene, inst])

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.intersections[0]?.object !== e.object) return
      e.stopPropagation()
      if (useGameStore.getState().phase !== 'farm') return
      const [x, , z] = inst.position
      setIntent({ kind: 'shop', x, z, reach })
      heroTarget.set(x, 0, z)
    },
    [inst, reach],
  )

  return <Singleton {...props} onClick={onClick} />
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
          onClick={speak}
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

/**
 * Коллайдеры сцены. Коробки берём из bbox самих GLB, а не из констант: пропс
 * поменяет размер в Blender — препятствие поедет за ним.
 */
function useColliders(layout: SceneLayout): Collider[] {
  const house = useGLTF(propUrl('house')).scene
  const greenhouse = useGLTF(propUrl('greenhouse')).scene
  const truck = useGLTF(propUrl('food_truck_open')).scene
  const logTable = useGLTF(propUrl('log_table')).scene
  const sitLog = useGLTF(propUrl('sit_log')).scene
  const seedStore = useGLTF(propUrl('seed_store')).scene
  const bed = useGLTF(propUrl('raised_bed')).scene

  return useMemo(() => {
    const scenes: Record<string, THREE.Object3D> = {
      house,
      greenhouse,
      food_truck_open: truck,
      log_table: logTable,
      sit_log: sitLog,
      seed_store: seedStore,
    }
    const out: Collider[] = []

    for (const asset of SOLID_SINGLETONS) {
      const { hx, hz } = halfExtentsXZ(scenes[asset])
      for (const inst of layout.props.filter((p) => p.asset === asset)) {
        out.push({
          kind: 'rect',
          x: inst.position[0],
          z: inst.position[2],
          rot: inst.rotationY,
          hx: hx * inst.scale[0],
          hz: hz * inst.scale[2],
        })
      }
    }

    for (const asset of INSTANCED_ASSETS) {
      for (const inst of layout.props.filter((p) => p.asset === asset)) {
        out.push({
          kind: 'circle',
          x: inst.position[0],
          z: inst.position[2],
          r: TRUNK_RADIUS[asset] * inst.scale[0],
        })
      }
    }

    const bedHalf = halfExtentsXZ(bed)
    for (const plot of layout.plots) {
      out.push({
        kind: 'rect',
        x: plot.bed[0],
        z: plot.bed[2],
        rot: plot.bedRotationY,
        hx: bedHalf.hx,
        hz: bedHalf.hz,
      })
    }

    return out
  }, [layout, house, greenhouse, truck, logTable, sitLog, seedStore, bed])
}

function Ground({ size, color }: { size: number; color: string }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (useGameStore.getState().phase !== 'farm') return // день 7 — герой за прилавком
        clearIntent() // повёл героя в другое место — прежнее дело отменено
        heroTarget.set(e.point.x, 0, e.point.z)
      }}
    >
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
  const colliders = useColliders(layout)

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

      {SINGLETON_ASSETS.flatMap((asset) => {
        const Prop =
          asset === 'seed_store' ? SeedStore : asset === 'food_truck_open' ? FoodTruck : Singleton
        return (byAsset[asset] ?? []).map((inst, i) => (
          <Prop
            key={`${asset}-${i}`}
            url={propUrl(asset)}
            inst={inst}
            palette={palette}
            cast={CASTERS.has(asset)}
          />
        ))
      })}

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
      <Hero palette={palette} start={HERO_START} colliders={colliders} />
      <Customers palette={palette} />
      {slotPositions.map((s) => (
        <Slot key={s.id} slotId={s.id} position={s.position} palette={palette} />
      ))}
      <SwayClock />
      <TruckTick />
      <Interactions />
      {rig && <CameraRig farm={farmCam} truck={truckCam} />}
    </>
  )
}
