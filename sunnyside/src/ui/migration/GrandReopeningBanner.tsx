/**
 * ui/migration/GrandReopeningBanner.tsx — Grand Reopening Banner (`ui_grand_reopening`,
 * нейминг-кандидат, 12-migration §3.3.4/§4.3): 7-дневный совместный буфф после успешного
 * Town Merge — ×2 доход дайнера, +50% гостей на ближайшей ярмарке, бесплатный Cracker-Jack
 * Toy, косметический баннер площади. Презентационный — статус (`active`/`endsAt`) приходит
 * из `TownSnapshot.grandReopening` (серверная истина/local-симуляция), баффы сами по себе
 * применяются экономикой (`14-economy.md`), здесь только витрина.
 */
import { useStore } from '@/state'
import type { GrandReopeningState } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { formatVotingRemaining } from './format'

export function GrandReopeningBanner({ state }: { state: GrandReopeningState }) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const serverNow = useStore((s) => s.serverNow)

  if (!state.active) return null

  const remaining = state.endsAt - serverNow()

  return (
    <div
      data-testid="grand-reopening-banner"
      className="flex flex-col gap-1 rounded-xl p-3 text-center"
      style={{ background: DINER.mustard, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h4 className="text-sm font-black uppercase tracking-wide">
        {ru ? '🎉 Grand Reopening!' : '🎉 Grand Reopening!'}
      </h4>
      <p className="text-xs">
        {ru
          ? '×2 доход дайнера · +50% гостей на ярмарке · бесплатный Cracker-Jack Toy'
          : '×2 diner income · +50% fair guests · free Cracker-Jack Toy'}
      </p>
      <p data-testid="grand-reopening-remaining" className="text-xs font-bold tabular-nums">
        {ru ? 'Осталось' : 'Remaining'}: {formatVotingRemaining(remaining, ru)}
      </p>
    </div>
  )
}
