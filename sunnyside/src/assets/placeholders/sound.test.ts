/**
 * sound.test.ts — юниты синтез-стабов звука (audio-wiring, node без браузера — как весь
 * `engine/`/`state/`, 21-client §3.1). Без `window`/`AudioContext` весь модуль обязан быть
 * БЕЗОПАСНОЙ ТИШИНОЙ (docstring `sound.ts` — «без жеста, никогда не бросает»): эти тесты
 * фиксируют именно это регрессионным способом для новых категорий/хелперов audio-wiring
 * (`onAudioUnlocked`, `event_milestone`, `week_phase_change`), не пытаясь мокать Web Audio API.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isAudioUnlocked,
  onAudioUnlocked,
  playSfx,
  setBusVolume,
  getBusVolume,
  unlockAudio,
  attachAutoUnlock,
  playMusicContext,
  startAmbientLoop,
  stopAmbientLoop,
  type SfxCategory,
} from './sound'

const ALL_CATEGORIES: SfxCategory[] = [
  'ui_success',
  'ui_error',
  'farm_action',
  'cooking_ready',
  'diner_cash',
  'sale_mastery',
  'contest_win',
  'animals_generic',
  'fair_crowd',
  'notification_mail',
  'notification_neighbor',
  'notification_jukebox',
  'event_milestone',
  'week_phase_change',
]

describe('sound.ts — тишина без window/жеста (node-окружение)', () => {
  it('isAudioUnlocked — false без window', () => {
    expect(isAudioUnlocked()).toBe(false)
  })

  it('unlockAudio без window — безопасный no-op, не бросает', () => {
    expect(() => unlockAudio()).not.toThrow()
    expect(isAudioUnlocked()).toBe(false)
  })

  it('attachAutoUnlock без window — возвращает no-op detach, не бросает', () => {
    const detach = attachAutoUnlock()
    expect(() => detach()).not.toThrow()
  })

  it.each(ALL_CATEGORIES)('playSfx("%s") не бросает и молчит без разблокировки', (category) => {
    expect(() => playSfx(category)).not.toThrow()
  })

  it('setBusVolume/getBusVolume — no-op без контекста (не бросает, читает 0)', () => {
    expect(() => setBusVolume('music', 0.9)).not.toThrow()
    expect(getBusVolume('music')).toBe(0)
  })

  it('playMusicContext/startAmbientLoop/stopAmbientLoop — не бросают без контекста', () => {
    expect(() => playMusicContext('music_farm_day')).not.toThrow()
    expect(() => startAmbientLoop('ambient_night')).not.toThrow()
    expect(() => stopAmbientLoop()).not.toThrow()
  })

  it('onAudioUnlocked — не звонит немедленно, пока не разблокировано; возвращает отписку', () => {
    const cb = vi.fn()
    const off = onAudioUnlocked(cb)
    expect(cb).not.toHaveBeenCalled()
    expect(() => off()).not.toThrow()
  })
})
