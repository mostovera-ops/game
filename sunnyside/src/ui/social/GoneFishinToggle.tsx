/**
 * GoneFishinToggle.tsx — Vacation Mode / Gone Fishin' (`ui_vacation_toggle`, нейминг-
 * кандидат 16-retention §4.1 таблица «Меню фермы → Уехать»). Слайдер длительности
 * 3–30 дней → `RetentionSystem.vacationStart` (offset-таймеры, B7) / `vacationEnd`.
 *
 * Локальная валидация (`validateVacationStart`, `engine/retention/vacation.ts`) — ДО
 * сети, чистая функция уже существующего владельца зоны retention; сервер — истина
 * (анти-чит AGENTS.md §0.3). `cooldownEndsAt` пока не читается нигде в сторе (нет поля
 * «когда закончился прошлый отпуск» на `FarmSnapshot`) — TODO(farm): прокинуть, когда
 * появится; до тех пор кулдаун проверяет только сервер (RPC вернёт `conflict`/`forbidden`,
 * тёплый тост уже штатно кладёт `SystemContext.applyMutation`, `app/backend.ts`).
 */
import { useState } from 'react'
import { useStore } from '@/state'
import { VACATION_MAX_DAYS, VACATION_MIN_DAYS } from '@/engine/retention'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useRetentionSystem } from './RetentionSystemContext'

const DEFAULT_DAYS = 7

export function GoneFishinToggle() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const vacationUntil = useStore((s) => s.farm?.vacationUntil)
  const serverNow = useStore((s) => s.serverNow)
  const retention = useRetentionSystem()

  const [days, setDays] = useState(DEFAULT_DAYS)
  const [busy, setBusy] = useState(false)

  const now = serverNow()
  const active = !!vacationUntil && vacationUntil > now

  async function handleStart() {
    setBusy(true)
    try {
      const res = await retention.vacationStart({
        requestedDays: days,
        hasActiveVacation: active,
        now,
      })
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `vacation_start_err_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Не получилось уехать — попробуй ещё раз.' : "Couldn't leave just yet — try again.",
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    setBusy(true)
    try {
      await retention.vacationEnd()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      data-testid="ui-gone-fishin"
      className="pointer-events-auto mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <p className="text-xs italic opacity-70">
        {ru
          ? 'Ферма красиво консервируется: чехлы на грядках, табличка на воротах. Ничего не портится и не тратится впустую.'
          : 'The farm tucks itself in nicely: plot covers, a sign on the gate. Nothing spoils, nothing wasted.'}
      </p>

      {active ? (
        <>
          <p data-testid="gone-fishin-status" className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: DINER.mustard, color: '#fff' }}>
            🎣 {ru ? 'Ты уехал(а) — рыбачишь' : "You're away — gone fishin'"}
          </p>
          <button
            type="button"
            data-testid="gone-fishin-end-btn"
            disabled={busy}
            onClick={() => void handleEnd()}
            className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
            style={{ background: DINER.cherry }}
          >
            {ru ? 'Вернуться на ферму' : 'Come back to the farm'}
          </button>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            {ru ? 'На сколько дней' : 'How many days'}
            <input
              type="range"
              data-testid="gone-fishin-days"
              min={VACATION_MIN_DAYS}
              max={VACATION_MAX_DAYS}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="flex-1"
            />
            <span data-testid="gone-fishin-days-value" className="w-8 text-right font-bold">
              {days}
            </span>
          </label>
          <button
            type="button"
            data-testid="gone-fishin-start-btn"
            disabled={busy}
            onClick={() => void handleStart()}
            className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
            style={{ background: DINER.teal }}
          >
            {ru ? 'Уехать' : 'Go fishin’'}
          </button>
        </>
      )}
    </section>
  )
}
