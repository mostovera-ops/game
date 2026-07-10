/**
 * Что герой говорит прямо сейчас. Реплику ставит клик по пропсу, снимает таймер.
 *
 * Внешний стор на useSyncExternalStore, а не zustand: единственное поле,
 * меняется раз в несколько секунд, и тащить сюда ещё одну зависимость незачем.
 *
 * Отдельный модуль по той же причине, что heroTarget и heroState: экспорт
 * не-компонента из файла с компонентом ломает Fast Refresh.
 */

/** Сколько облачко висит над героем. */
export const SPEECH_MS = 3200

let phrase: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Показать реплику. Повторный клик по тому же объекту продлевает её. */
export function say(text: string): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    phrase = null
    emit()
  }, SPEECH_MS)
  if (phrase === text) return // тот же текст: продлили таймер, перерисовка не нужна
  phrase = text
  emit()
}

export function subscribeSpeech(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSpeech(): string | null {
  return phrase
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __speech?: unknown }).__speech = getSpeech
}
