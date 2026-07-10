import { useEffect } from 'react'
import { startAmbience, type Ambience } from './ambience'

/** Заводит фоновый эмбиент на первом жесте пользователя — раньше браузер не даст. */
export function useAmbience(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let ambience: Ambience | null = null
    let cancelled = false

    const onGesture = (): void => {
      window.removeEventListener('pointerdown', onGesture)
      void startAmbience().then(
        (a) => {
          if (cancelled) a.stop()
          else ambience = a
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
      ambience?.stop()
    }
  }, [enabled])
}
