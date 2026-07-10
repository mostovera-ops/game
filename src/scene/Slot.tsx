/**
 * <Slot> — одна клетка посадки. Рендерит культуру по состоянию из стора
 * (scale по стадии, tween ~400мс) и невидимый box-хитбокс для кликов/ховера.
 *
 * Клик не выполняет действие, а ставит намерение (intent.ts) и ведёт героя к
 * слоту. Само действие сработает в <Interactions> (Farm.tsx), когда герой
 * войдёт в REACH и развернётся к слоту. Что именно случится — решает инструмент
 * в руках (slotActionable в game/store.ts):
 *   семена — пусто → посадить;
 *   лейка  — любой слот → полить;
 *   рука   — созрело → собрать.
 *
 * Политый слот держит мокрое пятно на почве, пока не наступит новый день.
 * Капля же всплывает на секунду в момент полива — это отклик на действие,
 * а не индикатор состояния.
 *
 * Созревшее растение показывает комиксовое облачко с ресурсом. Вокруг удачного
 * (даст 2 единицы) кружат разноцветные звёздочки.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, CROP_ASSET, type Palette, type Vec3 } from '../assets/scene'
import { slotActionable, useGameStore, type CropId, type Slot as SlotState } from '../game/store'
import { clearHoverLabel, setHoverLabel } from './hoverLabel'
import { SpeechBubble } from './SpeechBubble'
import { heroTarget } from './heroTarget'
import { REACH } from './heroState'
import { setIntent } from './intent'

// Ростки крупные: слот читается с дефолтного зума, без приближения камеры.
const STAGE_SCALE = [0.32, 0.8, 1.35]

/** Сколько капля висит над слотом после полива. */
const DROP_MS = 1000

// Мокрая земля — темнее сухой, но всё ещё земля: чистый чёрный читался дырой.
const WET_COLOR = '#4f3826'
const DROP_COLOR = '#6db3f2'
const GOLD = '#f4b942'

function CropModel({ crop, palette }: { crop: CropId; palette: Palette }) {
  const { scene } = useGLTF(`/assets/props/${CROP_ASSET[crop]}.glb`)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette) // культуры не отбрасывают тень
    return clone
  }, [scene, palette])
  return <primitive object={object} />
}

/** Капля: всплывает и тает — живёт ровно DROP_MS после полива. */
function Droplet() {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const born = useRef(0)

  useFrame((state) => {
    const g = ref.current
    if (!g) return
    if (!born.current) born.current = state.clock.elapsedTime
    const age = (state.clock.elapsedTime - born.current) / (DROP_MS / 1000)
    g.position.y = 0.62 + age * 0.22 // всплывает
    if (mat.current) mat.current.opacity = Math.max(0, 1 - age * age) // тает к концу
  })

  return (
    <group ref={ref} position={[0, 0.62, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <coneGeometry args={[0.05, 0.1, 8]} />
        <meshBasicMaterial ref={mat} color={DROP_COLOR} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshBasicMaterial color={DROP_COLOR} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Пятиконечная звёздочка в плоскости XY. Геометрия одна на все слоты. */
const starGeometry = (() => {
  const shape = new THREE.Shape()
  const spikes = 5
  const outer = 0.5
  const inner = 0.21
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
})()

/** Звёздочки вокруг удачного растения: у каждой свой цвет, радиус и фаза. */
const SPARKS = [
  { color: '#f4b942', radius: 0.3, y: 0.3, size: 0.13, speed: 1.5, phase: 0 },
  { color: '#ff8b5e', radius: 0.26, y: 0.5, size: 0.1, speed: -1.9, phase: 1.3 },
  { color: '#6db3f2', radius: 0.32, y: 0.18, size: 0.095, speed: 1.2, phase: 2.6 },
  { color: '#9fc25f', radius: 0.24, y: 0.62, size: 0.11, speed: -1.4, phase: 4.0 },
  { color: '#f995aa', radius: 0.29, y: 0.4, size: 0.085, speed: 1.7, phase: 5.2 },
]

/**
 * Хоровод разноцветных звёздочек над удачным растением — тем, что даст 2
 * единицы. Кружат по орбитам, покачиваются по высоте и вращаются вокруг себя.
 */
function LuckyStars() {
  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    SPARKS.forEach((s, i) => {
      const m = refs.current[i]
      if (!m) return
      const a = t * s.speed + s.phase
      m.position.set(
        Math.cos(a) * s.radius,
        s.y + Math.sin(t * 2 + s.phase) * 0.05,
        Math.sin(a) * s.radius,
      )
      // Звезда плоская: разворачиваем её лицом к камере, иначе с ребра пропадает.
      m.quaternion.copy(state.camera.quaternion)
      m.rotateZ(a * 1.6)
    })
  })

  return (
    <group>
      {SPARKS.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          geometry={starGeometry}
          scale={s.size}
        >
          <meshBasicMaterial color={s.color} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Названия культур для подсказки. Дубль ui/crops.ts: scene/ туда не ходит. */
const CROP_TITLE: Record<CropId, string> = {
  carrot: '🥕 Морковь',
  greens: '🥬 Зелень',
  tomato: '🍅 Томат',
}

/**
 * Сколько дней до урожая. Политое растение растёт на стадию за ночь, значит
 * до созревания ему столько ночей, сколько стадий не хватает.
 */
function daysLeft(stage: number): string {
  const left = 2 - stage
  if (left <= 0) return 'Созрело — можно собирать'
  return left === 1 ? 'До урожая: 1 день' : `До урожая: ${left} дня`
}

/** Что показать по ховеру: пустой слот — просто грядка, занятый — карточка. */
function slotLabel(slot: SlotState): { title: string; lines: string[] } {
  if (!slot.crop) {
    return { title: 'Пустая грядка', lines: [slot.watered ? 'Полито' : 'Не полито'] }
  }
  return {
    title: CROP_TITLE[slot.crop],
    lines: [daysLeft(slot.stage), slot.watered ? 'Полито' : 'Не полито'],
  }
}

export function Slot({
  slotId,
  position,
  palette,
}: {
  slotId: string
  position: Vec3
  palette: Palette
}) {
  const slot = useGameStore((s) => s.slots.find((x) => x.id === slotId)!)
  const tool = useGameStore((s) => s.tool)
  const phase = useGameStore((s) => s.phase)
  // Семена кончились — сажать нечего, и слот об этом говорит курсором,
  // а не заставляет героя сходить впустую.
  const hasSeed = useGameStore((s) => s.seeds[s.selectedSeed] > 0)

  const [hover, setHover] = useState(false)
  const [splash, setSplash] = useState(false) // капля живёт отдельно от watered
  const growRef = useRef<THREE.Group>(null)

  const target = slot.crop ? STAGE_SCALE[slot.stage] : 0
  useLayoutEffect(() => {
    growRef.current?.scale.setScalar(0.0001) // новый саженец растёт с нуля
  }, [slot.crop])
  useFrame((_, dt) => {
    const g = growRef.current
    if (g) g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 10, dt))
  })

  // Капля всплывает в момент полива (false → true) и уходит через секунду.
  useEffect(() => {
    if (!slot.watered) return
    setSplash(true)
    const t = setTimeout(() => setSplash(false), DROP_MS)
    return () => clearTimeout(t)
  }, [slot.watered])

  const ripe = !!slot.crop && slot.stage === 2

  // Что произойдёт по клику этим инструментом — от этого же зависит курсор.
  // Правило слота живёт в game/: его же читает <Interactions>, когда герой
  // дошёл. Сверху два условия сцены: в день 7 грядки мертвы (герой за
  // прилавком и подойти не может), а сеять нечем, если пакетик пуст.
  const actionable =
    phase === 'farm' && slotActionable(slot, tool) && (tool !== 'seed' || hasSeed)

  // Клик только просит: герой идёт к слоту, а действие выполнит <Interactions>,
  // когда тот войдёт в радиус. Здесь ничего не меняем в игровом состоянии.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!actionable) return
    setIntent({ kind: 'slot', id: slotId, x: position[0], z: position[2], reach: REACH })
    heroTarget.set(position[0], 0, position[2])
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = actionable ? 'pointer' : 'not-allowed'
  }
  // Подпись едет за курсором: слот маленький, и панель у его центра
  // перекрывала бы соседей.
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHoverLabel({ key: slotId, ...slotLabel(slot), x: e.clientX, y: e.clientY })
  }
  const onOut = () => {
    setHover(false)
    clearHoverLabel(slotId)
    document.body.style.cursor = ''
  }

  return (
    <group position={position}>
      {slot.watered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <circleGeometry args={[0.2, 20]} />
          <meshBasicMaterial color={WET_COLOR} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {ripe && slot.lucky && <LuckyStars />}

      {slot.crop && (
        <group ref={growRef}>
          <CropModel crop={slot.crop} palette={palette} />
        </group>
      )}

      {ripe && slot.crop && <SpeechBubble crop={slot.crop} lucky={slot.lucky} />}
      {splash && <Droplet />}

      {/* невидимый хитбокс над слотом — рейкаст по нему, не по геометрии растения */}
      <mesh
        position={[0, 0.3, 0]}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerMove={onMove}
        onPointerOut={onOut}
      >
        <boxGeometry args={[0.44, 0.7, 0.44]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hover && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.13, 0.17, 24]} />
          <meshBasicMaterial
            color={actionable ? GOLD : '#8a8378'}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
