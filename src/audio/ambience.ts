/**
 * Фоновый звук: у фермы своя подложка и звуки природы, у дня торговли — своя
 * музыка и гул толпы. Между сценами переходим перекрёстным затуханием.
 */
import { initAudio, playSfx, startLoop, closeAudio, type LoopHandle } from './engine'

const A = '/assets/audio'

export const SFX = {
  footstep: `${A}/footstep-grass.mp3`,
  plantSeed: `${A}/plant-seed.mp3`,
  waterPour: `${A}/water-pour.mp3`,
  cashRegister: `${A}/cash-register.mp3`,
  dishMissed: `${A}/dish-missed.mp3`,
} as const

const FARM_BED = `${A}/ambient-loop.mp3`
const TRUCK_BED = `${A}/truck-day-loop.mp3`
const CROWD = `${A}/crowd-murmur.mp3`

// Усиления не на глаз, а от измеренных пиков файлов: gain = цель / пик.
// Подложка фермы: пик 0.742 → в миксе 0.37. Музыка дня торговли: пик 0.877,
// она заметно громче сама по себе, поэтому усиление втрое меньше.
// Подложки — на музыкальной шине: их и глушит кнопка в HUD.
const FARM_BED_LOOP = { gain: 0.5, tailTrim: 1.6, crossfade: 2.5, bus: 'music' } as const
const TRUCK_BED_LOOP = { gain: 0.26, tailTrim: 0.7, crossfade: 2.5, bus: 'music' } as const
// Толпа сидит под музыкой, а не поверх: пик 0.64 → в миксе 0.15.
// Это звук, а не музыка: с выключенной музыкой ярмарка всё равно гудит.
const CROWD_LOOP = { gain: 0.22, tailTrim: 0.45, crossfade: 1.5, bus: 'ambient' } as const

/** Длина перехода между фермой и днём торговли. */
const SCENE_FADE = 1.5

interface NatureSpec {
  url: string
  /** Диапазон паузы между повторами, секунды. Разный у каждого — иначе слышен ритм. */
  delay: [number, number]
  gain: number
}

// Пики: bird 0.657, grasshopper 0.653, wing 0.413, twig 0.401, boar 0.873.
const NATURE: readonly NatureSpec[] = [
  { url: `${A}/bird-chirp.mp3`, delay: [6, 18], gain: 0.18 },
  { url: `${A}/grasshopper.mp3`, delay: [12, 35], gain: 0.12 },
  { url: `${A}/wing-flutter.mp3`, delay: [20, 60], gain: 0.19 },
  // Резкий транзиент при равном пике кажется тише протяжного звука.
  { url: `${A}/twig-snap.mp3`, delay: [25, 70], gain: 0.25 },
  { url: `${A}/boar-grunt.mp3`, delay: [45, 120], gain: 0.12 },
]

export const AUDIO_URLS: readonly string[] = [
  FARM_BED,
  TRUCK_BED,
  CROWD,
  ...NATURE.map((n) => n.url),
  ...Object.values(SFX),
]

export type Scene = 'farm' | 'truck'

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Звуки природы: у каждого свой живой таймер, следующий взводится по срабатывании. */
function startNature(): () => void {
  const timers = new Map<string, number>()

  for (const spec of NATURE) {
    const schedule = (): void => {
      const id = window.setTimeout(
        () => {
          playSfx(spec.url, { gain: spec.gain * rand(0.7, 1), rate: [0.92, 1.08], pan: [-0.7, 0.7] })
          schedule()
        },
        rand(...spec.delay) * 1000,
      )
      timers.set(spec.url, id)
    }
    schedule()
  }

  return () => timers.forEach((id) => window.clearTimeout(id))
}

interface SceneLayer {
  loops: LoopHandle[]
  stopNature?: () => void
}

/** silent — слой вводится через fadeIn; иначе стартует сразу на своей громкости. */
function startScene(scene: Scene, silent: boolean): SceneLayer {
  if (scene === 'farm') {
    return { loops: [startLoop(FARM_BED, { ...FARM_BED_LOOP, silent })], stopNature: startNature() }
  }
  return {
    loops: [
      startLoop(TRUCK_BED, { ...TRUCK_BED_LOOP, silent }),
      startLoop(CROWD, { ...CROWD_LOOP, silent }),
    ],
  }
}

export interface Ambience {
  setScene: (scene: Scene) => void
  stop: () => void
}

/**
 * Запускает фон. Браузеры блокируют автоплей до жеста пользователя,
 * поэтому вызывать только из обработчика клика/нажатия.
 */
export async function startAmbience(initial: Scene): Promise<Ambience> {
  await initAudio(AUDIO_URLS)

  let current = initial
  let layer = startScene(initial, false)
  /** Отложенные глушилки уходящих слоёв: их надо снять при stop(). */
  const pending = new Set<number>()

  return {
    setScene: (scene) => {
      if (scene === current) return
      current = scene

      const old = layer
      layer = startScene(scene, true)
      layer.loops.forEach((l) => l.fadeIn(SCENE_FADE))

      old.stopNature?.()
      old.loops.forEach((l) => l.fadeOut(SCENE_FADE))
      // Источники глушим после затухания, иначе оборвём его на полуслове.
      const id = window.setTimeout(() => {
        old.loops.forEach((l) => l.stop())
        pending.delete(id)
      }, (SCENE_FADE + 0.2) * 1000)
      pending.add(id)
    },
    stop: () => {
      pending.forEach((id) => window.clearTimeout(id))
      layer.stopNature?.()
      layer.loops.forEach((l) => l.stop())
      closeAudio()
    },
  }
}
