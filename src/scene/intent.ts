/**
 * Отложенное действие: «подойти к точке и сделать там дело».
 *
 * Клик по грядке больше не выполняет действие сразу — он ставит намерение и
 * ведёт героя. Действие срабатывает, когда герой входит в REACH (см. Interactions
 * в Farm.tsx). Пока это только слоты, но kind оставлен на вырост: с фудтраком и
 * теплицей будет то же самое.
 *
 * Мутабельный синглтон, а не zustand: намерение читается каждый кадр, и гонять
 * его через React незачем. Отдельный модуль по той же причине, что heroTarget:
 * экспорт не-компонента из файла с компонентом ломает Fast Refresh.
 */
export interface Intent {
  kind: 'slot'
  /** id слота — что именно трогаем. */
  id: string
  /** Мировые координаты цели: по ним меряем, дотянулся ли герой. */
  x: number
  z: number
}

export const intent: { current: Intent | null } = { current: null }

export function setIntent(next: Intent): void {
  intent.current = next
}

/** Снять намерение: игрок передумал (пошёл на WASD, кликнул в землю). */
export function clearIntent(): void {
  intent.current = null
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __intent?: unknown }).__intent = intent
}
