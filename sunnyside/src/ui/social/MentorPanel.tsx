/**
 * MentorPanel.tsx — Менторство новичков (`ui_mentor`, нейминг-кандидат 11-town §9 п.1,
 * see также §3.7 «3.7 Менторство новичков»). Пул менторов → пара ментор/менти → 4 вехи
 * адаптации → награда (таблица §3.7).
 *
 * ПРОБЕЛ БЭКЕНДА (см. докстринг `./mentorStore.ts`): матчинг ментор↔менти пока НЕ имеет
 * серверного RPC (сверено с 20-backend §3.4.1) — сама пара живёт в локальном
 * `useMentorStore` (клиентское намерение, не переживает вход с другого устройства).
 * Прогресс по вехам, наоборот, читается из УЖЕ серверно-истинных срезов стора
 * (`farm.farmLevel`, `town.coopOrders`, `town.potluck`, `fair.stall`) — это честные
 * данные, не выдумка. Награда НЕ начисляется отсюда (золотое правило AGENTS.md §0.3) —
 * только описание того, что вехе полагается по спеке; `markCelebrated` — чисто
 * витринная пометка «видел», не транзакция.
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { Bilingual, CoopOrder, FairLot } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import {
  useMentorStore,
  MENTOR_MILESTONE_KEYS,
  type MentorMilestoneKey,
} from './mentorStore'

const MILESTONE_INFO: Record<
  MentorMilestoneKey,
  { label: Bilingual; menteeReward: Bilingual; mentorReward: Bilingual }
> = {
  first_fair_sale: {
    label: { en: 'First fair sale', ru: 'Первая продажа на ярмарке' },
    menteeReward: { en: '$ boost + decor', ru: '$ буст + декор' },
    mentorReward: { en: '🎟2, Neighbor Points +10', ru: '🎟2, очки соседа +10' },
  },
  first_coop_contribution: {
    label: { en: 'First co-op contribution', ru: 'Первый вклад в кооп-заказ' },
    menteeReward: { en: 'T2 seed set', ru: 'набор семян T2' },
    mentorReward: { en: '🎟2', ru: '🎟2' },
  },
  first_potluck: {
    label: { en: 'First potluck contribution', ru: 'Первый взнос в потлак' },
    menteeReward: { en: 'Recipe card', ru: 'рецепт-карточка' },
    mentorReward: { en: '🎟1', ru: '🎟1' },
  },
  farm_level_5: {
    label: { en: 'Reached farm level 5', ru: 'Достиг уровня фермы 5' },
    menteeReward: { en: 'Grand Opening +1 day', ru: 'Grand Opening +1 день' },
    mentorReward: { en: '🎀 Mentor ribbon + badge', ru: '🎀 «Наставник» + значок' },
  },
}

function pick(b: Bilingual, ru: boolean): string {
  return ru ? b.ru : b.en
}

// Стабильные пустые ссылки для `?? []` в селекторах `useStore` (React 18
// `useSyncExternalStore`/zustand требуют кэшированный snapshot — свежий `[]`
// на каждый вызов селектора = «Maximum update depth exceeded», см. докстринг
// `app/PanelHost.tsx` «нестабильные `?? {}`/`?? []` селекторы»).
const EMPTY_COOP_ORDERS: CoopOrder[] = []
const EMPTY_FAIR_LOTS: FairLot[] = []

export function MentorPanel() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const identity = useStore((s) => s.session.identity)
  const farmLevel = useStore((s) => s.farm?.farmLevel ?? 1)
  const coopOrders = useStore((s) => s.town?.coopOrders ?? EMPTY_COOP_ORDERS)
  const potluckScore = useStore((s) => s.town?.potluck?.myScore ?? 0)
  const stallLots = useStore((s) => s.fair.stall?.lots ?? EMPTY_FAIR_LOTS)

  const poolOptIn = useMentorStore((s) => s.poolOptIn)
  const setPoolOptIn = useMentorStore((s) => s.setPoolOptIn)
  const links = useMentorStore((s) => s.links)
  const addLink = useMentorStore((s) => s.addLink)
  const removeLink = useMentorStore((s) => s.removeLink)
  const celebrated = useMentorStore((s) => s.celebrated)
  const markCelebrated = useMentorStore((s) => s.markCelebrated)

  const [role, setRole] = useState<'mentee' | 'mentor'>('mentee')

  const menteeLink = links.find((l) => l.myRole === 'mentee')
  const mentorLinks = links.filter((l) => l.myRole === 'mentor')

  const milestoneDone: Record<MentorMilestoneKey, boolean> = {
    first_fair_sale: stallLots.some((l) => l.remaining < l.qty),
    first_coop_contribution: coopOrders.some((o) =>
      Object.values(o.myContribution ?? {}).some((qty) => qty > 0),
    ),
    first_potluck: potluckScore > 0,
    farm_level_5: farmLevel >= 5,
  }

  const candidates = (town?.roster ?? []).filter((r) => r.userId !== identity?.userId)

  return (
    <section
      data-testid="ui-mentor-panel"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <p className="text-xs italic opacity-70">
        {ru
          ? 'Old Man Whittaker сводит новичков с опытными фермерами — тёплое вливание, не фарм.'
          : 'Old Man Whittaker pairs newcomers with veteran farmers — a warm welcome, not a grind.'}
      </p>

      <label className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-sm" style={{ borderColor: DINER.chrome }}>
        <input
          type="checkbox"
          data-testid="mentor-pool-optin"
          checked={poolOptIn}
          onChange={(e) => setPoolOptIn(e.target.checked)}
        />
        {ru ? 'Записаться в пул менторов (ферма ур. ≥8, ≥2 недели на сервере)' : 'Join the Mentor Pool (farm lvl ≥8, ≥2 weeks on server)'}
      </label>

      {/* ── Менти: моя пара с ментором ── */}
      {menteeLink ? (
        <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
            {ru ? 'Мой ментор' : 'My mentor'}
          </h3>
          <p data-testid="mentor-mentee-partner" className="mb-2 text-sm font-semibold">
            {menteeLink.partnerName}
          </p>
          <ul className="flex flex-col gap-1.5" data-testid="mentor-milestone-list">
            {MENTOR_MILESTONE_KEYS.map((key) => {
              const done = milestoneDone[key]
              const info = MILESTONE_INFO[key]
              return (
                <li
                  key={key}
                  data-testid={`mentor-milestone-${key}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className={done ? 'opacity-100' : 'opacity-60'}>
                    {done ? '✅' : '⬜️'} {pick(info.label, ru)}
                  </span>
                  <span className="opacity-70">{pick(info.menteeReward, ru)}</span>
                  {done && !celebrated.includes(key) && (
                    <button
                      type="button"
                      data-testid={`mentor-milestone-celebrate-${key}`}
                      onClick={() => markCelebrated(key)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ background: DINER.teal }}
                    >
                      {ru ? 'Ура!' : 'Yay!'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {milestoneDone.farm_level_5 && (
            <button
              type="button"
              data-testid="mentor-graduate-btn"
              onClick={() => removeLink(menteeLink.partnerId)}
              className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: DINER.cherry }}
            >
              {ru ? 'Выпуститься' : 'Graduate'}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
          <div className="mb-2 flex gap-2 text-xs">
            <button
              type="button"
              data-testid="mentor-role-mentee"
              onClick={() => setRole('mentee')}
              className="rounded-full px-2 py-1 font-bold uppercase"
              style={{ background: role === 'mentee' ? DINER.mustard : 'transparent', color: role === 'mentee' ? '#fff' : DINER.board }}
            >
              {ru ? 'Найти ментора' : 'Find a mentor'}
            </button>
            <button
              type="button"
              data-testid="mentor-role-mentor"
              onClick={() => setRole('mentor')}
              className="rounded-full px-2 py-1 font-bold uppercase"
              style={{ background: role === 'mentor' ? DINER.mustard : 'transparent', color: role === 'mentor' ? '#fff' : DINER.board }}
            >
              {ru ? 'Взять менти' : 'Take a mentee'}
            </button>
          </div>

          {candidates.length === 0 ? (
            <p data-testid="mentor-candidates-empty" className="py-2 text-center text-sm italic opacity-60">
              {ru ? 'Пока некого предложить — стрит формируется.' : 'No one to suggest yet — the street is filling up.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="mentor-candidate-list">
              {candidates.slice(0, 6).map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span>{c.displayName}</span>
                  <button
                    type="button"
                    data-testid={`mentor-request-${c.userId}`}
                    disabled={role === 'mentor' && mentorLinks.length >= 2}
                    onClick={() =>
                      addLink({
                        partnerId: c.userId,
                        partnerName: c.displayName,
                        myRole: role === 'mentee' ? 'mentee' : 'mentor',
                        since: Date.now(),
                      })
                    }
                    className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                    style={{ background: DINER.teal }}
                  >
                    {role === 'mentee' ? (ru ? 'Пригласить' : 'Invite') : (ru ? 'Взять' : 'Take')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Ментор: мои менти (≤2, §3.7 анти-фарм) ── */}
      {mentorLinks.length > 0 && (
        <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
            {ru ? 'Мои менти' : 'My mentees'} ({mentorLinks.length}/2)
          </h3>
          <ul className="flex flex-col gap-1.5" data-testid="mentor-mentee-list">
            {mentorLinks.map((l) => (
              <li key={l.partnerId} className="flex items-center justify-between gap-2 text-sm">
                <span>{l.partnerName}</span>
                <button
                  type="button"
                  data-testid={`mentor-end-${l.partnerId}`}
                  onClick={() => removeLink(l.partnerId)}
                  className="rounded px-2 py-1 text-xs font-bold uppercase opacity-70 hover:opacity-100"
                >
                  {ru ? 'Завершить' : 'End'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
