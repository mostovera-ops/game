/**
 * StreetPanel.tsx — W2 Street View, упрощённая до панели (`ui_street_panel`,
 * 19-ui-ux §3.6, 11-town §3.2/§3.3/§3.6). Список жителей стрита, дневные лимиты
 * взаимопомощи (11-town §4.1 — справочные числа спеки, НЕ клиентский счётчик факта
 * использования: остаток лимита знает только сервер, AGENTS.md §0.3), вымпел стрита.
 *
 * ГРАНИЦА: читает `town`/`session`/`event` (серверная истина/кэш). Мутация помощи —
 * `SocialSystem.help` (DI, `SocialSystemContext.tsx`) — сервер сам решает, исчерпан
 * ли дневной лимит (`rate_limited`/`cap_reached`, RpcErrorCode), здесь только кнопка.
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { HelpActionType } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useSocialSystem } from './SocialSystemContext'
import { initials } from './format'

const HELP_ACTIONS: readonly HelpActionType[] = ['water', 'feed', 'cheer']
const HELP_LABEL: Record<HelpActionType, { en: string; ru: string }> = {
  water: { en: 'Water', ru: 'Полить' },
  feed: { en: 'Speed-up', ru: 'Ускорить' },
  cheer: { en: 'Cheer', ru: 'Похвалить' },
  sit: { en: 'Sit', ru: 'Присмотреть' },
}

export interface StreetPanelProps {
  /** Композиция может открыть профиль соседа (F8) по клику — навигация вне зоны. */
  onSelectNeighbor?: (userId: string) => void
}

export function StreetPanel({ onSelectNeighbor }: StreetPanelProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const identity = useStore((s) => s.session.identity)
  const streetPennant = useStore((s) => s.event?.streetPennant ?? false)
  const social = useSocialSystem()

  const [busyKey, setBusyKey] = useState<string | null>(null)

  if (!town) {
    return (
      <section
        data-testid="ui-street-panel"
        className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="street-panel-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Стрит формируется — скоро подъедут соседи.' : 'The street is filling up — neighbors on the way.'}
        </p>
      </section>
    )
  }

  const street = town.streets.find((s) => s.id === identity?.streetId) ?? town.streets[0]
  const members = street ? town.roster.filter((r) => r.streetId === street.id) : []

  async function handleHelp(targetId: string, type: HelpActionType) {
    const key = `${targetId}:${type}`
    setBusyKey(key)
    try {
      const res = await social.help(targetId, type)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `help_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `На сегодня хватит — загляни завтра.` : `That’s enough for today — come back tomorrow.`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section
      data-testid="ui-street-panel"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 data-testid="street-panel-name" className="text-lg font-black uppercase tracking-wide">
          {street?.name ?? (ru ? 'Стрит' : 'Street')}
        </h2>
        <span
          data-testid="street-pennant"
          className="rounded px-2 py-0.5 text-xs font-bold text-white"
          style={{ background: streetPennant ? DINER.teal : DINER.chrome, color: streetPennant ? undefined : DINER.board }}
        >
          {streetPennant ? '🚩 ' + (ru ? 'вымпел взят' : 'pennant earned') : ru ? 'без вымпела' : 'no pennant'}
        </span>
      </header>

      <p className="text-xs opacity-70">
        {ru ? 'Дневные лимиты помощи' : 'Daily help limits'}: 20 {ru ? 'отдать' : 'give'} / 20 {ru ? 'принять' : 'receive'}
        {' · '}
        {ru ? '1 действие на цель за цикл' : '1 act per target per cycle'}
      </p>

      {members.length === 0 ? (
        <p data-testid="street-panel-no-members" className="py-4 text-center italic opacity-60">
          {ru ? 'Соседей пока нет.' : 'No neighbors yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="street-member-list">
          {members.map((m) => (
            <li
              key={m.userId}
              data-testid={`street-member-${m.userId}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-2"
              style={{ borderColor: DINER.chrome }}
            >
              <button
                type="button"
                data-testid={`street-member-open-${m.userId}`}
                onClick={() => onSelectNeighbor?.(m.userId)}
                className="flex items-center gap-2 text-left"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: DINER.mustard }}
                >
                  {initials(m.displayName)}
                </span>
                <span className="text-sm font-semibold">{m.displayName}</span>
              </button>
              <div className="flex gap-1">
                {HELP_ACTIONS.map((type) => {
                  const key = `${m.userId}:${type}`
                  return (
                    <button
                      key={type}
                      type="button"
                      data-testid={`street-help-btn-${m.userId}-${type}`}
                      disabled={busyKey === key}
                      onClick={() => void handleHelp(m.userId, type)}
                      className="rounded px-2 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                      style={{ background: DINER.cherry }}
                    >
                      {ru ? HELP_LABEL[type].ru : HELP_LABEL[type].en}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
