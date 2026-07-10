/**
 * ui/migration/CaravanVote.tsx — Street Caravan (`ui_caravan_vote`, нейминг-кандидат,
 * 12-migration §3.2): весь Стрит голосует и переезжает целиком в свободную улицу
 * города-приёмника. Инициация доступна любому участнику Стрита (без формального лидера,
 * §3.2.1); дальше — тэлли/статус через общий `VoteCard`.
 *
 * ВХОД: по спеке (§5 UI-точки) Caravan Vote живёт «в чате/доске Стрита» (`11-town.md`,
 * зона ui-street) — эта зона (ui-migration) не редактирует чужой `StreetPanel.tsx`
 * (AGENTS.md §0.6), поэтому компонент смонтирован как вкладка `ui_moving_truck`
 * (см. `MovingVan.tsx`); интеграция кнопки-входа в сам `StreetPanel` — TODO(ui-street).
 */
import { useState } from 'react'
import { useStore } from '@/state'
import { DINER } from '../market/tokens'
import { useTownSystem } from './TownSystemContext'
import { useTownListings } from './useTownListings'
import { VoteCard } from './VoteCard'

export function CaravanVote() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const identity = useStore((s) => s.session.identity)
  const townSystem = useTownSystem()
  const { listings } = useTownListings()

  const [targetTownId, setTargetTownId] = useState('')
  const [busy, setBusy] = useState(false)

  const myStreetId = identity?.streetId ?? town?.streets[0]?.id
  const myStreet = town?.streets.find((s) => s.id === myStreetId)
  const active = town?.migrations.find(
    (m) => m.kind === 'street_caravan' && m.streetId === myStreetId,
  )

  async function propose() {
    if (!myStreetId || !targetTownId) return
    setBusy(true)
    try {
      await townSystem.proposeMigration({ kind: 'street_caravan', targetTown: targetTownId, streetId: myStreetId })
    } finally {
      setBusy(false)
    }
  }

  if (!town || !myStreetId) {
    return (
      <section data-testid="ui-caravan-vote" className="py-6 text-center italic opacity-70">
        {ru ? 'Стрит ещё формируется.' : 'Your street is still forming.'}
      </section>
    )
  }

  return (
    <section data-testid="ui-caravan-vote" className="flex flex-col gap-3 p-1">
      <h3 className="text-base font-black uppercase tracking-wide">
        {ru ? `Караван «${myStreet?.name ?? ''}»` : `Caravan “${myStreet?.name ?? ''}”`}
      </h3>
      <p className="text-xs opacity-70">
        {ru
          ? 'Весь Стрит переезжает одним блоком — никто не расстаётся (canon D12).'
          : 'The whole street moves as one block — nobody is left behind (canon D12).'}
      </p>

      {active ? (
        <VoteCard
          proposal={active}
          targetTownName={listings.find((t) => t.townId === active.targetTownId)?.name}
        />
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
          <label className="text-xs font-bold uppercase tracking-wide opacity-70">
            {ru ? 'Куда переезжаем?' : 'Where to?'}
          </label>
          <select
            data-testid="caravan-target-select"
            value={targetTownId}
            onChange={(e) => setTargetTownId(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          >
            <option value="">{ru ? '— выбери город —' : '— pick a town —'}</option>
            {listings.map((t) => (
              <option key={t.townId} value={t.townId}>
                {t.name} ({t.freeStreets} {ru ? 'своб. улиц' : 'free streets'})
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="caravan-propose-btn"
            disabled={busy || !targetTownId}
            onClick={() => void propose()}
            className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
            style={{ background: DINER.cherry }}
          >
            {ru ? 'Предложить переезд Стрита' : 'Propose street move'}
          </button>
        </div>
      )}
    </section>
  )
}
