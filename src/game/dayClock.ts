/**
 * Часы суток: 50 секунд день, 10 секунд ночь. Дошли до конца — наступило утро,
 * и день фермы сменился (endDay).
 *
 * Клок живёт вне zustand-стора, хотя это и правило игры. Причина одна: persist
 * пишет localStorage на каждый set(), а часы тикают каждый кадр. Модуль
 * остаётся честным жителем game/: ни three, ни react, ни браузера.
 *
 * Ночь не персистится: вкладка открывается утром.
 */

export const DAY_SECONDS = 50
export const NIGHT_SECONDS = 10
export const CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS

/**
 * Солнце на восходе и закате не лежит на горизонте, а стоит чуть выше: строго
 * горизонтальный directional light не освещает землю вовсе, и ферма чернеет.
 */
const TILT = 0.055 * Math.PI

/** Сколько света остаётся на восходе и закате — стык дня и ночи. */
const HORIZON = 0.3

/** Какая доля дня уходит на разгорание утра (и столько же на угасание вечера). */
const DAY_EDGE = 0.14

/** Какая доля ночи уходит на сумерки (и столько же на рассвет). */
const NIGHT_EDGE = 0.35

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Плавная ступенька 0→1 на отрезке [a, b]. */
function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * Сила солнца, 0…1. На стыках день↔ночь равна HORIZON с обеих сторон, поэтому
 * свет не прыгает ни на закате, ни на утреннем перевале часов через ноль.
 */
export function daylight(clock: number): number {
  if (clock < DAY_SECONDS) {
    const t = clock / DAY_SECONDS
    const edge = smoothstep(0, DAY_EDGE, t) * smoothstep(0, DAY_EDGE, 1 - t)
    return HORIZON + (1 - HORIZON) * edge
  }
  const t = clamp01((clock - DAY_SECONDS) / NIGHT_SECONDS)
  const dark = smoothstep(0, NIGHT_EDGE, t) * smoothstep(0, NIGHT_EDGE, 1 - t)
  return HORIZON * (1 - dark)
}

/**
 * Насколько темно, 0…1. Днём ноль, в полночь единица. По этой величине жуки
 * разгораются, а луна набирает силу.
 */
export function darkness(clock: number): number {
  return clamp01(1 - daylight(clock) / HORIZON)
}

/**
 * Угол солнца: TILT на восходе, π/2 в полдень, π − TILT на закате. Ночь доводит
 * его до π + TILT, то есть под землю. За полный цикл угол проходит круг и
 * возвращается к началу — свет движется непрерывно.
 */
export function sunAngle(clock: number): number {
  if (clock < DAY_SECONDS) return TILT + (Math.PI - 2 * TILT) * (clock / DAY_SECONDS)
  return Math.PI - TILT + 2 * TILT * clamp01((clock - DAY_SECONDS) / NIGHT_SECONDS)
}

/** Доля прожитых суток, 0…1. По ней заполняется кружок дня в HUD. */
export function dayProgress(clock: number): number {
  return clamp01(clock / CYCLE_SECONDS)
}

/** Идёт ли ночь. Отдельно от darkness: та про свет, эта про время. */
export function isNight(clock: number): boolean {
  return clock >= DAY_SECONDS
}

// --- Мутабельные часы -------------------------------------------------------

let clock = 0
const listeners = new Set<() => void>()

export const getClock = (): number => clock

export function subscribeClock(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

function emit(): void {
  for (const fn of listeners) fn()
}

/**
 * Сдвинуть часы на dt. Возвращает true, если сутки кончились: остаток кадра
 * отбрасываем, десятая доля секунды на рассвете не стоит арифметики.
 */
export function advanceClock(dt: number): boolean {
  clock += dt
  const wrapped = clock >= CYCLE_SECONDS
  if (wrapped) clock = 0
  emit()
  return wrapped
}

/** Начать сутки заново: новый день фермы, новая неделя, сброс игры. */
export function resetClock(): void {
  clock = 0
  emit()
}

/** Перевести часы: полдень, ночь. Для DevTools и скриншот-харнеса. */
export function setClock(seconds: number): void {
  clock = Math.max(0, Math.min(seconds, CYCLE_SECONDS))
  emit()
}

// Доступ к часам из DevTools / скриншот-харнеса — как __game у стора.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __clock?: unknown }).__clock = { getClock, setClock, resetClock }
}
