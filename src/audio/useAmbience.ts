import { useEffect, useRef } from 'react'
import { useGameStore } from '../game/store'
import { setMusicEnabled } from './engine'
import { startAmbience, type Ambience } from './ambience'

/**
 * Заводит фон на первом жесте пользователя — раньше браузер не даст —
 * и переключает сцену вслед за фазой игры.
 */
export function useAmbience(enabled: boolean): void {
  const phase = useGameStore((s) => s.phase)
  const musicOn = useGameStore((s) => s.musicOn)
  const ambience = useRef<Ambience | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const onGesture = (): void => {
      // Сцену берём в момент жеста, а не при монтировании: игрок мог зайти
      // на сохранённом седьмом дне.
      void startAmbience(useGameStore.getState().phase).then(
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
    ambience.current?.setScene(phase)
  }, [phase])

  // Движок помнит выбор и до первого жеста: контекста ещё нет, а кнопку уже нажали.
  useEffect(() => setMusicEnabled(musicOn), [musicOn])
}
