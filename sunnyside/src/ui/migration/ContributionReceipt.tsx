/**
 * ui/migration/ContributionReceipt.tsx — Contribution Receipt (12-migration §2.4/§3.4/§4.6):
 * квитанция конвертации личного вклада в Town Projects старого города → 🎟 Tickets, показана
 * сразу после завершения переезда («ничего не сгорает», canon D12). Только форматирование
 * уже посчитанного сервером `MigrateFarmRes` — конверсия считается в `net/adapters/local.ts`
 * (или реальным RPC у Supabase), не здесь (AGENTS.md §0.3).
 */
import { useStore } from '@/state'
import type { MigrateFarmRes } from '@/types'
import { CURRENCIES } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'

export interface ContributionReceiptProps {
  targetTownName: string
  result: MigrateFarmRes
  onClose: () => void
}

export function ContributionReceipt({ targetTownName, result, onClose }: ContributionReceiptProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const ticketSymbol = CURRENCIES.tickets.symbol
  const bucksSymbol = CURRENCIES.bucks.symbol

  return (
    <div
      data-testid="contribution-receipt"
      className="mx-auto flex w-full max-w-sm flex-col gap-2 rounded-xl p-4 text-center"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h3 className="text-lg font-black uppercase tracking-wide">
        {ru ? `Добро пожаловать в ${targetTownName}!` : `Welcome to ${targetTownName}!`}
      </h3>
      <p className="text-sm">
        {ru ? 'Твой вклад в Town Projects старого города' : 'Your old town’s Town Projects contribution'}
        {': '}
        <span className="tabular-nums">
          {bucksSymbol}
          {result.convertedBucks}
        </span>
        {' → '}
        <span data-testid="contribution-receipt-tickets" className="font-bold tabular-nums">
          {ticketSymbol} {result.ticketsAwarded}
        </span>
      </p>
      {result.carryoverBucks > 0 && (
        <p data-testid="contribution-receipt-carryover" className="text-xs italic opacity-70">
          {ru
            ? `Остаток ${bucksSymbol}${result.carryoverBucks} не сгорел — доконвертируется при следующем переезде.`
            : `The remaining ${bucksSymbol}${result.carryoverBucks} isn’t lost — it converts at your next move.`}
        </p>
      )}
      <p className="text-xs opacity-70">
        {ru ? 'Соседи по новой улице уже рады знакомству.' : 'Your new street neighbors are already glad to meet you.'}
      </p>
      <button
        type="button"
        data-testid="contribution-receipt-close"
        onClick={onClose}
        className="mt-2 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
        style={{ background: DINER.cherry }}
      >
        {ru ? 'Отлично!' : 'Great!'}
      </button>
    </div>
  )
}
