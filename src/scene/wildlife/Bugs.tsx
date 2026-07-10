/**
 * Бабочки, божьи коровки, жучки и пчёлы — атмосфера, а не игра.
 *
 * Каждый жук живёт при своём кусте: кружит над ним, изредка садится, посидев —
 * взлетает, а когда налетается — уходит вверх и пропадает. Через полминуты-другую
 * возвращается, может быть, к другому кусту. Поэтому в кадре их всегда разное
 * число и никогда — все сразу.
 *
 * Пул особей постоянен, меняется только видимость: появление через монтирование
 * компонента пересобирало бы клон GLB на каждый вылет.
 *
 * Все четыре GLB носят один риг — BugBody + BugWingL/R, — поэтому вид жука это
 * запись в SPECIES, а не свой компонент.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Palette, PropInstance } from '../../assets/scene'
import { darkness, getClock } from '../../game/dayClock'
import { critterUrl, node, useCreature } from './model'
import { dampAngle, pick, rand, yawTo } from './roam'

interface Species {
  asset: string
  /** Скорость полёта, м/с. */
  speed: number
  /** Частота взмаха, рад/с. */
  flap: number
  /** Размах взмаха, рад. */
  amp: number
  /**
   * Складывает ли крылья домиком на посадке. Бабочка складывает и остаётся
   * видимой; у жуков и пчелы крылья прячутся под надкрылья — их мы просто гасим.
   */
  foldsWings: boolean
  /** Насколько сильно болтает по вертикали в полёте. */
  bob: number
  /**
   * Цвет ночного свечения, если жук светится. Днём свечения нет — оно набирает
   * силу вместе с темнотой. Бабочка и пчела ночью просто тёмные силуэты.
   */
  glow?: string
}

const SPECIES: readonly Species[] = [
  { asset: 'critter_butterfly', speed: 0.75, flap: 11, amp: 1.0, foldsWings: true, bob: 0.09 },
  { asset: 'critter_ladybug', speed: 0.9, flap: 34, amp: 0.5, foldsWings: false, bob: 0.03, glow: '#ff8b5e' },
  { asset: 'critter_beetle', speed: 0.8, flap: 30, amp: 0.5, foldsWings: false, bob: 0.04, glow: '#b9ff72' },
  { asset: 'critter_bee', speed: 1.5, flap: 46, amp: 0.45, foldsWings: false, bob: 0.02 },
]

/** Радиус ореола вокруг светящегося жука. */
const HALO_RADIUS = 0.14

/** Частота пульсации свечения, рад/с. */
const GLOW_PULSE = 2.4

/** Крылья бабочки на отдыхе: сложены домиком над спиной. */
const FOLDED = 1.35

/**
 * Сколько особей держим в пуле. Трое — и в кадре редко бывает больше одного:
 * половину времени каждый жук отсиживается «вне сцены». Шестеро рябили.
 */
const POOL = 3

/** Куст, при котором живёт жук: центр, радиус кружения и высота посадки. */
export interface Patch {
  x: number
  z: number
  /** Высота, на которую садится жук: макушка куста. */
  landY: number
  /** Радиус, в котором жук кружит. */
  r: number
}

type Mode = 'away' | 'fly' | 'landing' | 'sit' | 'leave'

const MAX_DT = 0.1
const ARRIVE = 0.06
const TURN_LAMBDA = 4

function BugFigure({ species, patches, palette }: { species: Species; patches: Patch[]; palette: Palette }) {
  const model = useCreature(critterUrl(species.asset), palette)
  const wings = useMemo(
    () => [node(model, 'BugWingL'), node(model, 'BugWingR')] as const,
    [model],
  )

  /**
   * Материалы светящегося жука. Палитра раздаёт один материал на имя всей
   * сцене — светись мы им, вместе с жуком загорелись бы все, кто его носит.
   * Поэтому на каждую особь своя копия: и разгораются они каждая в свою фазу.
   */
  const glowMats = useMemo(() => {
    if (!species.glow) return null
    const emissive = new THREE.Color(species.glow)
    const mats: THREE.MeshLambertMaterial[] = []
    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material)) return
      const mat = (mesh.material as THREE.MeshLambertMaterial).clone()
      mat.emissive = emissive
      mat.emissiveIntensity = 0
      mesh.material = mat
      mats.push(mat)
    })
    return mats
  }, [model, species.glow])

  const halo = useRef<THREE.Mesh>(null)

  const group = useRef<THREE.Group>(null)
  const mode = useRef<Mode>('away')
  // Стартовая пауза своя у каждого: иначе первый вылет случится хором.
  const timer = useRef(rand(0, 14))
  const patch = useRef<Patch>(patches[0])
  const target = useRef(new THREE.Vector3())
  /** Сколько кругов ещё намотать, прежде чем улетать совсем. */
  const laps = useRef(0)
  const phase = useRef(rand(0, 10))

  /** Точка в воздухе над кустом. */
  const airPoint = (p: Patch, out: THREE.Vector3) => {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * p.r
    return out.set(p.x + Math.cos(a) * r, rand(p.landY + 0.15, p.landY + 0.85), p.z + Math.sin(a) * r)
  }

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, MAX_DT)
    if (dt <= 0) return

    // Свечение разгорается с темнотой и медленно дышит.
    if (glowMats) {
      const k = darkness(getClock()) * (0.6 + 0.4 * Math.sin(phase.current * GLOW_PULSE))
      for (const m of glowMats) m.emissiveIntensity = k
      if (halo.current) {
        halo.current.visible = k > 0.01
        ;(halo.current.material as THREE.MeshBasicMaterial).opacity = k * 0.4
      }
    }

    if (mode.current === 'away') {
      g.visible = false
      timer.current -= dt
      if (timer.current > 0) return
      // Вылет: садимся на случайный куст и начинаем кружить над ним.
      patch.current = pick(patches)
      airPoint(patch.current, target.current)
      g.position.set(target.current.x, patch.current.landY + 1.8, target.current.z)
      g.visible = true
      laps.current = 2 + Math.floor(Math.random() * 4)
      mode.current = 'fly'
      return
    }

    if (mode.current === 'sit') {
      phase.current += dt
      timer.current -= dt
      if (timer.current <= 0) {
        airPoint(patch.current, target.current)
        mode.current = 'fly'
        for (const w of wings) w.visible = true
      }
      // Сидящая бабочка чуть поводит сложенными крыльями.
      if (species.foldsWings) {
        const drift = Math.sin(phase.current * 1.1) * 0.12
        wings[0].rotation.z = FOLDED + drift
        wings[1].rotation.z = -(FOLDED + drift)
      }
      return
    }

    // Полёт: летим к цели, дойдя — решаем, что делать дальше.
    const dx = target.current.x - g.position.x
    const dy = target.current.y - g.position.y
    const dz = target.current.z - g.position.z
    const dist = Math.hypot(dx, dy, dz)

    if (dist > ARRIVE) {
      const step = Math.min(species.speed * dt, dist)
      g.position.x += (dx / dist) * step
      g.position.y += (dy / dist) * step
      g.position.z += (dz / dist) * step
      // Рыскание по курсу: без него траектория читается как отрезок прямой.
      g.rotation.y = dampAngle(g.rotation.y, yawTo(dx, dz), TURN_LAMBDA, dt)
    } else if (mode.current === 'leave') {
      mode.current = 'away'
      timer.current = rand(12, 40)
    } else if (mode.current === 'landing') {
      mode.current = 'sit'
      timer.current = rand(2.5, 7)
      if (species.foldsWings) {
        wings[0].rotation.z = FOLDED
        wings[1].rotation.z = -FOLDED
      } else {
        for (const w of wings) w.visible = false
      }
    } else if (laps.current <= 0) {
      // Налетался: уходим вверх и вбок за пределы кадра.
      const a = Math.random() * Math.PI * 2
      target.current.set(patch.current.x + Math.cos(a) * 7, patch.current.landY + 4, patch.current.z + Math.sin(a) * 7)
      mode.current = 'leave'
    } else {
      laps.current--
      // Каждый третий круг примерно — посадка на макушку куста.
      if (Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * patch.current.r * 0.5
        target.current.set(patch.current.x + Math.cos(a) * r, patch.current.landY, patch.current.z + Math.sin(a) * r)
        mode.current = 'landing'
      } else {
        airPoint(patch.current, target.current)
      }
    }

    // Взмах и покачивание — только в воздухе.
    phase.current += dt
    const flap = Math.sin(phase.current * species.flap) * species.amp
    wings[0].rotation.z = flap
    wings[1].rotation.z = -flap
    g.position.y += Math.sin(phase.current * 2.6) * species.bob * dt
  })

  return (
    <group ref={group} visible={false}>
      <primitive object={model} />
      {species.glow && (
        // Ореол: аддитивный шарик вокруг жука. Луч сквозь него проходит — по
        // живности не кликают, а сам жук лучи уже не ловит (см. useCreature).
        <mesh ref={halo} visible={false} raycast={() => {}}>
          <sphereGeometry args={[HALO_RADIUS, 8, 6]} />
          <meshBasicMaterial
            color={species.glow}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  )
}

export function Bugs({ patches, palette }: { patches: Patch[]; palette: Palette }) {
  // Видов четыре, а особей три: берём подряд со случайного места, иначе один и
  // тот же вид (при жёстком i % 4 — пчела) не появился бы в игре ни разу.
  const first = useMemo(() => Math.floor(Math.random() * SPECIES.length), [])
  if (!patches.length) return null
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <BugFigure
          key={i}
          species={SPECIES[(first + i) % SPECIES.length]}
          patches={patches}
          palette={palette}
        />
      ))}
    </>
  )
}

/** Кусты сцены как места жительства жуков. Высота макушки — из bbox самой GLB. */
export function bushPatches(bushes: PropInstance[], bushHeight: number): Patch[] {
  return bushes.map((b) => ({
    x: b.position[0],
    z: b.position[2],
    // Не на самой макушке: там жук висит в воздухе над редкой листвой.
    landY: b.position[1] + bushHeight * b.scale[1] * 0.82,
    r: 0.9,
  }))
}
