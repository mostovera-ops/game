/**
 * Фоновый звук по сценам: днём на ферме подложка и птицы, ночью — минорная
 * подложка и сова, в день торговли — вестерн и гул толпы. Между сценами
 * переходим перекрёстным затуханием. Ночь приходит из часов суток (dayClock).
 */
import { initAudio, playSfx, startLoop, closeAudio, type LoopHandle } from './engine'

const A = '/assets/audio'

export const SFX = {
  footstep: `${A}/footstep-grass.mp3`,
  plantSeed: `${A}/plant-seed.mp3`,
  waterPour: `${A}/water-pour.mp3`,
  harvestCut: `${A}/harvest-cut.mp3`,
  cashRegister: `${A}/cash-register.mp3`,
  dishMissed: `${A}/dish-missed.mp3`,
} as const

const FARM_BED = `${A}/ambient-loop.mp3`
const NIGHT_BED = `${A}/night-loop.mp3`
const TRUCK_BED = `${A}/truck-day-loop.mp3`
const CROWD = `${A}/crowd-murmur.mp3`
const OWL = `${A}/owl-hoot.mp3`

// Усиления не на глаз, а от измеренных пиков файлов: gain = цель / пик.
// Подложка фермы: пик 0.742 → в миксе 0.37. Музыка дня торговли: пик 0.877,
// она заметно громче сама по себе, поэтому усиление втрое меньше.
// Все петли — фон: их глушит кнопка в HUD (startLoop сажает на bgBus).
const FARM_BED_LOOP = { gain: 0.5, tailTrim: 1.6, crossfade: 2.5 } as const
// Ночь: пик 0.89, RMS 0.103 — как у фермы, поэтому и усиление почти то же.
const NIGHT_BED_LOOP = { gain: 0.45, tailTrim: 2.7, crossfade: 2.5 } as const
const TRUCK_BED_LOOP = { gain: 0.26, tailTrim: 0.7, crossfade: 2.5 } as const
// Толпа сидит под музыкой: пик 0.64 → в миксе 0.15. Тоже фон — с выключенным
// звуком ярмарка стихает вместе с музыкой.
const CROWD_LOOP = { gain: 0.22, tailTrim: 0.45, crossfade: 1.5 } as const

/**
 * Длина перехода между сценами. Ночь длится NIGHT_SECONDS = 10 с, так что
 * длиннее делать нельзя: закат не успеет договорить до рассвета.
 */
const SCENE_FADE = 1.5

interface NatureSpec {
  url: string
  /** Диапазон паузы между повторами, секунды. Разный у каждого — иначе слышен ритм. */
  delay: [number, number]
  gain: number
}

// Пики: bird 0.657, grasshopper 0.653, wing 0.413, twig 0.401, boar 0.873.
const DAY_NATURE: readonly NatureSpec[] = [
  { url: `${A}/bird-chirp.mp3`, delay: [6, 18], gain: 0.18 },
  { url: `${A}/grasshopper.mp3`, delay: [12, 35], gain: 0.12 },
  { url: `${A}/wing-flutter.mp3`, delay: [20, 60], gain: 0.19 },
  // Резкий транзиент при равном пике кажется тише протяжного звука.
  { url: `${A}/twig-snap.mp3`, delay: [25, 70], gain: 0.25 },
  { url: `${A}/boar-grunt.mp3`, delay: [45, 120], gain: 0.12 },
]

// Ночью птицы молчат. Ночь коротка (10 с), поэтому паузы куда меньше дневных:
// с дневными интервалами сова не успела бы ухнуть ни разу. Пик совы 0.551.
const NIGHT_NATURE: readonly NatureSpec[] = [
  { url: OWL, delay: [3, 6], gain: 0.22 },
  { url: `${A}/grasshopper.mp3`, delay: [4, 9], gain: 0.1 },
]

export const AUDIO_URLS: readonly string[] = [
  ...new Set([
    FARM_BED,
    NIGHT_BED,
    TRUCK_BED,
    CROWD,
    ...DAY_NATURE.map((n) => n.url),
    ...NIGHT_NATURE.map((n) => n.url),
    ...Object.values(SFX),
  ]),
]

export type Scene = 'farm' | 'night' | 'truck'

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Звуки природы: у каждого свой живой таймер, следующий взводится по срабатывании. */
function startNature(specs: readonly NatureSpec[]): () => void {
  const timers = new Map<string, number>()

  for (const spec of specs) {
    const schedule = (): void => {
      const id = window.setTimeout(
        () => {
          playSfx(spec.url, {
            gain: spec.gain * rand(0.7, 1),
            rate: [0.92, 1.08],
            pan: [-0.7, 0.7],
            background: true, // птицы и стрекот — фон, их глушит кнопка
          })
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
    return {
      loops: [startLoop(FARM_BED, { ...FARM_BED_LOOP, silent })],
      stopNature: startNature(DAY_NATURE),
    }
  }
  if (scene === 'night') {
    // Первый ух — сразу, не дожидаясь таймера: ночь должна заявить о себе,
    // а длится она всего десять секунд.
    playSfx(OWL, { gain: 0.22, pan: [-0.5, 0.5], background: true })
    return {
      loops: [startLoop(NIGHT_BED, { ...NIGHT_BED_LOOP, silent })],
      stopNature: startNature(NIGHT_NATURE),
    }
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
