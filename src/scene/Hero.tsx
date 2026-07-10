/**
 * <Hero> — персонаж. Ходит двумя способами: WASD/стрелками и кликом по земле.
 *
 * Клавиши считаются относительно камеры: «вперёд» — от зрителя вглубь сцены,
 * а не по мировой оси Z. Камеру можно повернуть, и управление повернётся с ней.
 * Нажатие клавиши отменяет цель, поставленную кликом, иначе герой дёргался бы
 * между двумя приказами.
 *
 * Модель приезжает из hero.glb тремя узлами: HeroBody (туловище, голова, глаза)
 * и две ноги, у которых origin в бедре (см. tools/_export_hero.py). Ходьбу
 * анимирует этот компонент, а не AnimationMixer: ног две, цикл — синус,
 * мешать сюда клипы незачем.
 *
 * Материалы герой собирает сам, а не берёт общий applyPalette: тому нужен
 * flatShading на всю сцену, а у героя нормали сглажены — иначе голова гранёная.
 * Цвет одежды живёт в сторе (инвентарь по E) и меняется на месте, без пересборки
 * материала: одна мутация THREE.Color вместо перезагрузки модели.
 *
 * Позиция и признак движения публикуются в heroState — оттуда их читают слоты
 * (чтобы понять, дотянется ли герой) и камера (чтобы подкатиться).
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Palette, Vec3 } from '../assets/scene'
import { darkness, getClock } from '../game/dayClock'
import { HERO_COLOR_DEFAULT, useGameStore } from '../game/store'
import { heroTarget } from './heroTarget'
import { FACE_EPS, hero, HERO_RADIUS } from './heroState'
import { clearIntent } from './intent'
import { resolveCollisions, type Collider } from './collision'
import { getSpeech, subscribeSpeech } from './heroSpeech'
import { applyEyes, Blinker, collectEyes, gazeTarget } from './heroEyes'
import { pointerNDC, trackPointer } from './pointer'
import { HeroBubble } from './HeroBubble'
import { HERO_SEAT, HERO_YAW } from './truckStage'
import { playSfx } from '../audio/engine'
import { SFX } from '../audio/ambience'

const HERO_URL = '/assets/props/hero.glb'
useGLTF.preload(HERO_URL)

const SPEED = 2.4 // м/с
const STEP_RATE = 9 // рад/с — частота шага
const STEP_AMP = 0.5 // рад — размах ноги
const TURN_LAMBDA = 10 // скорость доворота на цель
const AMP_LAMBDA = 8 // с какой скоростью ноги замирают на месте
const ARRIVE = 0.05 // ближе этого считаем, что пришли
// Потолок ускорения: не даёт герою телепортироваться, если игрок завалит
// камеру совсем к горизонту и сжатие уйдёт в ноль.
const MAX_BOOST = 2
const MAX_DT = 0.1 // как в TruckTick: на фоновой вкладке dt огромен

/**
 * Ночью герой чуть теплится сам: без этого он растворяется в темноте, и игрок
 * теряет из виду того, кем управляет. Свечение слабое — это не фонарь, а намёк
 * на силуэт; окружающего оно не освещает.
 *
 * Светится он оттенком собственной одежды. Оттенком, а не самим цветом: тёмная
 * одежда светилась бы еле-еле, а светлая слепила бы. Яркость задаёт только
 * HERO_GLOW_MAX, цвет для этого разгоняется до полной насыщенности.
 */
const HERO_GLOW_WARM = new THREE.Color('#ffd9a0')

/** Примесь тёплого. Больше — и герой сереет: тёплый ярче любой одежды. */
const HERO_GLOW_WARMTH = 0.15
const HERO_GLOW_MAX = 0.055

/** Разгоняет цвет до полной яркости, сохраняя оттенок. Чёрный оставляет чёрным. */
function saturate(c: THREE.Color): THREE.Color {
  const peak = Math.max(c.r, c.g, c.b)
  return peak > 0 ? c.multiplyScalar(1 / peak) : c
}

/** Материал героя: гладкий, в отличие от фасеточной сцены. */
function smoothLambert(name: string, hex: string) {
  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) })
  mat.name = name
  return mat
}

/** Куда герой смотрит в модели — на −Z, как принято в three. */
function yawTo(dx: number, dz: number) {
  return Math.atan2(-dx, -dz)
}

/**
 * Мировая скорость с поправкой на наклон камеры.
 *
 * Камера смотрит с высоты ~23°, и метр «вглубь» кадра рисуется втрое короче
 * метра «вбок». Не поправляй ничего — герой вязнет на W и S; поправь целиком —
 * он там же начинает нестись, потому что мимо него пролетает вдвое больше
 * земли. Компенсируем наполовину: берём корень из сжатия. Вбок множитель 1.00,
 * вглубь 1.61, по диагонали 1.15 — ни то, ни другое не выпирает.
 *
 * Проекция для ортокамеры — просто длина вектора в её осях right/up.
 */
const camBasis = { right: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3() }

function screenSpeed(camera: THREE.Camera, vx: number, vz: number) {
  camera.matrixWorld.extractBasis(camBasis.right, camBasis.up, camBasis.fwd)
  const sx = vx * camBasis.right.x + vz * camBasis.right.z
  const sy = vx * camBasis.up.x + vz * camBasis.up.z
  const shrink = Math.hypot(sx, sy)
  return SPEED / Math.max(Math.sqrt(shrink), 1 / MAX_BOOST)
}

/** Разница углов, сведённая в (−π, π]: иначе доворот идёт через полный круг. */
function shortestArc(from: number, to: number) {
  return ((to - from + Math.PI) % (2 * Math.PI)) - Math.PI
}

/** code клавиши → орт в осях «вправо/вперёд» относительно камеры. */
const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

/** Слушает клавиши движения. Set, а не флаги: важны зажатые сразу несколько. */
function usePressedKeys() {
  const pressed = useRef(new Set<string>())
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!(e.code in KEY_DIRS)) return
      // Пошёл сам — значит передумал: отложенное дело у грядки отменяется,
      // иначе оно сработало бы, стоит ему случайно пройти мимо.
      clearIntent()
      pressed.current.add(e.code)
      e.preventDefault() // стрелки иначе скроллят страницу
    }
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code)
    // Отпускание за пределами окна теряется — иначе герой уходит в бесконечность.
    const blur = () => pressed.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return pressed
}

export function Hero({
  palette,
  start,
  colliders,
}: {
  palette: Palette
  start: Vec3
  colliders: readonly Collider[]
}) {
  const { scene } = useGLTF(HERO_URL)
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const pressed = usePressedKeys()
  const phrase = useSyncExternalStore(subscribeSpeech, getSpeech, getSpeech)
  const heroColor = useGameStore((s) => s.heroColor)

  // Белок и зрачок берём из палитры, одежду — из стора: её красит игрок.
  // Материал создаётся один раз, цвет в него доливает эффект ниже.
  const body = useMemo(() => {
    const mat = smoothLambert('Hero', HERO_COLOR_DEFAULT)
    mat.emissiveIntensity = 0 // разгорается по темноте, см. useFrame
    return mat
  }, [])
  const eyeMats = useMemo(
    () => ({
      HeroEyeWhite: smoothLambert('HeroEyeWhite', palette.HeroEyeWhite ?? '#f7f7f5'),
      HeroEyePupil: smoothLambert('HeroEyePupil', palette.HeroEyePupil ?? '#0d0d12'),
    }),
    [palette],
  )

  useEffect(() => {
    body.color.set(heroColor)
    saturate(body.emissive.set(heroColor)).lerp(HERO_GLOW_WARM, HERO_GLOW_WARMTH)
  }, [body, heroColor])

  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const name = (mesh.material as THREE.Material).name
      mesh.material = name in eyeMats ? eyeMats[name as keyof typeof eyeMats] : body
    })
    return clone
  }, [scene, body, eyeMats])

  const legs = useMemo(
    () => ({
      l: model.getObjectByName('HeroLegL'),
      r: model.getObjectByName('HeroLegR'),
    }),
    [model],
  )

  const eyes = useMemo(() => collectEyes(model), [model])
  const blinker = useRef(new Blinker())
  const gaze = useRef(new THREE.Vector3())
  const hasGaze = useRef(false)

  // Курсор слушаем у окна, а не у канваса: за открытой лавкой герой иначе
  // перестал бы следить за мышью — модалка съедает pointermove.
  useEffect(() => trackPointer(canvas), [canvas])

  const group = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const amp = useRef(0)
  // Был ли герой в фудтраке в прошлом кадре: по этому ловим конец дня продаж.
  const wasInTruck = useRef(false)
  // Нога касается земли на каждом полупериоде качания: считаем эти полупериоды.
  const halfSteps = useRef(0)

  // Без этого цель осталась бы в мировом нуле и герой на старте пошёл бы в дом.
  useEffect(() => {
    heroTarget.set(...start)
    hero.pos.set(...start)
  }, [start])

  // Переиспользуем векторы: useFrame не место для аллокаций.
  const fwd = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  /** Сколько осталось до цели по клику: последний шаг её не перелетает. */
  const toTarget = useRef(0)

  /**
   * Глаза: моргание и взгляд за курсором. Зовётся из обеих веток кадра —
   * и с фермы, и из-за прилавка. Иначе в день торговли зрачки замирали бы в
   * той позе, в какой их застал седьмой день.
   */
  const updateEyes = (g: THREE.Group, dt: number) => {
    if (!eyes.length) return
    // Цель взгляда ищем на уровне глаз: курсор в небе плоскость не пересекает —
    // тогда держим прежнюю цель, а не роняем взгляд в ноль.
    const eyeY = g.position.y + eyes[0].center.y
    if (gazeTarget(pointerNDC(), camera, eyeY, gaze.current)) hasGaze.current = true
    applyEyes(eyes, g, hasGaze.current ? gaze.current : null, blinker.current.step(dt), dt)
  }

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return

    // Незажатый dt телепортирует героя: шаг ограничен дистанцией до цели,
    // и один длинный кадр (свёрнутая вкладка, пауза GC) проходит весь путь.
    const dt = Math.min(rawDt, MAX_DT)
    if (dt <= 0) return

    // Днём свечения нет вовсе: darkness на свету равен нулю.
    body.emissiveIntensity = HERO_GLOW_MAX * darkness(getClock())

    // День 7: герой внутри фудтрака и никуда не ходит. Он оказывается там
    // сразу, а не идёт пешком: кузов закрыт, дверь со стороны кабины вне кадра,
    // и разыгрывать вход было бы враньём. Камера в этот момент ещё едет к
    // фудтраку, а створка раздачи только поднимается, — к концу перехода он уже
    // на месте, лицом к очереди.
    //
    // Ростом он тот же, что и всегда, но ноги в кузове прячем: интерьер ниже
    // его полного роста. За прилавком их всё равно не видно, а туловище встаёт
    // ровно на пол — за это отвечает y у HERO_SEAT.
    if (useGameStore.getState().phase === 'truck') {
      g.position.copy(HERO_SEAT)
      g.rotation.y = HERO_YAW

      hero.pos.set(g.position.x, 0, g.position.z)
      hero.moving = false
      wasInTruck.current = true

      amp.current = 0
      if (legs.l) legs.l.visible = false
      if (legs.r) legs.r.visible = false

      updateEyes(g, dt)
      return
    }

    // День продаж кончился. Герой не выходит из фудтрака пешком через полкарты —
    // новая неделя застаёт его дома, у двери, ровно там же, где начиналась игра.
    if (wasInTruck.current) {
      wasInTruck.current = false
      g.position.set(...start)
      g.rotation.y = 0
      heroTarget.set(...start)
      hero.pos.set(...start)
      hero.faceAt = null
      if (legs.l) legs.l.visible = true
      if (legs.r) legs.r.visible = true
    }

    // На ферме герой ходит по земле, а не по полу кузова.
    g.position.y = 0

    // --- куда хочет двигаться герой в этом кадре ---
    let vx = 0
    let vz = 0

    if (pressed.current.size) {
      let ix = 0
      let iz = 0
      for (const code of pressed.current) {
        const d = KEY_DIRS[code]
        ix += d[0]
        iz += d[1]
      }
      if (ix || iz) {
        // Оси экрана: «вперёд» — направление камеры, спроецированное на землю.
        camera.getWorldDirection(fwd.current)
        fwd.current.y = 0
        fwd.current.normalize()
        right.current.crossVectors(fwd.current, THREE.Object3D.DEFAULT_UP).normalize()

        vx = right.current.x * ix + fwd.current.x * iz
        vz = right.current.z * ix + fwd.current.z * iz
        const len = Math.hypot(vx, vz) || 1
        vx /= len // по диагонали не быстрее
        vz /= len
      }
      // Клавиши главнее клика: цель переезжает к герою, чтобы он не дёргался.
      heroTarget.set(g.position.x, 0, g.position.z)
    } else {
      const dx = heroTarget.x - g.position.x
      const dz = heroTarget.z - g.position.z
      const dist = Math.hypot(dx, dz)
      if (dist > ARRIVE) {
        vx = dx / dist
        vz = dz / dist
        toTarget.current = dist
      }
    }

    const walking = vx !== 0 || vz !== 0

    let moved = false
    if (walking) {
      // Шаг меряем по экрану, а не по земле — см. screenSpeed. По клику ещё и
      // не перелетаем цель на последнем шаге.
      let step = screenSpeed(camera, vx, vz) * dt
      if (!pressed.current.size) step = Math.min(step, toTarget.current)

      const wantX = g.position.x + vx * step
      const wantZ = g.position.z + vz * step
      const { x, z } = resolveCollisions(wantX, wantZ, HERO_RADIUS, colliders)
      moved = Math.hypot(x - g.position.x, z - g.position.z) > 1e-4
      g.position.x = x
      g.position.z = z

      const delta = shortestArc(g.rotation.y, yawTo(vx, vz))
      g.rotation.y += delta * (1 - Math.exp(-TURN_LAMBDA * dt))

      if (moved) {
        phase.current += STEP_RATE * dt
        // Шаг звучит по факту сдвига, а не по нажатой клавише: упёршись в стену,
        // герой перебирает ногами беззвучно — phase стоит вместе с ним.
        const half = Math.floor(phase.current / Math.PI)
        if (half !== halfSteps.current) {
          halfSteps.current = half
          // Тише прежнего вдвое: шаг звучит по два раза в секунду и на 0.5
          // перекрикивал всё остальное.
          playSfx(SFX.footstep, { gain: 0.28, rate: [0.9, 1.1], pan: [-0.25, 0.25] })
        }
      }

      // Идём по клику и упёрлись в препятствие: цель недостижима, бросаем её,
      // иначе герой будет вечно перебирать ногами в стену.
      if (!moved && !pressed.current.size) heroTarget.set(g.position.x, 0, g.position.z)
    } else if (hero.faceAt) {
      // Дошёл до грядки или пропса: доворачиваемся лицом, и лишь потом
      // <Interactions> выполнит дело. Ноги при этом стоят.
      const want = yawTo(hero.faceAt.x - g.position.x, hero.faceAt.z - g.position.z)
      g.rotation.y += shortestArc(g.rotation.y, want) * (1 - Math.exp(-TURN_LAMBDA * dt))
      hero.facing = Math.abs(shortestArc(g.rotation.y, want)) < FACE_EPS
    }

    hero.pos.set(g.position.x, 0, g.position.z)
    hero.moving = moved

    // Ноги не замирают рывком в случайной точке цикла — размах затухает.
    amp.current = THREE.MathUtils.damp(amp.current, moved ? STEP_AMP : 0, AMP_LAMBDA, dt)
    const swing = Math.sin(phase.current) * amp.current
    if (legs.l) legs.l.rotation.x = swing
    if (legs.r) legs.r.rotation.x = -swing

    updateEyes(g, dt)
  })

  return (
    <group ref={group} position={start}>
      <primitive object={model} />
      {phrase && <HeroBubble text={phrase} />}
    </group>
  )
}
