/**
 * useHoverCursor.ts — курсор-подсказка (`pointer`) на ховере интерактивного 3D-объекта,
 * с гарантированным сбросом в `auto` при анмаунте (SCN-2, rev-scenes).
 *
 * r3f `removeInteractivity` на анмаунт наведённого объекта тихо убирает запись из
 * внутреннего `hovered`-стейта БЕЗ диспатча `onPointerOut` — если каждый компонент сам
 * пишет `document.body.style.cursor` без cleanup, курсор залипает в `pointer` навсегда
 * (например, грядка/животное/станок/постройка собраны/скрыты прямо под курсором).
 * Единая точка: `set` на over/out + гарантированный `reset` на unmount.
 */

import { useCallback, useEffect } from 'react'

function setCursor(value: string) {
  if (typeof document !== 'undefined') document.body.style.cursor = value
}

export interface HoverCursorHandlers {
  onPointerOver: (e: { stopPropagation: () => void }) => void
  onPointerOut: () => void
}

export function useHoverCursor(): HoverCursorHandlers {
  // Сброс курсора при анмаунте — страхует случай, когда объект размонтирован пока наведён.
  useEffect(() => () => setCursor('auto'), [])

  const onPointerOver = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setCursor('pointer')
  }, [])

  const onPointerOut = useCallback(() => setCursor('auto'), [])

  return { onPointerOver, onPointerOut }
}
