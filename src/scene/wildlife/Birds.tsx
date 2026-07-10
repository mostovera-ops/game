/**
 * Стайка птиц изредка пролетает над фермой и уходит за край земли.
 *
 * Летит клином: ведущий впереди, остальные отстают и разъезжаются в стороны.
 * Строй считается в системе полёта (вдоль курса и поперёк), поэтому клин не
 * разваливается, куда бы стая ни летела.
 *
 * Птицы не машут без остановки: взмахи чередуются с планированием, и именно
 * это отличает летящую птицу от вертолёта.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
import { critterUrl, node, useCreature } from './model'
import { FARM, rand, yawTo } from './roam'

const URL = critterUrl('bird')

/** Пара птиц вместо клина: небо не должно быть оживлённее земли. */
const FLOCK = 2

/** Половина длины пролёта: стая заводится и гаснет далеко за краем кадра. */
const HALF_PATH = 24

const SPEED_MIN = 4.5
const SPEED_MAX = 6.5
const ALT_MIN = 6.5
const ALT_MAX = 10.5

/** Пауза между пролётами. Птицы — редкое событие, а не карусель. */
const GAP_MIN = 18
const GAP_MAX = 55

const FLAP_RATE = 9
const FLAP_AMP = 0.85
/** Доля цикла «взмахи + планирование», занятая взмахами. */
const FLAP_DUTY = 0.6
const CYCLE_SEC = 2.2

const MAX_DT = 0.1

/** Общий на стаю курс и высота: птицы летят вместе, а не врассыпную. */
interface Flight {
  dirX: number
  dirZ: number
  startX: number
  startZ: number
  y: number
  speed: number
}

function newFlight(): Flight {
  const angle = Math.random() * Math.PI * 2
  const dirX = Math.cos(angle)
  const dirZ = Math.sin(angle)
  return {
    dirX,
    dirZ,
    startX: FARM.x - dirX * HALF_PATH,
    startZ: FARM.z - dirZ * HALF_PATH,
    y: rand(ALT_MIN, ALT_MAX),
    speed: rand(SPEED_MIN, SPEED_MAX),
  }
}

function BirdFigure({
  index,
  flight,
  travelled,
  palette,
}: {
  index: number
  flight: React.MutableRefObject<Flight>
  travelled: React.MutableRefObject<number>
  palette: Palette
}) {
  const model = useCreature(URL, palette)
  const wings = useMemo(() => [node(model, 'BirdWingL'), node(model, 'BirdWingR')] as const, [model])
  const group = useRef<THREE.Group>(null)

  // Место в клину: ведущий в нуле, остальные отстают и уходят вбок через одного.
  const back = index * 1.3
  const side = (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) * 1.1
  const lift = index * 0.25
  // Свой сдвиг фазы — иначе стая машет крыльями как один механизм.
  const clock = useRef(rand(0, CYCLE_SEC))

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, MAX_DT)
    const f = flight.current
    const d = travelled.current

    if (d < 0) {
      g.visible = false
      return
    }
    g.visible = true

    // Вдоль курса — пройденный путь минус отставание; поперёк — смещение в клину.
    const along = d - back
    g.position.set(
      f.startX + f.dirX * along - f.dirZ * side,
      f.y + lift,
      f.startZ + f.dirZ * along + f.dirX * side,
    )
    g.rotation.y = yawTo(f.dirX, f.dirZ)

    // Взмахи пачками: сначала машет, потом планирует на разведённых крыльях.
    clock.current = (clock.current + dt) % CYCLE_SEC
    const t = clock.current / CYCLE_SEC
    const flap = t < FLAP_DUTY ? Math.sin(clock.current * FLAP_RATE) * FLAP_AMP : 0.12
    wings[0].rotation.z = flap
    wings[1].rotation.z = -flap
  })

  return (
    <group ref={group} visible={false}>
      <primitive object={model} />
    </group>
  )
}

export function Birds({ palette }: { palette: Palette }) {
  const flight = useRef<Flight>(newFlight())
  // Отрицательный путь — это пауза до вылета: птицы ещё не в воздухе.
  const travelled = useRef(-rand(GAP_MIN, GAP_MAX))

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT)
    const f = flight.current
    // Пока стая ждёт, «путь» тикает как время, потом — как расстояние.
    travelled.current += travelled.current < 0 ? dt : f.speed * dt
    // С запасом на длину клина: хвост стаи ещё в кадре, когда ведущий уже ушёл.
    if (travelled.current > HALF_PATH * 2 + FLOCK * 1.3) {
      flight.current = newFlight()
      travelled.current = -rand(GAP_MIN, GAP_MAX)
    }
  })

  return (
    <>
      {Array.from({ length: FLOCK }, (_, i) => (
        <BirdFigure key={i} index={i} flight={flight} travelled={travelled} palette={palette} />
      ))}
    </>
  )
}
