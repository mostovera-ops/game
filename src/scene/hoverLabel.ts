/**
 * На что сейчас навёл курсор в сцене — подпись для подсказки в HUD.
 *
 * Тот же приём, что и orderHover: сцена — это three, подсказка — это DOM, и
 * мостом между ними служит крошечный внешний стор. Поле одно, меняется по
 * pointermove, тащить ради него zustand незачем.
 *
 * Ключ (`key`) — кто именно под курсором. Гасить подпись имеет право только
 * тот, кто её поставил: курсор, ушедший с ёлки на соседнюю, не должен погасить
 * подпись новой ёлки из-за того, что pointerout старой прилетел позже.
 */
export interface HoverLabel {
  key: string
  title: string
  /** Строки помельче под заголовком: стадия роста, полив и прочее. */
  lines?: string[]
  /** Экранные координаты курсора — подсказка встаёт рядом. */
  x: number
  y: number
}

let hovered: HoverLabel | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function setHoverLabel(next: HoverLabel): void {
  hovered = next
  emit()
}

/** Снять подпись, если она принадлежит именно этому объекту. */
export function clearHoverLabel(key: string): void {
  if (hovered?.key !== key) return
  hovered = null
  emit()
}

/** Погасить подпись, кем бы она ни была поставлена: курсор ушёл на землю. */
export function clearAllHoverLabels(): void {
  if (!hovered) return
  hovered = null
  emit()
}

export function subscribeHoverLabel(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHoverLabel(): HoverLabel | null {
  return hovered
}
