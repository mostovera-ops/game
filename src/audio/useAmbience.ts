import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getClock, isNight, subscribeClock } from '../game/dayClock'
import { useGameStore, type Phase } from '../game/store'
import { setBackgroundEnabled } from './engine'
import { startAmbience, type Ambience, type Scene } from './ambience'

/**
 * День торговли не темнеет — у ярмарки свой таймер, и DayNight держит её
 * в полудне. Поэтому фаза важнее часов.
 */
const sceneOf = (phase: Phase, night: boolean): Scene =>
  phase === 'truck' ? 'truck' : night ? 'night' : 'farm'

/** Часы тикают каждый кадр, но снимок булев — перерисовка только на закате. */
const nightNow = (): boolean => isNight(getClock())

/**
 * Заводит фон на первом жесте пользователя — раньше браузер не даст —
 * и переключает сцену вслед за фазой игры и часами суток.
 */
export function useAmbience(enabled: boolean): void {
  const phase = useGameStore((s) => s.phase)
  const musicOn = useGameStore((s) => s.musicOn)
  const night = useSyncExternalStore(subscribeClock, nightNow, nightNow)
  const ambience = useRef<Ambience | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const onGesture = (): void => {
      // Сцену берём в момент жеста, а не при монтировании: игрок мог зайти
      // на сохранённом седьмом дне, да и часы к тому времени уже ушли.
      void startAmbience(sceneOf(useGameStore.getState().phase, nightNow())).then(
        (a) => {
          if (cancelled) a.stop()
          else ambience.current = a
        },
        (err: unknown) => {
          console.error('ambience: не удалось запустить', err)
        },
      )
    }

    window.addEventListener('pointerdown', onGesture, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', onGesture)
      ambience.current?.stop()
      ambience.current = null
    }
  }, [enabled])

  useEffect(() => {
    ambience.current?.setScene(sceneOf(phase, night))
  }, [phase, night])

  // Движок помнит выбор и до первого жеста: контекста ещё нет, а кнопку уже нажали.
  useEffect(() => setBackgroundEnabled(musicOn), [musicOn])
}
