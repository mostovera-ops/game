/**
 * ContestGallery.tsx — Contest Gallery (`ui_contest_gallery`, 09-fair §4.5 таблица —
 * «просмотр заявок 3 конкурсов, голосование, дивизионы, таймер оглашения»).
 *
 * Заявки/конкурсы уже читались из стора серверным снапшотом (`state/fair.ts` ←
 * `getContests()`), но не было экрана, который реально ЗАХОДИТ (`contest_enter`) и
 * ГОЛОСУЕТ (`contest_vote`) через `ContestSystem` — задача «wire contest-screens к
 * серверным contest_*, сейчас локально». `ContestSystem.enter/vote` — тонкие обёртки
 * над `ctx.applyMutation` (`engine/fair/system.ts`, уже собраны в `sys.contest`,
 * `app/backend.ts`) — этот компонент их первый вызывающий.
 *
 * Payload заявки — минимальный (`{itemKey}`) для `ct_pie_week`/`ct_giant_veg` (блюдо/
 * культура из инвентаря); `ct_best_window` — заявка по своей витрине, без предмета
 * (сервер видит её из `fair_stalls`). Скоринг/дивизионы/ленты — серверные (§3.7/§3.8,
 * `engine/fair/contest.ts` — те же формулы, только для ПРЕДПРОСМотра, не источник истины).
 */
import { useState } from 'react'
import { useStore } from '@/state'
import type { Contest, ContestKey, ProductKey } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useContestSystem } from './ContestSystemContext'

const CONTEST_LABEL: Record<ContestKey, { ru: string; en: string }> = {
  ct_pie_week: { ru: 'Пирог недели', en: 'Pie of the Week' },
  ct_giant_veg: { ru: 'Гигантский овощ', en: 'Giant Vegetable' },
  ct_best_window: { ru: 'Лучшая витрина', en: 'Best Window' },
}

const PHASE_LABEL: Record<Contest['phase'], { ru: string; en: string }> = {
  entry: { ru: 'приём заявок', en: 'entries open' },
  voting: { ru: 'голосование', en: 'voting' },
  judged: { ru: 'оглашены итоги', en: 'judged' },
}

/** Стабильная пустая ссылка — см. докстринг `MentorPanel.tsx` (нестабильный `?? {}` в
 *  селекторе `useStore` = «Maximum update depth exceeded», React 18 `useSyncExternalStore`). */
const EMPTY_ITEMS: Record<ProductKey, number> = {}

export function ContestGallery() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const contests = useStore((s) => s.fair.contests)
  const inventoryItems = useStore((s) => s.inventory?.items ?? EMPTY_ITEMS)
  const contest = useContestSystem()

  const [busy, setBusy] = useState<string | null>(null)
  const [votedEntryIds, setVotedEntryIds] = useState<Set<string>>(new Set())
  const [pickedItem, setPickedItem] = useState<Record<string, string>>({})

  const itemKeys = Object.keys(inventoryItems).filter((k) => (inventoryItems[k] ?? 0) > 0)

  async function handleEnter(c: Contest) {
    setBusy(c.id)
    try {
      const itemKey = pickedItem[c.id]
      const payload = c.key === 'ct_best_window' ? {} : { itemKey }
      const res = await contest.enter(c.key, payload)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `contest_enter_err_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Заявку пока не принять — попробуй позже.' : "Can't submit an entry right now — try later.",
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleVote(c: Contest, entryId: string) {
    setBusy(entryId)
    try {
      const res = await contest.vote(c.id, entryId)
      if (res.ok) {
        setVotedEntryIds((prev) => new Set(prev).add(entryId))
      } else {
        // Фикс UI-6: зеркалим тёплый тост `handleEnter` — молчаливый провал голосования
        // (кулдаун/окно закрыто/уже голосовал на сервере) не был виден игроку (канон P3).
        useStore.getState().pushToast({
          id: `contest_vote_err_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Голос пока не засчитать — попробуй позже.' : "Can't count that vote right now — try later.",
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(null)
    }
  }

  if (contests.length === 0) {
    return (
      <section
        data-testid="ui-contest-gallery"
        className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="contest-gallery-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Конкурсы недели ещё готовятся.' : "This week's contests are still being set up."}
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="ui-contest-gallery"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      {contests.map((c) => (
        <div key={c.id} data-testid={`contest-card-${c.key}`} className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wide">{ru ? CONTEST_LABEL[c.key].ru : CONTEST_LABEL[c.key].en}</h3>
            <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: DINER.chrome, color: DINER.board }}>
              {ru ? PHASE_LABEL[c.phase].ru : PHASE_LABEL[c.phase].en}
            </span>
          </header>

          {c.phase === 'entry' && !c.myEntry && (
            <div className="flex items-center gap-2">
              {c.key !== 'ct_best_window' && (
                <select
                  data-testid={`contest-item-pick-${c.key}`}
                  value={pickedItem[c.id] ?? ''}
                  onChange={(e) => setPickedItem((p) => ({ ...p, [c.id]: e.target.value }))}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  style={{ borderColor: DINER.chrome }}
                >
                  <option value="">{ru ? 'Выбери…' : 'Pick…'}</option>
                  {itemKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                data-testid={`contest-enter-btn-${c.key}`}
                disabled={busy === c.id || (c.key !== 'ct_best_window' && !pickedItem[c.id])}
                onClick={() => void handleEnter(c)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: DINER.teal }}
              >
                {ru ? 'Подать заявку' : 'Enter'}
              </button>
            </div>
          )}

          {c.myEntry && c.phase !== 'voting' && (
            <p data-testid={`contest-my-entry-${c.key}`} className="text-xs opacity-70">
              {ru ? 'Заявка подана' : 'Entry submitted'} · {ru ? 'голосов' : 'votes'}: {c.myEntry.votes}
            </p>
          )}

          {c.phase === 'voting' && (
            <ul className="flex flex-col gap-1.5" data-testid={`contest-entries-${c.key}`}>
              {c.entries.map((e) => {
                const mine = e.id === c.myEntry?.id
                const voted = votedEntryIds.has(e.id)
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      {mine ? (ru ? 'Моя заявка' : 'My entry') : e.playerId} · {e.votes} {ru ? 'голосов' : 'votes'}
                    </span>
                    {!mine && (
                      <button
                        type="button"
                        data-testid={`contest-vote-btn-${e.id}`}
                        disabled={busy === e.id || voted}
                        onClick={() => void handleVote(c, e.id)}
                        className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white disabled:opacity-40"
                        style={{ background: DINER.cherry }}
                      >
                        {voted ? (ru ? 'Проголосовано' : 'Voted') : ru ? 'Голосовать' : 'Vote'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {c.phase === 'judged' && c.myEntry?.rank && (
            <p data-testid={`contest-rank-${c.key}`} className="text-xs font-bold" style={{ color: DINER.mustard }}>
              {c.myEntry.blueRibbon ? '🎀 ' : ''}
              {ru ? 'Место' : 'Rank'}: {c.myEntry.rank}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
