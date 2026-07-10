/**
 * Суточный цикл: солнце ходит по дуге, свет и небо густеют к ночи.
 *
 * Часы гоним здесь же, в одном useFrame: заводить под них отдельный компонент
 * незачем, свет — единственный, кому они нужны каждый кадр. Кончились сутки —
 * зовём endDay: неполитое погибло, политое подросло.
 *
 * Лампы крутим напрямую через ref, мимо React: перерисовывать дерево шестьдесят
 * раз в секунду ради двух чисел не за чем.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { SceneLayout } from '../assets/scene'
import { advanceClock, DAY_SECONDS, darkness, daylight, getClock, sunAngle } from '../game/dayClock'
import { useGameStore } from '../game/store'

/** Как далеко отнесён источник. На directional light влияет только направление. */
const SUN_RADIUS = 30

/** Сдвиг солнца поперёк дуги: без него тени весь день лежали бы строго вдоль X. */
const SUN_Z = 12

/** День 7 стоит в полудне: у ярмарки свой таймер, темнеть посреди торговли ей незачем. */
const NOON = DAY_SECONDS / 2

const SKY_NIGHT = new THREE.Color('#131c30')
const SKY_DUSK = new THREE.Color('#e0956a')
const SKY_DAY = new THREE.Color('#cfe1ee')

/** Доля света, при которой небо из закатного становится дневным. */
const SKY_DUSK_AT = 0.45

const AMBIENT_NIGHT = new THREE.Color('#6f8ac4')
const AMBIENT_DAY = new THREE.Color('#ffffff')
const AMBIENT_MIN = 0.16
const AMBIENT_MAX = 0.5

/** Цвет солнца у горизонта. В зените берём тот, что задан сценой. */
const SUN_HORIZON = new THREE.Color('#ff9a4d')

const MOON_COLOR = new THREE.Color('#8fa8e0')
const MOON_MAX = 0.35

/** Ниже этого солнце уже под горизонтом — гасим, чтобы не светило снизу. */
const SUN_OFF = 0.02

const lerp = THREE.MathUtils.lerp

function skyColor(light: number, out: THREE.Color): THREE.Color {
  return light < SKY_DUSK_AT
    ? out.copy(SKY_NIGHT).lerp(SKY_DUSK, light / SKY_DUSK_AT)
    : out.copy(SKY_DUSK).lerp(SKY_DAY, (light - SKY_DUSK_AT) / (1 - SKY_DUSK_AT))
}

export function DayNight({ sun }: { sun: SceneLayout['sun'] }) {
  const sunLight = useRef<THREE.DirectionalLight>(null)
  const moonLight = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  const scene = useThree((s) => s.scene)

  const sunNoon = useMemo(() => new THREE.Color(sun.color), [sun.color])

  useFrame((_, rawDt) => {
    const st = useGameStore.getState()
    // Часы идут только на ферме. Сутки вышли — новый день.
    if (st.phase === 'farm' && advanceClock(Math.min(rawDt, 0.1))) st.endDay()

    const clock = st.phase === 'farm' ? getClock() : NOON
    const light = daylight(clock)

    const sunAt = sunLight.current
    if (sunAt) {
      const a = sunAngle(clock)
      sunAt.position.set(Math.cos(a) * SUN_RADIUS, Math.sin(a) * SUN_RADIUS, SUN_Z)
      sunAt.visible = light > SUN_OFF
      sunAt.intensity = sun.energy * 0.4 * light
      // К горизонту солнце краснеет: свет идёт вдоль земли, а не сквозь.
      sunAt.color.copy(SUN_HORIZON).lerp(sunNoon, light * light)
    }

    if (ambient.current) {
      ambient.current.intensity = lerp(AMBIENT_MIN, AMBIENT_MAX, light)
      ambient.current.color.copy(AMBIENT_NIGHT).lerp(AMBIENT_DAY, light)
    }

    // Луна включается ровно на то, что отдало солнце: днём её нет.
    if (moonLight.current) moonLight.current.intensity = MOON_MAX * darkness(clock)

    if (scene.background instanceof THREE.Color) skyColor(light, scene.background)
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={AMBIENT_MAX} />
      <directionalLight
        ref={sunLight}
        intensity={sun.energy * 0.4}
        color={sun.color}
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
      {/* Луна теней не бросает: две карты глубины ради ночи в десять секунд. */}
      <directionalLight ref={moonLight} position={[-12, 18, -8]} intensity={0} color={MOON_COLOR} />
    </>
  )
}
