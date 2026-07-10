/**
 * Положение курсора в NDC канваса, снятое с окна, а не с канваса.
 *
 * r3f кладёт курсор в state.pointer, но слушает события самого канваса: стоит
 * открыть лавку или инвентарь — модалка перехватывает pointermove, и герой
 * перестаёт следить за курсором, будто он замер. Слушаем окно: события до него
 * доходят всегда, поверх какого бы DOM ни ездила мышь.
 *
 * Прямоугольник канваса кешируем и обновляем на resize — читать его каждый
 * кадр значит просить у браузера пересчёт лейаута шестьдесят раз в секунду.
 */
import * as THREE from 'three'

const ndc = new THREE.Vector2()
let rect: DOMRect | null = null

/** Начать слушать курсор. Возвращает отписку. */
export function trackPointer(canvas: HTMLCanvasElement): () => void {
  const measure = () => {
    rect = canvas.getBoundingClientRect()
  }
  const move = (e: PointerEvent) => {
    if (!rect) measure()
    if (!rect || !rect.width || !rect.height) return
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    )
  }

  measure()
  window.addEventListener('pointermove', move)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  return () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('resize', measure)
    window.removeEventListener('scroll', measure, true)
  }
}

/** Курсор в NDC. Общий вектор — не мутировать снаружи. */
export function pointerNDC(): THREE.Vector2 {
  return ndc
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __pointer?: unknown }).__pointer = { ndc }
}
