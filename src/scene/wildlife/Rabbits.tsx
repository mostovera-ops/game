/**
 * Кролики скачут по лесу вокруг фермы.
 *
 * Движение — не равномерное скольжение, а цепочка прыжков: кролик отталкивается,
 * летит по дуге и приземляется, и так до самой цели. Дойдя, замирает и водит
 * ушами. Отсюда и весь риг: тело поднимается по hopArc, уши откидываются назад
 * тем сильнее, чем выше прыжок.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
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

function RabbitFigure({ trees, palette }: { trees: Point[]; palette: Palette }) {
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
      g.position.set(p.x, 0, p.z)
      started.current = true
    }

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
      g.position.x += (dx / dist) * step
      g.position.z += (dz / dist) * step
      g.rotation.y = dampAngle(g.rotation.y, yawTo(dx, dz), TURN_LAMBDA, dt)
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

export function Rabbits({ trees, palette, count = 3 }: { trees: Point[]; palette: Palette; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <RabbitFigure key={i} trees={trees} palette={palette} />
      ))}
    </>
  )
}
