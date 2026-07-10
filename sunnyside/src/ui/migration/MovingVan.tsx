/**
 * ui/migration/MovingVan.tsx — Moving Van (`ui_moving_truck`, canon, 12-migration §3.1):
 * главный экран переездов. Хостит все три уровня как вкладки одного модального каркаса
 * (Town Browser/Street Caravan/Town Merge — только Moving Van сам имеет закреплённый
 * canon-ключ, остальные — нейминг-кандидаты §5, отдельных `ui_*` под них не заводим,
 * AGENTS.md §0.7).
 *
 * Кулдаун (§3.1.2) — `TownSnapshot.movingVan.cooldownUntil` (серверная истина/local-
 * симуляция), сравнение с `serverNow()` (21-client §3.6) — никогда `Date.now()` напрямую.
 */
import { useState } from 'react'
import { useStore } from '@/state'
import type { MigrateFarmRes } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { formatCooldown } from './format'
import { TownBrowser } from './TownBrowser'
import { CaravanVote } from './CaravanVote'
import { TownMergeBanner } from './TownMergeBanner'
import { ContributionReceipt } from './ContributionReceipt'

type Tab = 'home' | 'browser' | 'caravan' | 'city'

const TABS: { key: Tab; ru: string; en: string }[] = [
  { key: 'home', ru: 'Фургон', en: 'Van' },
  { key: 'browser', ru: 'Найти город', en: 'Find a town' },
  { key: 'caravan', ru: 'Караван стрита', en: 'Street caravan' },
  { key: 'city', ru: 'Город', en: 'Town' },
]

export function MovingVan() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const serverNow = useStore((s) => s.serverNow)

  const [tab, setTab] = useState<Tab>('home')
  const [receipt, setReceipt] = useState<{ townName: string; res: MigrateFarmRes } | null>(null)

  const cooldownUntil = town?.movingVan.cooldownUntil ?? 0
  const remaining = cooldownUntil - serverNow()
  const ready = remaining <= 0

  if (receipt) {
    return (
      <ContributionReceipt
        targetTownName={receipt.townName}
        result={receipt.res}
        onClose={() => {
          setReceipt(null)
          setTab('home')
        }}
      />
    )
  }

  return (
    <section data-testid="ui-moving-van" className="flex flex-col gap-3 p-1">
      <nav data-testid="moving-van-tabs" className="flex flex-wrap gap-1.5 border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`moving-van-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: tab === t.key ? DINER.cherry : DINER.chrome,
              color: tab === t.key ? '#fff' : DINER.board,
            }}
          >
            {ru ? t.ru : t.en}
          </button>
        ))}
      </nav>

      {tab === 'home' && (
        <div
          data-testid="moving-van-home"
          className="flex flex-col items-center gap-3 rounded-xl p-4 text-center"
          style={{ background: DINER.card, boxShadow: PRINT_SHADOW }}
        >
          <p className="text-sm">
            {ru
              ? 'Переезжай, куда зовёт душа — прогресс едет с тобой (canon D12).'
              : 'Move wherever you like — your progress comes with you (canon D12).'}
          </p>
          <p data-testid="moving-van-cooldown" className="text-lg font-black tabular-nums">
            {ready
              ? ru
                ? 'Грузовик снова готов к переезду!'
                : 'The truck is ready to move again!'
              : `${ru ? 'Отдыхает ещё' : 'Resting for'} ${formatCooldown(remaining, ru)}`}
          </p>
          <button
            type="button"
            data-testid="moving-van-cta-browse"
            onClick={() => setTab('browser')}
            className="rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
            style={{ background: DINER.cherry }}
          >
            {ru ? 'Найти город' : 'Find a town'}
          </button>
        </div>
      )}

      {tab === 'browser' && <TownBrowser onMoved={(townName, res) => setReceipt({ townName, res })} />}
      {tab === 'caravan' && <CaravanVote />}
      {tab === 'city' && <TownMergeBanner />}
    </section>
  )
}
