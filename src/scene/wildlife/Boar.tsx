/**
 * Кабанчик бродит по лесу, а завидев героя — разворачивается и убегает.
 *
 * «Завидев» — это просто расстояние: поля зрения у него нет, и подкрасться
 * со спины нельзя. Так честнее для игрока, который камерой владеет, а
 * головой кабана — нет.
 *
 * Сами правила испуга живут в boarRules.ts и проверяются тестом. Здесь остаётся
 * то, что без кадра и без three не имеет смысла: шаг, доворот, качание ног.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
import { hero } from '../heroState'
import { awayFrom, nextMode, reflectAtEdge, STARTLE_SEC, type Mode } from './boarRules'
import { critterUrl, node, useCreature } from './model'
import { hoverProp, unhoverProp } from '../propHover'
import { dampAngle, forestPoint, rand, yawTo, WORLD_HALF, type Point } from './roam'

const URL = critterUrl('boar')

const R_MIN = 6.5
const R_MAX = 13
const TREE_CLEARANCE = 1.3

const WALK_SPEED = 0.8
const FLEE_SPEED = 4.2
const ARRIVE = 0.6

const MAX_DT = 0.1

const LEGS = ['BoarLegFL', 'BoarLegFR', 'BoarLegBL', 'BoarLegBR'] as const

/** Доступ из DevTools и автопроверок. В прод-сборку не попадает. */
const debug = { x: 0, z: 0, mode: 'wander' as Mode, toHero: 0 }
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __boar?: unknown }).__boar = debug
}

export function Boar({ trees, palette }: { trees: Point[]; palette: Palette }) {
  // Ловит лучи ради подписи по ховеру: зверь один, мешей у него десяток —
  // на raycast курсора это не заметно, в отличие от роя жуков.
  const model = useCreature(URL, palette, { cast: true, clickable: true })
  const legs = useMemo(() => LEGS.map((n) => node(model, n)), [model])
  const tail = useMemo(() => node(model, 'BoarTail'), [model])

  const group = useRef<THREE.Group>(null)
  const mode = useRef<Mode>('wander')
  const goal = useRef<Point>(forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE))
  const started = useRef(false)
  const startle = useRef(0)
  const step = useRef(0)
  /** Куда бежать: считается один раз в момент испуга, чтобы не вилять на бегу. */
  const fleeDir = useRef({ x: 1, z: 0 })
  const idle = useRef(rand(0, 4))

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

    const self = { x: g.position.x, z: g.position.z }
    const toHero = Math.hypot(hero.pos.x - self.x, hero.pos.z - self.z)

    if (mode.current === 'startle') startle.current -= dt
    const was = mode.current
    mode.current = nextMode(was, toHero, startle.current)

    if (was === 'wander' && mode.current === 'startle') {
      startle.current = STARTLE_SEC
      fleeDir.current = awayFrom(self, { x: hero.pos.x, z: hero.pos.z })
    }
    if (was === 'flee' && mode.current === 'wander') {
      goal.current = forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE)
      idle.current = rand(1, 3)
    }

    let speed = 0
    let wantYaw = g.rotation.y

    if (mode.current === 'startle') {
      // Стоит на месте и доворачивается спиной к герою — только потом рванёт.
      wantYaw = yawTo(fleeDir.current.x, fleeDir.current.z)
    } else if (mode.current === 'flee') {
      speed = FLEE_SPEED
      const dx = fleeDir.current.x * speed * dt
      const dz = fleeDir.current.z * speed * dt
      // У края земли бежать некуда — заворачиваем внутрь.
      fleeDir.current = reflectAtEdge(fleeDir.current, self.x + dx, self.z + dz, WORLD_HALF)
      wantYaw = yawTo(fleeDir.current.x, fleeDir.current.z)
      g.position.x += fleeDir.current.x * speed * dt
      g.position.z += fleeDir.current.z * speed * dt
    } else {
      const dx = goal.current.x - self.x
      const dz = goal.current.z - self.z
      const dist = Math.hypot(dx, dz)
      if (dist <= ARRIVE) {
        // Дошёл — постоял, покопал носом, пошёл дальше.
        idle.current -= dt
        if (idle.current <= 0) {
          goal.current = forestPoint(R_MIN, R_MAX, trees, TREE_CLEARANCE)
          idle.current = rand(1.5, 5)
        }
      } else {
        speed = WALK_SPEED
        wantYaw = yawTo(dx, dz)
        g.position.x += (dx / dist) * speed * dt
        g.position.z += (dz / dist) * speed * dt
      }
    }

    g.rotation.y = dampAngle(g.rotation.y, wantYaw, mode.current === 'flee' ? 6 : 3, dt)

    // Шаг: передние и задние ноги в противофазе — получается рысь.
    step.current += speed * 2.4 * dt
    const swing = Math.sin(step.current * Math.PI) * (speed > WALK_SPEED ? 0.75 : 0.35)
    legs[0].rotation.x = swing
    legs[1].rotation.x = -swing
    legs[2].rotation.x = -swing
    legs[3].rotation.x = swing

    // Хвост мотается тем быстрее, чем быстрее бежит.
    tail.rotation.x = Math.sin(step.current * 3) * (speed > WALK_SPEED ? 0.4 : 0.15)

    if (import.meta.env.DEV) {
      debug.x = g.position.x
      debug.z = g.position.z
      debug.mode = mode.current
      debug.toHero = toHero
    }
  })

  return (
    <group ref={group} onPointerMove={hoverProp} onPointerOut={unhoverProp}>
      <primitive object={model} />
    </group>
  )
}
