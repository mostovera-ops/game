/**
 * soundBridge.test.ts — юниты чистых хелперов звуковой шины (audio-wiring, node без браузера).
 * `initSoundBridge` сама — composition-обвязка (таймеры + подписки на реальный стор), не
 * тестируется юнитом здесь (аналог `notifications.ts`, где тестируется только `diffWorld`,
 * не `subscribeNotifications`); эти две чистые функции — то, что определяет ВЫБОР контекста.
 */

import { describe, it, expect } from 'vitest'
import { desiredMusicContext, isNightUtc } from './soundBridge'

function utcMs(hour: number): number {
  return Date.UTC(2026, 0, 1, hour, 0, 0)
}

describe('isNightUtc — 22-av §4.5 фазы (ночь 19:00–05:00 UTC)', () => {
  it('19:00 UTC — уже ночь', () => {
    expect(isNightUtc(utcMs(19))).toBe(true)
  })
  it('04:59 UTC — ещё ночь', () => {
    expect(isNightUtc(utcMs(4))).toBe(true)
  })
  it('05:00 UTC — уже день (рассвет)', () => {
    expect(isNightUtc(utcMs(5))).toBe(false)
  })
  it('12:00 UTC (полдень) — день', () => {
    expect(isNightUtc(utcMs(12))).toBe(false)
  })
  it('18:59 UTC — ещё день (закат огрублён к дню)', () => {
    expect(isNightUtc(utcMs(18))).toBe(false)
  })
})

describe('desiredMusicContext — 22-av §3.6/§4.8', () => {
  it('финал ивента перебивает всё остальное', () => {
    expect(desiredMusicContext('farm', true, false)).toBe('music_event_final')
    expect(desiredMusicContext('shift', true, true)).toBe('music_event_final')
  })
  it('смена (ui_shift) — рокабилли, независимо от дня/ночи', () => {
    expect(desiredMusicContext('shift', false, false)).toBe('music_shift')
    expect(desiredMusicContext('shift', false, true)).toBe('music_shift')
  })
  it('ярмарка — свой контекст', () => {
    expect(desiredMusicContext('fair', false, false)).toBe('music_fair')
  })
  it('ферма днём — джаз-лаунж; ночью — медленный сакс', () => {
    expect(desiredMusicContext('farm', false, false)).toBe('music_farm_day')
    expect(desiredMusicContext('farm', false, true)).toBe('music_farm_night')
  })
  it('город (town) — тот же контекст, что ферма (нет отдельного town-стема)', () => {
    expect(desiredMusicContext('town', false, false)).toBe('music_farm_day')
    expect(desiredMusicContext('town', false, true)).toBe('music_farm_night')
  })
})
