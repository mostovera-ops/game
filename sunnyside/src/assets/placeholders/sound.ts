/**
 * sound.ts — заглушки звука (22-audio-visual.md §7.3 «Звук-заглушки: синтез-блипы»).
 *
 * Никаких временных стоковых mp3/wav в репозитории — до прихода финальных сэмплов/партитуры
 * весь звук синтезируется в рантайме через Web Audio API (`OscillatorNode` + `GainNode` envelope
 * для блипов/аккордов, `AudioBufferSourceNode` с шумовым буфером для «шума»/эмбиента). Нулевой
 * вес в бандле (22-av §7.3).
 *
 * **Тишина без жеста.** `AudioContext` создаётся и активируется ТОЛЬКО через `unlockAudio()`,
 * вызванный из обработчика юзер-жеста (браузерная autoplay-политика + явное требование задачи).
 * До активации `playSfx`/`startAmbientLoop`/`playMusicContext` — no-op (тишина), ничего не
 * бросает и не создаёт контекст сам по себе. Вызови `attachAutoUnlock()` один раз в bootstrap —
 * он сам активирует звук по первому клику/тапу/клавише и снимет свои слушатели.
 *
 * Категории и параметры синтеза — 1:1 таблица 22-av §7.3; SFX-id согласованы с
 * `registry.ts` (`sfx_*` записи, §17 реестра) для grep-трассируемости перед релизом.
 */

export type SfxCategory =
  | 'ui_success'
  | 'ui_error'
  | 'farm_action'
  | 'cooking_ready'
  | 'diner_cash'
  | 'sale_mastery'
  | 'contest_win'
  | 'animals_generic'
  | 'fair_crowd'
  | 'notification_mail'
  | 'notification_neighbor'
  | 'notification_jukebox'
  /**
   * Веха Appetite Meter (22-av §4.4 «Аппетитометр-тик») — вспышка вдоль шкалы + разлёт
   * искр, звук-компаньон «восходящий фанфарный мотив». Отдельная категория от
   * `contest_win` (тот — победа в конкурсе, длиннее/аккорд), эта — короче/чаще.
   */
  | 'event_milestone'
  /**
   * Смена фазы недели (audio-wiring, канон §2.3 календарь) — мягкий двутон-переход,
   * не «уведомление», а фоновая «страница перевернулась» подсказка (P3, тёплый тон).
   */
  | 'week_phase_change'

export type AmbientCategory = 'ambient_night'

export type MusicContext =
  | 'music_farm_day'
  | 'music_farm_night'
  | 'music_shift'
  | 'music_fair'
  | 'music_event_final'
  | 'music_menu'

export type AudioBusKind = 'music' | 'sfx' | 'ambient'

type Waveform = OscillatorType

interface Bus {
  gain: GainNode
  /** Локальная копия текущей громкости (0..1) — для чтения без гонки на AudioParam. */
  volume: number
}

// ── Состояние модуля (лениво создаётся по юзер-жесту) ───────────────────────

let ctx: AudioContext | null = null
let unlocked = false
let buses: { music: Bus; sfx: Bus; ambient: Bus } | null = null
let ambientSource: AudioBufferSourceNode | null = null
let ambientWanted: AmbientCategory | null = null
let musicStop: (() => void) | null = null
let noiseBuffer: AudioBuffer | null = null
/** Слушатели «звук только что разблокирован» — см. `onAudioUnlocked`. */
const unlockListeners = new Set<() => void>()

function getWindow(): (Window & typeof globalThis) | undefined {
  return typeof window === 'undefined' ? undefined : window
}

/** Есть ли прямо сейчас активированный (юзер-жестом) звуковой контекст. */
export function isAudioUnlocked(): boolean {
  return unlocked && ctx !== null
}

function createContext(): AudioContext | null {
  const w = getWindow()
  if (w === undefined) return null
  type LegacyWindow = Window & { webkitAudioContext?: typeof AudioContext }
  const Ctor = w.AudioContext ?? (w as LegacyWindow).webkitAudioContext
  if (Ctor === undefined) return null
  return new Ctor()
}

function ensureBuses(context: AudioContext): { music: Bus; sfx: Bus; ambient: Bus } {
  if (buses !== null) return buses
  const make = (initial: number): Bus => {
    const gain = context.createGain()
    gain.gain.value = initial
    gain.connect(context.destination)
    return { gain, volume: initial }
  }
  const created = { music: make(0.6), sfx: make(0.8), ambient: make(0.35) }
  buses = created
  return created
}

/**
 * Активировать WebAudio по юзер-жесту. Идемпотентна — повторные вызовы после первой
 * успешной активации не создают новый контекст. Без вызова этой функции ВЕСЬ модуль
 * остаётся немым (canon-требование задачи + браузерная autoplay-политика).
 */
export function unlockAudio(): void {
  if (unlocked) return
  const context = ctx ?? createContext()
  if (context === null) return
  ctx = context
  ensureBuses(context)
  if (context.state === 'suspended') {
    void context.resume()
  }
  unlocked = true
  if (ambientWanted !== null) startAmbientLoop(ambientWanted)
  for (const cb of unlockListeners) cb()
}

/**
 * Подписка «звук только что разблокирован по жесту» — audio-wiring использует это, чтобы
 * применить сохранённые настройки громкости (`ui.volume`) сразу к свежесозданным шинам
 * (иначе они стартуют с дефолтом `ensureBuses`, а не с пользовательским значением). Если
 * звук уже разблокирован на момент вызова — коллбек срабатывает немедленно (нет пропуска
 * «уже опоздал»). Возвращает функцию отписки.
 */
export function onAudioUnlocked(cb: () => void): () => void {
  if (isAudioUnlocked()) {
    cb()
    return () => {}
  }
  unlockListeners.add(cb)
  return () => unlockListeners.delete(cb)
}

/**
 * Регистрирует одноразовые слушатели жеста (pointerdown/keydown/touchstart) которые
 * вызывают `unlockAudio()` и сами себя снимают. Вызвать один раз при старте приложения
 * (bootstrap). Возвращает функцию отписки (на случай размонтирования до первого жеста).
 */
export function attachAutoUnlock(): () => void {
  const w = getWindow()
  if (w === undefined) return () => {}

  const handler = (): void => {
    unlockAudio()
    detach()
  }
  const opts: AddEventListenerOptions = { once: true, passive: true }

  function detach(): void {
    w!.removeEventListener('pointerdown', handler)
    w!.removeEventListener('keydown', handler)
    w!.removeEventListener('touchstart', handler)
  }

  w.addEventListener('pointerdown', handler, opts)
  w.addEventListener('keydown', handler, opts)
  w.addEventListener('touchstart', handler, opts)
  return detach
}

// ── Громкость шин (19-ui-ux/22-av §5: «Три независимых слайдера — Музыка/SFX/Ambient») ──

/** Установить громкость шины (0..1). No-op, если контекст ещё не активирован. */
export function setBusVolume(bus: AudioBusKind, volume: number): void {
  const clamped = Math.min(1, Math.max(0, volume))
  if (buses === null || ctx === null) return
  const b = buses[bus]
  b.volume = clamped
  b.gain.gain.setValueAtTime(clamped, ctx.currentTime)
}

/** Текущая громкость шины (0, если контекст ещё не создан). */
export function getBusVolume(bus: AudioBusKind): number {
  return buses?.[bus].volume ?? 0
}

// ── Низкоуровневые синтез-примитивы ─────────────────────────────────────────

/** Один осциллятор с линейной/эксп. envelope (атака 15мс, экспоненциальный decay). */
function envelopeOsc(
  context: AudioContext,
  destination: GainNode,
  type: Waveform,
  freqStart: number,
  freqEnd: number,
  startAt: number,
  duration: number,
  peakGain = 0.7,
): void {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, freqStart), startAt)
  if (freqEnd !== freqStart) {
    osc.frequency.linearRampToValueAtTime(Math.max(1, freqEnd), startAt + duration)
  }
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + Math.min(0.015, duration * 0.25))
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/** Несколько осцилляторов одновременно (аккорд), напр. Contest win / Event milestone (§7.3). */
function chord(
  context: AudioContext,
  destination: GainNode,
  type: Waveform,
  freqs: readonly number[],
  startAt: number,
  duration: number,
  peakGain = 0.5,
): void {
  const perVoice = peakGain / Math.max(1, freqs.length) + 0.08
  for (const f of freqs) envelopeOsc(context, destination, type, f, f, startAt, duration, perVoice)
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer !== null) return noiseBuffer
  const length = Math.floor(context.sampleRate * 2) // 2с петля белого шума
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

function playNoiseBurst(context: AudioContext, destination: GainNode, startAt: number, duration: number, peak: number): void {
  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.1)
  gain.gain.linearRampToValueAtTime(0.0001, startAt + duration)
  source.connect(gain)
  gain.connect(destination)
  source.start(startAt)
  source.stop(startAt + duration + 0.05)
}

// ── SFX: один блип/аккорд/шум по категории события (22-av §7.3 таблица) ─────

/**
 * Проиграть один SFX по категории. No-op (тишина) если `!isAudioUnlocked()` — это
 * основное правило задачи: без юзер-жеста модуль нем.
 */
export function playSfx(category: SfxCategory): void {
  if (!isAudioUnlocked() || ctx === null || buses === null) return
  const context = ctx
  const dest = buses.sfx.gain
  const t0 = context.currentTime

  switch (category) {
    case 'ui_success':
      // 440 → 554 Hz, 120 мс, sine (§7.3 «UI успех/подтверждение»)
      envelopeOsc(context, dest, 'sine', 440, 554, t0, 0.12)
      break
    case 'ui_error':
      // 392 → 330 Hz, 150 мс, triangle (§7.3 «UI ошибка/мягкий отказ»)
      envelopeOsc(context, dest, 'triangle', 392, 330, t0, 0.15)
      break
    case 'farm_action':
      // 300 Hz, 80 мс, square, decay 40 мс (§7.3 «Farm (полив/сбор)»)
      envelopeOsc(context, dest, 'square', 300, 300, t0, 0.08, 0.55)
      break
    case 'cooking_ready':
      // 3× 600 Hz, 100 мс каждый, интервал 150 мс (§7.3 «Cooking (готово)»)
      for (let i = 0; i < 3; i++) envelopeOsc(context, dest, 'triangle', 600, 600, t0 + i * 0.15, 0.1)
      break
    case 'diner_cash':
      // 523/659/784 Hz (C-E-G), по 90 мс, sine (§7.3 «Diner/Counter (касса)»)
      ;[523, 659, 784].forEach((f, i) => envelopeOsc(context, dest, 'sine', f, f, t0 + i * 0.09, 0.09))
      break
    case 'sale_mastery':
      // пентатоника от 440 Hz, 5 нот по 60 мс, лёгкое вибрато (§7.3 «Sale/Mastery-апгрейд»)
      ;[440, 494, 554, 659, 740].forEach((f, i) => envelopeOsc(context, dest, 'sine', f, f * 1.01, t0 + i * 0.06, 0.09, 0.5))
      break
    case 'contest_win':
      // C-major триада (523/659/784 Hz), sawtooth, envelope 1000 мс (§7.3 «Contest win»)
      chord(context, dest, 'sawtooth', [523, 659, 784], t0, 1.0, 0.6)
      break
    case 'animals_generic':
      // тёплый короткий тон, приближение категории Animals (22-av §4.7)
      envelopeOsc(context, dest, 'triangle', 260, 220, t0, 0.3, 0.5)
      break
    case 'fair_crowd':
      // гул толпы — шумовой всплеск, категория Fair (22-av §4.7)
      playNoiseBurst(context, dest, t0, 1.5, 0.15)
      break
    case 'notification_mail':
      // двутон-гудок, категория Notification — почта (22-av §3.8)
      ;[440, 349].forEach((f, i) => envelopeOsc(context, dest, 'square', f, f, t0 + i * 0.12, 0.14, 0.4))
      break
    case 'notification_neighbor':
      envelopeOsc(context, dest, 'sine', 500, 700, t0, 0.2, 0.5)
      break
    case 'notification_jukebox':
      chord(context, dest, 'sine', [659, 831], t0, 0.25, 0.5)
      break
    case 'event_milestone':
      // восходящий фанфарный мотив, короче contest_win (22-av §4.4 «Meter Tick Glow»)
      ;[523, 659, 880].forEach((f, i) => envelopeOsc(context, dest, 'triangle', f, f, t0 + i * 0.08, 0.16, 0.55))
      break
    case 'week_phase_change':
      // мягкий двутон-переход «страница недели перевернулась», тёплый, не резкий (P3)
      envelopeOsc(context, dest, 'sine', 349, 440, t0, 0.35, 0.35)
      break
  }
}

// ── Ambient (шум, тихий постоянный фон — 22-av §7.3 «Ambient (плейсхолдер)») ─

/**
 * Запустить петлю эмбиента (белый шум, gain 0.05-эквивалент через ambient-шину).
 * Запоминает «желаемую» категорию — если контекст ещё не разблокирован, запустится
 * автоматически сразу после `unlockAudio()`.
 */
export function startAmbientLoop(category: AmbientCategory): void {
  stopAmbientLoop()
  ambientWanted = category
  if (!isAudioUnlocked() || ctx === null || buses === null) return
  const context = ctx
  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true
  source.connect(buses.ambient.gain)
  source.start()
  ambientSource = source
}

export function stopAmbientLoop(): void {
  ambientWanted = null
  if (ambientSource !== null) {
    try {
      ambientSource.stop()
    } catch {
      // уже остановлен браузером — не критично
    }
    ambientSource.disconnect()
    ambientSource = null
  }
}

// ── Музыка-заглушка (22-av §4.8 контексты, §7.3 «8-битный чиптюн-луп») ──────

const MUSIC_BPM: Record<MusicContext, number> = {
  music_farm_day: 85,
  music_farm_night: 70,
  music_shift: 152,
  music_fair: 138,
  music_event_final: 160,
  music_menu: 70,
}

/** Мажорная пентатоника (относительно тоники) — простая «дружелюбная» мелодия-заглушка. */
const PENTATONIC_RATIOS: readonly number[] = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]
/** Индексы шагов мелодии по кругу (простая волна вверх-вниз). */
const MELODY_STEPS: readonly number[] = [0, 2, 4, 7, 9, 7, 4, 2]

function noteFreq(rootHz: number, step: number): number {
  const size = PENTATONIC_RATIOS.length
  const octave = Math.floor(step / size)
  const idx = ((step % size) + size) % size
  const ratio = PENTATONIC_RATIOS[idx] ?? 1
  return rootHz * ratio * Math.pow(2, octave)
}

/**
 * Явная маркировка заглушки в коде (22-av §7.3: «Явно маркируется в коде как
 * `STUB_MUSIC_<context>`, заменяется в первую очередь при поступлении арта»).
 * Используется в grep-чек-листе перед релизом (§7.4 п.7).
 */
export function stubMusicLabel(context: MusicContext): string {
  return `STUB_MUSIC_${context.replace(/^music_/, '').toUpperCase()}`
}

/**
 * Запустить простой 2-осцилляторный чиптюн-луп (мелодия+бас), квантованный под BPM
 * контекста (§4.8 сводная таблица). Останавливает предыдущий контекст перед стартом
 * нового — debounce смены контекста (edge case V4, 2с) остаётся ответственностью вызывающего
 * кода (напр. store-слоя музыки), здесь только сам стуб-плеер.
 */
export function playMusicContext(musicContext: MusicContext, rootHz = 261.63 /* C4 */): void {
  stopMusic()
  if (!isAudioUnlocked() || ctx === null || buses === null) return
  const audioCtx = ctx
  const dest = buses.music.gain
  const bpm = MUSIC_BPM[musicContext]
  const beatSeconds = 60 / bpm
  let stepIndex = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleNext(): void {
    if (stopped) return
    const size = MELODY_STEPS.length
    const step = MELODY_STEPS[stepIndex % size] ?? 0
    const freq = noteFreq(rootHz, step)
    const bassFreq = rootHz / 2
    const t0 = audioCtx.currentTime + 0.02
    envelopeOsc(audioCtx, dest, 'triangle', freq, freq, t0, beatSeconds * 0.9, 0.32)
    if (stepIndex % 2 === 0) {
      envelopeOsc(audioCtx, dest, 'sine', bassFreq, bassFreq, t0, beatSeconds * 1.8, 0.22)
    }
    stepIndex += 1
    timer = setTimeout(scheduleNext, beatSeconds * 1000)
  }
  scheduleNext()

  musicStop = () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
  }
}

export function stopMusic(): void {
  if (musicStop !== null) {
    musicStop()
    musicStop = null
  }
}
