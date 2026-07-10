/**
 * Подсказка у курсора для элементов HUD: ячейки тулбара, лейка, рука, портрет,
 * книга рецептов.
 *
 * Рисует её тот же <SceneTooltip>, что и подписи пропсов: игрок не должен
 * гадать, почему у ёлки подпись своя, а у лейки — системный `title` с полусекунды
 * задержкой. Мостом служит тот же внешний стор hoverLabel.
 *
 * Ключ — сам заголовок: он у каждого элемента свой, а курсор, ушедший с одной
 * кнопки на соседнюю, не должен гасить подпись новой.
 */
import { clearHoverLabel, setHoverLabel } from '../scene/hoverLabel'

/** Пропсы для любого DOM-элемента: подпись едет за курсором и гаснет с уходом. */
export function hoverTip(title: string, lines?: string[]) {
  return {
    onPointerMove: (e: React.PointerEvent) =>
      setHoverLabel({ key: title, title, lines, x: e.clientX, y: e.clientY }),
    onPointerLeave: () => clearHoverLabel(title),
  }
}
