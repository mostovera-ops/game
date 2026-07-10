// Фоновый эмбиент фермы: музыкальная подложка в цикле + редкие звуки природы.
// Ассеты сгенерированы разово (tools/gen_audio.mjs) и лежат в public/assets/audio.
// В рантайме сеть не дёргается.

const MUSIC_URL = '/assets/audio/ambient-loop.mp3'
// Подложка тихая сама по себе (RMS 0.101, пик 0.742), поэтому усиление высокое:
// в миксе даёт RMS ≈ 0.05 и пик ≈ 0.37. Меняете трек — перемеряйте и это.
const MUSIC_GAIN = 0.5

// Трек заканчивается затуханием в тишину (~1.5 с). При обычном loop = true
// каждую минуту слышен провал, поэтому хвост обрезаем и сшиваем кроссфейдом.
const MUSIC_TAIL_TRIM = 1.6
const MUSIC_CROSSFADE = 2.5
/** За сколько секунд до старта следующей копии её ставим в расписание. */
const MUSIC_SCHEDULE_AHEAD = 5

/** Равномощная кривая: линейная дала бы просадку громкости в середине шва. */
function fadeCurve(rising: boolean, steps = 64): Float32Array {
  const curve = new Float32Array(steps)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    curve[i] = rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2)
  }
  return curve
}

interface SfxSpec {
  url: string
  /** Диапазон паузы между повторами, секунды. Разный у каждого — иначе слышен ритм. */
  delay: [number, number]
  /** Базовая громкость; к ней добавляется случайный разброс. */
  gain: number
}

// Усиления не на глаз, а от измеренных пиков файлов: gain = target / peak.
// Подложка в миксе пикует около 0.37 (0.742 × MUSIC_GAIN), природа должна
// оставаться под ней. Пики: bird 0.657, grasshopper 0.653, wing 0.413,
// twig 0.401, boar 0.873.
const SFX: readonly SfxSpec[] = [
  // цель 0.12 — слышно, но не вздрагиваешь
  { url: '/assets/audio/bird-chirp.mp3', delay: [6, 18], gain: 0.18 },
  // цель 0.08 — стрекот длинный и плотный, давим сильнее
  { url: '/assets/audio/grasshopper.mp3', delay: [12, 35], gain: 0.12 },
  { url: '/assets/audio/wing-flutter.mp3', delay: [20, 60], gain: 0.19 },
  // цель 0.10 — резкий транзиент, при равном пике кажется громче остальных
  { url: '/assets/audio/twig-snap.mp3', delay: [25, 70], gain: 0.25 },
  { url: '/assets/audio/boar-grunt.mp3', delay: [45, 120], gain: 0.12 },
]

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ambience: не загрузился ${url}: ${res.status}`)
  return ctx.decodeAudioData(await res.arrayBuffer())
}

export interface Ambience {
  stop: () => void
}

/**
 * Запускает эмбиент. Браузеры блокируют автоплей до жеста пользователя,
 * поэтому вызывать только из обработчика клика/нажатия.
 */
export async function startAmbience(): Promise<Ambience> {
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()

  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  const [musicBuffer, ...sfxBuffers] = await Promise.all([
    loadBuffer(ctx, MUSIC_URL),
    ...SFX.map((s) => loadBuffer(ctx, s.url)),
  ])

  const musicGain = ctx.createGain()
  musicGain.gain.value = MUSIC_GAIN
  musicGain.connect(master)

  // Полезная длина копии и шаг между стартами соседних копий.
  const playFor = musicBuffer.duration - MUSIC_TAIL_TRIM
  const period = playFor - MUSIC_CROSSFADE
  const rising = fadeCurve(true)
  const falling = fadeCurve(false)

  const liveMusic = new Set<AudioBufferSourceNode>()

  const playMusicAt = (startAt: number): void => {
    const src = ctx.createBufferSource()
    src.buffer = musicBuffer

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, startAt)
    g.gain.setValueCurveAtTime(rising, startAt, MUSIC_CROSSFADE)
    g.gain.setValueCurveAtTime(falling, startAt + period, MUSIC_CROSSFADE)

    src.connect(g).connect(musicGain)
    src.start(startAt)
    src.stop(startAt + playFor)

    liveMusic.add(src)
    src.addEventListener('ended', () => liveMusic.delete(src), { once: true })
  }

  let nextMusicStart = ctx.currentTime + 0.05
  playMusicAt(nextMusicStart)
  nextMusicStart += period

  // Следующую копию ставим в расписание заранее: setInterval неточен, а start(t) — точен.
  const musicTicker = window.setInterval(() => {
    if (nextMusicStart - ctx.currentTime < MUSIC_SCHEDULE_AHEAD) {
      playMusicAt(nextMusicStart)
      nextMusicStart += period
    }
  }, 1000)

  // По одному живому таймеру на каждый звук: следующий взводится, когда сработал предыдущий.
  const timers = new Map<string, number>()

  SFX.forEach((spec, i) => {
    const buffer = sfxBuffers[i]
    const schedule = (): void => {
      const id = window.setTimeout(() => {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        // Небольшой разброс высоты и позиции в стерео — чтобы повторы не звучали одинаково.
        src.playbackRate.value = rand(0.92, 1.08)

        const gain = ctx.createGain()
        gain.gain.value = spec.gain * rand(0.7, 1)

        const pan = ctx.createStereoPanner()
        pan.pan.value = rand(-0.7, 0.7)

        src.connect(gain).connect(pan).connect(master)
        src.start()

        schedule()
      }, rand(...spec.delay) * 1000)
      timers.set(spec.url, id)
    }
    schedule()
  })

  return {
    stop: () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.clearInterval(musicTicker)
      liveMusic.forEach((src) => src.stop())
      void ctx.close()
    },
  }
}
