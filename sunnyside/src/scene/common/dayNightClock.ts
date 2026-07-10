/**
 * dayNightClock.ts — непрерывный суточный цикл (22-audio-visual §3.6/§4.5): 24 ч 1:1 с
 * реальным временем UTC СЕРВЕРА (не ускоренный игровой таймер, не локальное время игрока —
 * см. §3.6 «локальное время игрока не влияет на визуал мира»). Это ОТДЕЛЬНОЕ измерение от
 * недельной фазы (`../farm/daynight.ts` `phaseTone` — «настроение дня недели»: будни/суббота-
 * ярмарка/воскресенье-ивент). Здесь — «который час на сервере» → доля неон-эмиссии/
 * окна-светятся (§4.5 таблица), с плавными переходами рассвет/закат (1 ч, §3.6).
 *
 * Время — только из `serverNow()` (EpochMs, `clock`-слайс), никогда `Date.now()` напрямую в
 * игровой логике (AGENTS.md §0.4). Этот модуль сам не читает время — принимает готовый epoch
 * (компонент передаёт `serverNow()`), поэтому остаётся чистым и node-тестируемым.
 *
 * ГРАНИЦА: чистые функции, ноль three/react.
 */

/** Фаза суток (22-av §4.5) — не путать с `WeekPhase` (недельный календарь, canon §2.3). */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

/** UTC-час дня как дробное число [0,24) из epoch-мс (`serverNow()`). */
export function hourUTC(epochMs: number): number {
  const d = new Date(epochMs)
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
}

/** Нормализует час в диапазон [0,24) (устойчиво к отрицательным/переполненным значениям). */
function normalizeHour(h: number): number {
  return ((h % 24) + 24) % 24
}

/**
 * Фаза суток по окну UTC (22-av §4.5): Dawn 05–06, Day 06–18, Dusk 18–19, Night 19–05.
 */
export function dayPhaseForHour(h: number): DayPhase {
  const hh = normalizeHour(h)
  if (hh >= 19 || hh < 5) return 'night'
  if (hh < 6) return 'dawn'
  if (hh < 18) return 'day'
  return 'dusk'
}

/**
 * Доля неон-эмиссии/окна-светятся 0..1 (22-av §3.6 «плавная интерполяция… включения
 * неон-эмиссии», §4.5 «Неон/эмиссия»): 0 днём, плавно нарастает весь час заката (18→19),
 * 1 всю ночь, плавно гаснет весь час рассвета (5→6). Переходы длятся ровно 1 ч (гипотеза
 * §3.6), поэтому сама функция уже непрерывна и не нуждается в отдельном твине по часам суток
 * (в отличие от смены недельной фазы, которая дискретна — см. `DayNightRig.tsx`).
 */
export function neonIntensityForHour(h: number): number {
  const hh = normalizeHour(h)
  if (hh >= 6 && hh < 18) return 0
  if (hh >= 18 && hh < 19) return hh - 18
  if (hh >= 5 && hh < 6) return 1 - (hh - 5)
  return 1
}
