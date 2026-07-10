/**
 * Кролики скачут по лесу вокруг фермы.
 *
 * Движение — не равномерное скольжение, а цепочка прыжков: кролик отталкивается,
 * летит по дуге и приземляется, и так до самой цели. Дойдя, замирает и водит
 * ушами. Отсюда и весь риг: тело поднимается по hopArc, уши откидываются назад
 * тем сильнее, чем выше прыжок.
 *
 * Прыгает кролик по прямой к цели и потому упирался бы в дом, теплицу и грядки:
 * обходить стволы при выборе цели мало, между целью и кроликом тоже что-то
 * стоит. Поэтому после каждого прыжка его выталкивают из препятствий тем же
 * resolveCollisions, что и героя, — коллайдеры у них общие.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
import { resolveCollisions, type Collider } from '../collision'
import { critterUrl, node, useCreature } from './model'
import { hoverProp, unhoverProp } from '../propHover'
import { dampAngle, forestPoint, hopArc, rand, yawTo, type Point } from './roam'

const URL = critterUrl('rabbit')

/** Кольцо, в котором кролики живут: от опушки за грядками до дальнего леса. */
const R_MIN = 5.5
const R_MAX = 12

/** Насколько кролик обходит стволы. */
const TREE_CLEARANCE = 1.1

const HOP_SEC = 0.42
const HOP_LEN = 0.7
const HOP_HEIGHT = 0.22
const ARRIVE = 0.5

const MAX_DT = 0.1
const TURN_LAMBDA = 7

/** Уши на прыжке: чем выше, тем сильнее откинуты назад. */
const EAR_BACK = 0.5

/** Радиус тела кролика для столкновений. У героя 0.22, кролик мельче. */
const RABBIT_RADIUS = 0.16

/**
 * Какую долю шага кролик обязан пройти, чтобы считаться идущим. Скольжение
 * вдоль стены съедает часть шага честно, поэтому порог низкий: он ловит
 * упёршегося в ствол, а не бегущего вдоль дома.
 */
const STUCK_FRACTION = 0.25

interface RabbitProps {
  trees: Point[]
  colliders: readonly Collider[]
  palette: Palette
}

/** Доступ из DevTools и автопроверок. В прод-сборку не попадает. */
const debug: { x: number; z: number }[] = []
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __rabbits?: unknown }).__rabbits = debug
}

function RabbitFigure({ index, trees, colliders, palette }: RabbitProps & { index: number }) {
  // Ловит лучи ради подписи по ховеру: зверь один, мешей у него десяток —
  // на raycast курсора это не заметно, в отличие от роя жуков.
  const model = useCreature(URL, palette, { cast: true, clickable: true })
  const ears = useMemo(() => [node(model, 'RabbitEarL'), node(model, 'RabbitEarR')] as const, [model])

  const group = useRef<THREE.Group>(null)
  const goal = useRef<Point>(forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE))
  /** Фаза текущего прыжка, 0…1. Вне прыжка кролик сидит и ждёт. */
  const hop = useRef(1)
  const resting = useRef(rand(0, 3))
  const started = useRef(false)
  const twitch = useRef(rand(0, 6))

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, MAX_DT)
    if (dt <= 0) return

    if (!started.current) {
      const p = forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE)
      const free = resolveCollisions(p.x, p.z, RABBIT_RADIUS, colliders)
      g.position.set(free.x, 0, free.z)
      started.current = true
    }

    // Пишем в самом начале кадра: кролик может весь кадр просидеть на месте,
    // и в конце функции мы бы до записи не дошли.
    if (import.meta.env.DEV) debug[index] = { x: g.position.x, z: g.position.z }

    const dx = goal.current.x - g.position.x
    const dz = goal.current.z - g.position.z
    const dist = Math.hypot(dx, dz)

    if (hop.current >= 1) {
      // Между прыжками кролик сидит. Дошёл до цели — выбирает новую и сидит дольше.
      g.position.y = 0
      g.rotation.x = 0
      resting.current -= dt
      twitch.current += dt

      if (dist <= ARRIVE) {
        goal.current = forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE)
        if (resting.current <= 0) resting.current = rand(0.8, 2.6)
      }
      if (resting.current <= 0) {
        hop.current = 0
      } else {
        // Настороженные уши: изредка дёргаются, каждое само по себе.
        ears[0].rotation.x = Math.sin(twitch.current * 2.2) * 0.06
        ears[1].rotation.x = Math.sin(twitch.current * 1.7 + 1.3) * 0.06
        return
      }
    }

    hop.current = Math.min(1, hop.current + dt / HOP_SEC)
    const arc = hopArc(hop.current)

    if (dist > 1e-4) {
      const step = Math.min((HOP_LEN / HOP_SEC) * dt, dist)
      // Выталкиваем из стен и грядок: прыжок сквозь дом читается как баг.
      const free = resolveCollisions(
        g.position.x + (dx / dist) * step,
        g.position.z + (dz / dist) * step,
        RABBIT_RADIUS,
        colliders,
      )
      const moved = Math.hypot(free.x - g.position.x, free.z - g.position.z)
      g.position.x = free.x
      g.position.z = free.z
      g.rotation.y = dampAngle(g.rotation.y, yawTo(dx, dz), TURN_LAMBDA, dt)

      // Цель за стволом, а обходить кролик не умеет: упёршись, он тыкался бы в
      // дерево до скончания века. Продвинулся заметно меньше шага — значит
      // упёрся, и пора выбрать другую поляну.
      if (moved < step * STUCK_FRACTION) goal.current = forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE)
    }

    g.position.y = arc * HOP_HEIGHT
    // Нос вверх на взлёте, вниз на снижении: производная дуги.
    g.rotation.x = -Math.cos(Math.PI * hop.current) * 0.28
    ears[0].rotation.x = arc * EAR_BACK
    ears[1].rotation.x = arc * EAR_BACK

    if (hop.current >= 1) resting.current = rand(0.05, 0.35)
  })

  return (
    <group ref={group} onPointerMove={hoverProp} onPointerOut={unhoverProp}>
      <primitive object={model} />
    </group>
  )
}

export function Rabbits({ count = 2, ...props }: RabbitProps & { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <RabbitFigure key={i} index={i} {...props} />
      ))}
    </>
  )
}
