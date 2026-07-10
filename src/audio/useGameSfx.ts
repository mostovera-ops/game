import { useEffect } from 'react'
import { useGameStore, type NoticeKind } from '../game/store'
import { playSfx } from './engine'
import { SFX } from './ambience'

/** Пики файлов: cash-register 0.65, dish-missed 0.137 — отсюда разные усиления. */
// time-up сюда не входит: это конец дня, а не потерянное блюдо.
const ON_NOTICE: Partial<Record<NoticeKind, { url: string; gain: number }>> = {
  served: { url: SFX.cashRegister, gain: 0.46 },
  // Заказ упущен: клиент не дождался или игрок сам его пропустил.
  'customer-left': { url: SFX.dishMissed, gain: 1.6 },
  skipped: { url: SFX.dishMissed, gain: 1.6 },
}

/**
 * Звуки дня торговли. Слушаем notices, а не оборачиваем экшены: событие
 * «продал» рождается в сторе, а стору про звук знать незачем.
 */
export function useGameSfx(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    // Стартуем с текущего максимума, а не с нуля: тосты, уже висящие на экране
    // к моменту подписки, звучать не должны.
    let lastId = Math.max(0, ...useGameStore.getState().notices.map((n) => n.id))

    return useGameStore.subscribe((state) => {
      for (const notice of state.notices) {
        if (notice.id <= lastId) continue
        lastId = notice.id
        const sound = ON_NOTICE[notice.kind]
        if (sound) playSfx(sound.url, { gain: sound.gain })
      }
    })
  }, [enabled])
}
