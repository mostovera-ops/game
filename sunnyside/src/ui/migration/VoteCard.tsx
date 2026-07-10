/**
 * ui/migration/VoteCard.tsx — карточка голосования, общая для Caravan Vote (§3.2.1) и
 * Town Merge Proposal (§3.3.3): тэлли/кворум/статус/кнопки «за»/«против». Внутренний
 * компонент зоны ui-migration (не в барреле) — переиспользуется `CaravanVote.tsx` и
 * `TownMergeBanner.tsx`, которые сами решают заголовок/цель/условие показа.
 */
import { useState } from 'react'
import { useStore } from '@/state'
import type { MigrationProposal } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useTownSystem } from './TownSystemContext'
import { migrationStatus, quorumProgressPct, formatVotingRemaining } from './format'

export function VoteCard({ proposal, targetTownName }: { proposal: MigrationProposal; targetTownName?: string }) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const serverNow = useStore((s) => s.serverNow)
  const townSystem = useTownSystem()
  const [busy, setBusy] = useState(false)

  const now = serverNow()
  const status = migrationStatus(proposal, now)
  const pct = quorumProgressPct(proposal.tally.yes, proposal.tally.quorum)
  const remaining = proposal.votingWindow.closesAt - now

  async function castVote(vote: 'yes' | 'no') {
    setBusy(true)
    try {
      await townSystem.voteMigration(proposal.id, vote)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid={`vote-card-${proposal.id}`}
      className="flex flex-col gap-2 rounded-lg border border-dashed p-3"
      style={{ borderColor: DINER.chrome, boxShadow: status === 'open' ? undefined : PRINT_SHADOW }}
    >
      {targetTownName && (
        <p className="text-sm font-bold">
          {ru ? `Цель: ${targetTownName}` : `Target: ${targetTownName}`}
        </p>
      )}
      <div className="h-2 w-full overflow-hidden rounded" style={{ background: DINER.chrome }}>
        <div
          data-testid={`vote-card-bar-${proposal.id}`}
          className="h-full"
          style={{ width: `${pct}%`, background: status === 'failed' ? DINER.cherry : DINER.teal }}
        />
      </div>
      <p className="text-xs tabular-nums opacity-80">
        {ru ? 'За' : 'Yes'} {proposal.tally.yes} / {proposal.tally.quorum} · {ru ? 'Против' : 'No'}{' '}
        {proposal.tally.no}
      </p>

      {status === 'open' && (
        <>
          <p data-testid={`vote-card-remaining-${proposal.id}`} className="text-xs opacity-70">
            {ru ? 'Окно голосования' : 'Voting window'}: {formatVotingRemaining(remaining, ru)}
          </p>
          {proposal.myVote ? (
            <p data-testid={`vote-card-myvote-${proposal.id}`} className="text-xs italic opacity-70">
              {ru ? `Твой голос: ${proposal.myVote === 'yes' ? 'за' : 'против'}` : `Your vote: ${proposal.myVote}`}
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid={`vote-card-yes-${proposal.id}`}
                disabled={busy}
                onClick={() => void castVote('yes')}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: DINER.teal }}
              >
                {ru ? 'За' : 'Yes'}
              </button>
              <button
                type="button"
                data-testid={`vote-card-no-${proposal.id}`}
                disabled={busy}
                onClick={() => void castVote('no')}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: DINER.chrome, color: DINER.board }}
              >
                {ru ? 'Против' : 'No'}
              </button>
            </div>
          )}
        </>
      )}
      {status === 'passed' && (
        <p data-testid={`vote-card-status-${proposal.id}`} className="text-xs font-bold" style={{ color: DINER.teal }}>
          {ru ? '✓ Кворум набран — переезд состоится' : '✓ Quorum reached — the move is on'}
        </p>
      )}
      {status === 'failed' && (
        <p data-testid={`vote-card-status-${proposal.id}`} className="text-xs italic opacity-70">
          {ru ? 'В этот раз не набрали большинства — попробуем снова позже' : 'Didn’t reach quorum this time — try again later'}
        </p>
      )}
    </div>
  )
}
