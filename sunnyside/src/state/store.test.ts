/**
 * store.test.ts — смоук-юнит стора (пример; node без браузера). Слайсы — чистые редьюсеры.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'

describe('useStore — базовые слайсы', () => {
  beforeEach(() => {
    useStore.getState().goto('farm')
    useStore.getState().setOnline(true)
  })

  it('дефолтная сцена — farm', () => {
    expect(useStore.getState().scene.active).toBe('farm')
  })

  it('goto меняет активную сцену', () => {
    useStore.getState().goto('fair')
    expect(useStore.getState().scene.active).toBe('fair')
  })

  it('serverNow = Date.now + offset', () => {
    useStore.getState().setServerOffset(10_000)
    const now = useStore.getState().serverNow()
    expect(now).toBeGreaterThan(Date.now() + 9_000)
    expect(useStore.getState().clock.synced).toBe(true)
  })

  it('econ pendingDelta накапливается и очищается', () => {
    useStore.getState().addPendingDelta('bucks', 50)
    useStore.getState().addPendingDelta('bucks', 25)
    expect(useStore.getState().econ.pendingDelta.bucks).toBe(75)
    useStore.getState().clearPendingDelta('bucks')
    expect(useStore.getState().econ.pendingDelta.bucks).toBeUndefined()
  })

  it('тосты пушатся и снимаются', () => {
    useStore.getState().pushToast({ id: 't1', kind: 'info', message: 'hi', createdAt: 0, ttlMs: 3000 })
    expect(useStore.getState().ui.toasts).toHaveLength(1)
    useStore.getState().dismissToast('t1')
    expect(useStore.getState().ui.toasts).toHaveLength(0)
  })

  // audio-wiring (22-av §5): три независимых слайдера громкости.
  it('setVolume меняет только указанную шину, остальные не трогает', () => {
    useStore.getState().setVolume('sfx', 0.5)
    expect(useStore.getState().ui.volume.sfx).toBe(0.5)
    expect(useStore.getState().ui.volume.music).toBe(0.6)
    expect(useStore.getState().ui.volume.ambient).toBe(0.35)
  })

  it('setVolume клампит вне [0,1]', () => {
    useStore.getState().setVolume('music', 1.4)
    expect(useStore.getState().ui.volume.music).toBe(1)
    useStore.getState().setVolume('music', -0.2)
    expect(useStore.getState().ui.volume.music).toBe(0)
  })

  it('setSoundSettingsOpen переключает панель настроек звука', () => {
    useStore.getState().setSoundSettingsOpen(true)
    expect(useStore.getState().ui.soundSettingsOpen).toBe(true)
    useStore.getState().setSoundSettingsOpen(false)
    expect(useStore.getState().ui.soundSettingsOpen).toBe(false)
  })
})
