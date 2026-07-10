/**
 * Аудио-движок: один AudioContext на всю игру, буферы, зацикленные слои.
 *
 * Все ассеты сгенерированы разово (tools/gen_audio.mjs) и лежат в
 * public/assets/audio — в рантайме сеть не дёргается.
 *
 * Контекст создаётся только из жеста пользователя: до него браузер не даст
 * ничего проиграть. Пока движок не запущен, playSfx и blip молча ничего не
 * делают — вызывающему не нужно каждый раз проверять готовность.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
/**
 * Фоновая шина: музыка, птицы, стрекот, гул толпы — всё, что глушит кнопка
 * в HUD. Звуки действий (шаги, вода, серп, касса) идут мимо неё, прямо в
 * master, и звучат даже с выключенным фоном.
 */
let bgBus: GainNode | null = null
let bgEnabled = true
const buffers = new Map<string, AudioBuffer>()

/** Гасим не мгновенно: ступенька в громкости слышна как щелчок. */
const BG_TOGGLE_SEC = 0.25

/** Помнит выбор и до создания контекста: кнопку могли нажать раньше первого жеста. */
export function setBackgroundEnabled(on: boolean): void {
  bgEnabled = on
  if (!ctx || !bgBus) return
  const t = ctx.currentTime
  bgBus.gain.cancelScheduledValues(t)
  bgBus.gain.setValueAtTime(bgBus.gain.value, t)
  bgBus.gain.linearRampToValueAtTime(on ? 1 : 0.0001, t + BG_TOGGLE_SEC)
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Равномощная кривая: линейная дала бы просадку громкости в середине шва. */
function fadeCurve(rising: boolean, steps = 64): Float32Array {
  const curve = new Float32Array(steps)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    curve[i] = rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2)
  }
  return curve
}

const RISING = fadeCurve(true)
const FALLING = fadeCurve(false)

export async function initAudio(urls: readonly string[]): Promise<void> {
  if (ctx) return

  const c = new AudioContext()
  if (c.state === 'suspended') await c.resume()

  const m = c.createGain()
  m.gain.value = 1
  m.connect(c.destination)

  const bus = c.createGain()
  bus.gain.value = bgEnabled ? 1 : 0.0001
  bus.connect(m)

  await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`audio: не загрузился ${url}: ${res.status}`)
      buffers.set(url, await c.decodeAudioData(await res.arrayBuffer()))
    }),
  )

  ctx = c
  master = m
  bgBus = bus
}

export function closeAudio(): void {
  void ctx?.close()
  ctx = null
  master = null
  bgBus = null
  buffers.clear()
}

export interface SfxOptions {
  gain?: number
  /** Разброс высоты: повторы одного файла не должны звучать одинаково. */
  rate?: [number, number]
  /** Разброс позиции в стерео. */
  pan?: [number, number]
  /** Фоновый звук (птицы, стрекот): идёт через шину, которую глушит кнопка. */
  background?: boolean
}

export function playSfx(url: string, opts: SfxOptions = {}): void {
  if (!ctx || !master || !bgBus) return
  const buffer = buffers.get(url)
  if (!buffer) return

  const src = ctx.createBufferSource()
  src.buffer = buffer
  if (opts.rate) src.playbackRate.value = rand(...opts.rate)

  const gain = ctx.createGain()
  gain.gain.value = opts.gain ?? 1

  const pan = ctx.createStereoPanner()
  pan.pan.value = opts.pan ? rand(...opts.pan) : 0

  src.connect(gain).connect(pan).connect(opts.background ? bgBus : master)
  src.start()
}

/** Длина одного блипа реплики. Больше — и на быстром наборе они наложатся. */
const BLIP_SEC = 0.09
const BLIP_GAIN = 0.05

/**
 * Тон реплики: короткий писк на каждую букву, как в Undertale.
 * Осциллятором, а не файлом: высота меняется по говорящему, длительность
 * настраивается, весит ноль.
 */
export function blip(freq = 380): void {
  if (!ctx || !master) return

  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq * rand(0.97, 1.03)

  const gain = ctx.createGain()
  // Мгновенная атака даёт щелчок; 5 мс его убирают, на слух это всё ещё резко.
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(BLIP_GAIN, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + BLIP_SEC)

  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + BLIP_SEC + 0.01)
}

/**
 * Щелчок кнопки. Тоже осциллятором: генератор эффектов три раза подряд отдавал
 * на «громкий короткий стук» почти тишину (пик 0.006).
 */
export function uiClick(): void {
  if (!ctx || !master) return

  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  // Быстрый спад высоты превращает тон в стук по дереву, а не в писк.
  osc.frequency.setValueAtTime(760, t)
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.05)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.12, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)

  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + 0.09)
}

export interface LoopHandle {
  fadeIn: (sec: number) => void
  fadeOut: (sec: number) => void
  stop: () => void
}

export interface LoopOptions {
  gain: number
  /** Сколько секунд тишины в конце файла отрезать перед сшивкой. */
  tailTrim: number
  /** Длина кроссфейда между соседними копиями. */
  crossfade: number
  /** Стартовать в тишине — чтобы затем ввести слой через fadeIn. */
  silent?: boolean
}

/** За сколько секунд до старта следующей копии её ставим в расписание. */
const SCHEDULE_AHEAD = 5

/**
 * Крутит файл в цикле. Треки затухают в тишину на концах, поэтому обычный
 * loop = true давал бы слышимый провал: хвост режем, копии сшиваем кроссфейдом.
 *
 * Все зацикленные слои (подложки, гул толпы) — фон: идут через bgBus и
 * глушатся кнопкой.
 */
export function startLoop(url: string, o: LoopOptions): LoopHandle {
  if (!ctx || !master || !bgBus) throw new Error('audio: startLoop до initAudio')
  const c = ctx
  const buffer = buffers.get(url)
  if (!buffer) throw new Error(`audio: буфер ${url} не загружен`)

  const out = c.createGain()
  out.gain.value = o.silent ? 0.0001 : o.gain
  out.connect(bgBus)

  const playFor = buffer.duration - o.tailTrim
  const period = playFor - o.crossfade
  const live = new Set<AudioBufferSourceNode>()

  const playAt = (startAt: number): void => {
    const src = c.createBufferSource()
    src.buffer = buffer

    const g = c.createGain()
    g.gain.setValueAtTime(0, startAt)
    g.gain.setValueCurveAtTime(RISING, startAt, o.crossfade)
    g.gain.setValueCurveAtTime(FALLING, startAt + period, o.crossfade)

    src.connect(g).connect(out)
    src.start(startAt)
    src.stop(startAt + playFor)

    live.add(src)
    src.addEventListener('ended', () => live.delete(src), { once: true })
  }

  let nextStart = c.currentTime + 0.05
  playAt(nextStart)
  nextStart += period

  // Копии ставим в расписание заранее: setInterval неточен, а start(t) — точен.
  const ticker = window.setInterval(() => {
    if (nextStart - c.currentTime < SCHEDULE_AHEAD) {
      playAt(nextStart)
      nextStart += period
    }
  }, 1000)

  return {
    fadeIn: (sec) => {
      out.gain.cancelScheduledValues(c.currentTime)
      out.gain.setValueAtTime(out.gain.value, c.currentTime)
      out.gain.linearRampToValueAtTime(o.gain, c.currentTime + sec)
    },
    fadeOut: (sec) => {
      out.gain.cancelScheduledValues(c.currentTime)
      out.gain.setValueAtTime(out.gain.value, c.currentTime)
      out.gain.linearRampToValueAtTime(0.0001, c.currentTime + sec)
    },
    stop: () => {
      window.clearInterval(ticker)
      live.forEach((src) => src.stop())
    },
  }
}
