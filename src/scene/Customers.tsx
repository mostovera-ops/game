/**
 * Очередь дня 7 — живые человечки, а не иконки в HUD.
 *
 * Клиент приходит из-за кадра, встаёт в хвост и шагает вперёд по мере продаж.
 * Заказ висит облачком над головой (OrderBubble), там же убывает терпение.
 * Исчезает клиент мгновенно — обслужили или ушёл; проводов не рисуем.
 *
 * Модель — тот же hero.glb: людей в этом мире лепят из одной заготовки. Цвет
 * плаща свой у каждого, иначе очередь читается как один человек в четырёх копиях.
 * Материал клонируем: lambert() кеширует материалы по имени, и покраска на месте
 * перекрасила бы заодно самого героя.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette } from '../assets/scene'
import { useGameStore, type Customer } from '../game/store'
import { OrderBubble } from './OrderBubble'
import { APPROACH, QUEUE_DIR, QUEUE_YAW, SPAWN, queueSpot, yawTo } from './truckStage'

const HERO_URL = '/assets/props/hero.glb'

// Идти теперь недалеко — от ближней ёлки до очереди, — и торопиться незачем.
const SPEED = 2.4 // м/с
const STEP_RATE = 9
const STEP_AMP = 0.5
const AMP_LAMBDA = 8
const TURN_LAMBDA = 10
const ARRIVE = 0.06
const MAX_DT = 0.1

/** Плащи клиентов. Ротация по id: соседи в очереди всегда разного цвета. */
const COATS = ['#a8556b', '#4f7a8a', '#8a6f3f', '#6b5a8a', '#5f8a3c', '#a0603f']

function CustomerFigure({
  customer,
  index,
  palette,
}: {
  customer: Customer
  index: number
  palette: Palette
}) {
  const { scene } = useGLTF(HERO_URL)

  const model = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast: true })
    const coat = new THREE.Color(COATS[customer.id % COATS.length])
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const cur = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      // Красим только плащ: у модели есть ещё белки и зрачки, и залить их
      // цветом плаща — значит стереть человечку глаза.
      if (cur.name !== 'Hero') return
      const mat = cur.clone() as THREE.MeshLambertMaterial
      mat.color.copy(coat)
      mesh.material = mat
    })
    return clone
  }, [scene, palette, customer.id])

  const legs = useMemo(
    () => ({ l: model.getObjectByName('HeroLegL'), r: model.getObjectByName('HeroLegR') }),
    [model],
  )

  const group = useRef<THREE.Group>(null)
  const step = useRef(0)
  const amp = useRef(0)
  const goal = useRef(new THREE.Vector3())
  /** Обогнул ли клиент фудтрак: до этого идём в APPROACH, потом — в очередь. */
  const rounded = useRef(false)

  // Новичок появляется за кадром, а не выпрыгивает в хвосте очереди.
  useEffect(() => {
    group.current?.position.copy(SPAWN)
    rounded.current = false
  }, [])

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, MAX_DT)
    if (dt <= 0) return

    // Сперва выходим из-за деревьев на линию очереди, и только потом идём к
    // своему месту. Иначе путь к голове очереди прошёл бы сквозь кузов.
    if (!rounded.current) {
      goal.current.copy(APPROACH)
      if (g.position.distanceTo(APPROACH) <= ARRIVE * 4) rounded.current = true
    }
    if (rounded.current) queueSpot(index, goal.current)

    const dx = goal.current.x - g.position.x
    const dz = goal.current.z - g.position.z
    const dist = Math.hypot(dx, dz)

    // Дошёл до окна — только теперь придумывает заказ. Раньше он висел над ним
    // ещё за деревьями, и кнопки выдачи предлагали подать блюдо тому, кто и не
    // просил. Стор сам проверит, что это первый в очереди.
    if (index === 0 && rounded.current && dist <= ARRIVE && !customer.want) {
      useGameStore.getState().customerReady(customer.id)
    }

    let moved = false
    let want: number
    if (dist > ARRIVE) {
      const stepLen = Math.min(SPEED * dt, dist)
      g.position.x += (dx / dist) * stepLen
      g.position.z += (dz / dist) * stepLen
      moved = true
      step.current += STEP_RATE * dt
      want = yawTo(dx, dz)
    } else if (index === 0) {
      want = QUEUE_YAW // первый смотрит в окно раздачи
    } else {
      // Остальные — в затылок переднему, то есть против хвоста очереди.
      want = yawTo(-QUEUE_DIR.x, -QUEUE_DIR.z)
    }

    const delta = ((want - g.rotation.y + Math.PI) % (2 * Math.PI)) - Math.PI
    g.rotation.y += delta * (1 - Math.exp(-TURN_LAMBDA * dt))

    amp.current = THREE.MathUtils.damp(amp.current, moved ? STEP_AMP : 0, AMP_LAMBDA, dt)
    const swing = Math.sin(step.current) * amp.current
    if (legs.l) legs.l.rotation.x = swing
    if (legs.r) legs.r.rotation.x = -swing
  })

  return (
    <group ref={group}>
      <primitive object={model} />
      {/* Пока клиент идёт, заказа у него нет — и облачка тоже. */}
      {customer.want && (
        <OrderBubble
          customerId={customer.id}
          recipe={customer.want}
          patience={customer.patience / customer.maxPatience}
        />
      )}
    </group>
  )
}

export function Customers({ palette }: { palette: Palette }) {
  const phase = useGameStore((s) => s.phase)
  const queue = useGameStore((s) => s.truck?.queue)

  if (phase !== 'truck' || !queue) return null

  return (
    <>
      {queue.map((c, i) => (
        <CustomerFigure key={c.id} customer={c} index={i} palette={palette} />
      ))}
    </>
  )
}
