/**
 * FarmVisitPanel.tsx — панель визита на чужую ферму (19-ui-ux F8 «Neighbor Visit»,
 * 11-town §3.10). Чисто DOM-компонент (ноль three/@react-three) — TownScene оборачивает
 * его в `<Html fullscreen>` (drei) при рендере внутри Canvas; здесь он изолирован ради
 * лёгкого vitest+@testing-library/react без WebGL (jsdom не умеет в canvas-контекст).
 *
 * Стиль — «бумажный чек дайнера» (19-ui-ux §1: letterboard/talon-язык, кремовая бумага).
 * Никогда не красный (P3) — предупреждения/лимиты тёплого янтарного тона.
 */

import type { HelpActionType } from '@/types'

export interface VisitFarm {
  farmId: string
  displayName: string
  streetId: string
}

export interface FarmVisitPanelProps {
  farm: VisitFarm
  onClose: () => void
  onHelp: (type: HelpActionType) => void
  onGift: () => void
  /** Остаток дневного лимита помощи (11-town §3.3.2, гипотеза 20/день) — если известен. */
  helpsLeftToday?: number
  helpDisabled?: boolean
  giftDisabled?: boolean
}

export function FarmVisitPanel({
  farm,
  onClose,
  onHelp,
  onGift,
  helpsLeftToday,
  helpDisabled = false,
  giftDisabled = false,
}: FarmVisitPanelProps) {
  return (
    <div
      data-testid="farm-visit-panel"
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-md border-2 border-[#2b2b2e]/10 bg-[#f5ecd6] p-5 text-[#2b2b2e] shadow-xl"
        style={{ fontFamily: 'inherit' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 data-testid="farm-visit-title" className="text-lg font-black tracking-tight">
            Визит: {farm.displayName}
          </h2>
          <button
            data-testid="farm-visit-close"
            aria-label="Закрыть"
            onClick={onClose}
            className="rounded-full px-2 text-lg leading-none text-[#2b2b2e]/60 hover:text-[#2b2b2e]"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-[#2b2b2e]/70">Стрит: {farm.streetId}</p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            data-testid="farm-visit-water"
            disabled={helpDisabled}
            onClick={() => onHelp('water')}
            className="rounded bg-[#4fa79a] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            💧 Полить
          </button>
          <button
            data-testid="farm-visit-cheer"
            disabled={helpDisabled}
            onClick={() => onHelp('cheer')}
            className="rounded bg-[#e0a93e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            🌟 Cheer
          </button>
          <button
            data-testid="farm-visit-gift"
            disabled={giftDisabled}
            onClick={onGift}
            className="col-span-2 rounded bg-[#e2523b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            🎁 Подарить
          </button>
        </div>

        {helpsLeftToday !== undefined && (
          <p className="text-xs text-[#2b2b2e]/60">
            {helpsLeftToday > 0
              ? `Осталось помощей сегодня: ${helpsLeftToday}`
              : 'На сегодня хватит — загляни завтра 🙂'}
          </p>
        )}
      </div>
    </div>
  )
}
