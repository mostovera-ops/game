/**
 * Modal.tsx — единый модальный каркас для ВСЕХ оверлеев (19-ui-ux §3.0 OVERLAY/SHEET/MODAL,
 * §4.2 правило навигации #1/#2). Один компонент, один источник истины (`ui.activePanel`,
 * `openPanel`) — ui-агенты других зон оборачивают СВОЙ контент в `<Modal panelKey="ui_xxx">`,
 * получая бесплатно: диммер-подложку 40%, letterboard-заголовок (kicker), крестик-закрытие,
 * Escape, клик по подложке, перехват аппаратной/браузерной кнопки «Назад» (не выходит из игры —
 * закрывает верхний оверлей, правило #1).
 *
 * Глубина стека ≤ 2 (правило #2) — это дисциплина вызывающего кода (открывать не более
 * одной вложенной Modal одновременно), сам каркас не считает вложенность за агентов.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { useStore } from '@/state'
import type { UiScreenKey } from '@/types'
import { useSound } from '@/ui/useSound'

export interface ModalProps {
  /** Ключ панели (canon `ui_*`/`(нов.)`) — модалка видима, когда `ui.activePanel === panelKey`. */
  panelKey: UiScreenKey
  /** Заголовок в стиле letterboard-kicker. */
  title: string
  children: ReactNode
  /**
   * SHEET (снизу, мобиле-стиль) vs OVERLAY (центр) — 19-ui-ux §3.0. По умолчанию overlay.
   * FULLSCREEN — полноэкранный оверлей без диммера/карточки-рамки (мини-геймплей вроде
   * `ui_shift`: контент сам рисует фон/раскладку) — крестик-закрытие и общий z-порядок
   * сохраняются, только чуть иначе расположен крестик (верхний правый угол поверх контента).
   */
  variant?: 'overlay' | 'sheet' | 'fullscreen'
}

export function Modal({ panelKey, title, children, variant = 'overlay' }: ModalProps) {
  const active = useStore((s) => s.ui.activePanel === panelKey)
  const openPanel = useStore((s) => s.openPanel)
  const pushedHistory = useRef(false)
  const sound = useSound()

  // audio-wiring: единая точка «клик открыл панель» — Modal хостит ВСЕ canon-панели
  // (`app/PanelHost.tsx`), так что один SFX здесь покрывает «клики UI» без правки
  // полусотни кнопок (22-av §4.7 UI, AGENTS.md «не размазывай по 50 файлам»).
  useEffect(() => {
    if (active) sound.play('ui_click')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, panelKey])

  // Правило навигации #1: браузерная/аппаратная «Назад» закрывает верхний оверлей.
  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.history) return
    window.history.pushState({ sunnysideModal: panelKey }, '')
    pushedHistory.current = true
    const onPopState = () => openPanel(null)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (pushedHistory.current) {
        pushedHistory.current = false
        // Если модалка закрылась НЕ через «Назад» (крестик/подложка), убираем наш
        // history-entry, чтобы стек истории не рос при каждом открытии панели.
        if (window.history.state?.sunnysideModal === panelKey) window.history.back()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, panelKey])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, openPanel])

  if (!active) return null

  if (variant === 'fullscreen') {
    // `absolute` (не `fixed`): fullscreen-панели могут монтироваться внутри drei <Html> поверх
    // канваса (напр. `ui_shift` в scene/fair) — контейнер <Html> имеет инлайновый CSS `transform`,
    // который создаёт containing block для `position: fixed`-потомков (спека CSS), из-за чего
    // `fixed inset-0` считал бы отступы от чужого маленького бокса, а не от вьюпорта, и элемент
    // становился «hidden» для Playwright. `absolute inset-0` внутри полноэкранного `<Html
    // fullscreen>` покрывает весь вьюпорт корректно (тот же приём, что раньше был у ShiftScreen).
    return (
      <div
        data-testid={`modal-${panelKey}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-0 z-50 pointer-events-auto"
      >
        <button
          type="button"
          data-testid={`modal-close-${panelKey}`}
          aria-label="Close"
          onClick={() => openPanel(null)}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2 py-1 text-base leading-none text-white opacity-80 hover:opacity-100"
        >
          ✕
        </button>
        {children}
      </div>
    )
  }

  const sheet = variant === 'sheet'

  return (
    <div
      data-testid={`modal-${panelKey}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={() => openPanel(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'hud-receipt pointer-events-auto w-full max-w-lg p-4 ' +
          (sheet ? 'rounded-t-2xl' : 'm-4 rounded-[var(--radius-diner)]')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-kicker mb-3 flex items-center justify-between pb-2 text-sm">
          <span>{title}</span>
          <button
            type="button"
            data-testid={`modal-close-${panelKey}`}
            aria-label="Close"
            onClick={() => openPanel(null)}
            className="rounded-full px-2 text-base leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
