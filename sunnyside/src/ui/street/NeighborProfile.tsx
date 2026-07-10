/**
 * NeighborProfile.tsx — F8 Neighbor Visit, упрощённый до профильной карточки
 * (`ui_neighbor_profile`, 19-ui-ux §3.2 F8, 11-town §2.4/§3.10). Читает соседа из
 * `town.roster` по `userId`; помочь/подарить — через `SocialSystem` (DI). Полноценная
 * 3D SCENE-версия визита (гулять по чужой ферме) — зона `scene/town` (AGENTS.md §2),
 * здесь — 2D-карточка «кто это и что можно сделать», данные те же.
 *
 * Провала/вреда не существует (canon P3, 11-town §2.4): только помочь/подарить/cheer.
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { ProductKey } from '@/types'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useSocialSystem } from './SocialSystemContext'
import { initials } from './format'

/** Дефолтный подарочный стак — небольшой, T1-дружественный (11-town §3.4 лимит T1–T3). */
const DEFAULT_GIFT_QTY = 1

export interface NeighborProfileProps {
  userId: string
  /** Композиция может дать «Назад к стриту» — навигация вне зоны. */
  onBack?: () => void
}

export function NeighborProfile({ userId, onBack }: NeighborProfileProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const inventory = useStore((s) => s.inventory)
  const social = useSocialSystem()

  const [busy, setBusy] = useState<'help' | 'gift' | 'sit' | null>(null)
  const [giftKey, setGiftKey] = useState<ProductKey>('')

  const neighbor = town?.roster.find((r) => r.userId === userId)
  const giftableStacks = (inventory?.stacks ?? []).filter(
    (st) => st.qty > 0 && (st.itemClass === 'crop' || st.itemClass === 'ingredient' || st.itemClass === 'dish'),
  )

  if (!neighbor) {
    return (
      <section
        data-testid="ui-neighbor-profile"
        className="pointer-events-auto mx-auto w-full max-w-sm rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="neighbor-profile-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Сосед ещё не обустроился.' : 'This neighbor hasn’t settled in yet.'}
        </p>
      </section>
    )
  }

  async function handleHelp() {
    setBusy('help')
    try {
      const res = await social.help(userId, 'water')
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `neighbor_help_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? 'На сегодня хватит — загляни завтра.' : 'That’s enough for today — come back tomorrow.',
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleGift() {
    if (!giftKey) return
    setBusy('gift')
    try {
      const res = await social.gift(userId, giftKey, DEFAULT_GIFT_QTY)
      if (res.ok) setGiftKey('')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Neighbor Sitter (neighbor_sit, 16-retention §4.4/§3.9): «посидеть с фермой соседа» во
   * время его Gone Fishin'. Ростер (`TownSnapshot.roster`) пока не несёт per-соседа флаг
   * отпуска (нет `vacationUntil` в `Street`/roster-записи, только на своей `FarmSnapshot`,
   * `types/town.ts`) — кнопка доступна всегда, сервер сам решает уместность (`forbidden`/
   * `not_found`, тёплый тост уже штатно кладёт `SystemContext.applyMutation`). TODO(town):
   * прокинуть `vacationUntil` в roster, чтобы показывать кнопку только у гостящих в отпуске.
   */
  async function handleSit() {
    setBusy('sit')
    try {
      const res = await social.sit(userId)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `neighbor_sit_err_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Сосед пока не в отпуске.' : 'This neighbor isn’t away right now.',
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      data-testid="ui-neighbor-profile"
      className="pointer-events-auto mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-center gap-3 border-b border-dotted pb-3" style={{ borderColor: DINER.chrome }}>
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: DINER.mustard }}
        >
          {initials(neighbor.displayName)}
        </span>
        <div>
          <h2 data-testid="neighbor-profile-name" className="text-lg font-black">
            {neighbor.displayName}
          </h2>
          <p className="text-xs opacity-60">{ru ? 'Ферма' : 'Farm'} #{neighbor.farmId}</p>
        </div>
        {onBack && (
          <button
            type="button"
            data-testid="neighbor-profile-back"
            onClick={onBack}
            className="ml-auto rounded-full px-2 text-sm opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="neighbor-profile-help-btn"
          disabled={busy === 'help'}
          onClick={() => void handleHelp()}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.cherry }}
        >
          {ru ? 'Полить' : 'Water'}
        </button>
        <button
          type="button"
          data-testid="neighbor-profile-sit-btn"
          disabled={busy === 'sit'}
          onClick={() => void handleSit()}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.teal }}
        >
          {ru ? 'Присмотреть' : 'Sit'}
        </button>
      </div>

      <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {ru ? 'Подарить' : 'Gift'}
        </h3>
        {giftableStacks.length === 0 ? (
          <p className="text-sm italic opacity-60">
            {ru ? 'Нечего подарить — склад пуст.' : 'Nothing to gift — storage is empty.'}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              data-testid="neighbor-profile-gift-pick"
              value={giftKey}
              onChange={(e) => setGiftKey(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-sm"
              style={{ borderColor: DINER.chrome }}
            >
              <option value="">{ru ? 'Выбери…' : 'Pick…'}</option>
              {giftableStacks.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.key} ({st.qty})
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="neighbor-profile-gift-btn"
              disabled={!giftKey || busy === 'gift'}
              onClick={() => void handleGift()}
              className="rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
              style={{ background: DINER.teal }}
            >
              {ru ? 'Отправить' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
