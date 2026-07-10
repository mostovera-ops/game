/**
 * ui/migration/TownMergeBanner.tsx — Town Merge Proposal (`ui_merge_proposal`, нейминг-
 * кандидат, 12-migration §3.3): системное предложение слияния угасающего города —
 * «Наш город рассматривает переезд в более оживлённое место — проголосуем?». Голосование —
 * общий `VoteCard`; успешный кворум (в local-симуляции) сразу включает Grand Reopening
 * (`net/adapters/local.ts migrationVote`) — баннер показан этим же экраном (§3.3.4).
 *
 * ВХОД: по спеке (§5) баннер живёт на «главном экране города при активном предложении» —
 * это вкладка `ui/scene/town`/HUD (не зона ui-migration, AGENTS.md §0.6), поэтому здесь
 * смонтирован как вкладка `ui_moving_truck` (см. `MovingVan.tsx`); интеграция в HUD/сцену
 * города — TODO(ui-town-hud).
 */
import { useStore } from '@/state'
import { VoteCard } from './VoteCard'
import { GrandReopeningBanner } from './GrandReopeningBanner'

export function TownMergeBanner() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)

  const proposal = town?.migrations.find((m) => m.kind === 'town_merge')

  return (
    <section data-testid="ui-town-merge-banner" className="flex flex-col gap-3 p-1">
      {town?.grandReopening?.active && <GrandReopeningBanner state={town.grandReopening} />}

      {proposal ? (
        <>
          <h3 className="text-base font-black uppercase tracking-wide">
            {ru
              ? 'Мэрия: наш город рассматривает переезд'
              : 'Town Hall: our town is considering a move'}
          </h3>
          <p className="text-xs opacity-70">
            {ru
              ? 'Дом не исчезает, он переезжает — Grand Reopening ждёт обе стороны.'
              : 'Home doesn’t disappear, it moves — Grand Reopening awaits both sides.'}
          </p>
          <VoteCard proposal={proposal} />
        </>
      ) : (
        !town?.grandReopening?.active && (
          <p data-testid="town-merge-empty" className="py-6 text-center italic opacity-70">
            {ru ? 'Город спокоен — предложений слияния нет.' : 'All quiet — no merge proposals right now.'}
          </p>
        )
      )}
    </section>
  )
}
