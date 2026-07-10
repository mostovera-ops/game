/**
 * RegularsClub.tsx — Блокнот завсегдатая (`ui_regulars_club`, 16-retention.md §3.3/§4.2/§4.3,
 * `mech_regular_streak`). Штампы по дням стрика, статус (active/frozen/insured/broken),
 * бонус к выручке прилавка (§4.2), страховка за 🎟 (§4.3).
 *
 * Источник истины — `progression.streak` (серверный, обновляется `hydrateAll` после
 * `applyMutation`, AGENTS.md §0.3) — компонент НЕ считает бонус/цену сам, только читает
 * прогрессию + чистые формулы `engine/retention` (`streakBonusPct`/`streakInsurancePriceTickets`,
 * уже готовы) и зовёт `RetentionSystem.streakCheck()`/`streakInsure()` (DI,
 * `ui/social/RetentionSystemContext`, подключён композицией `SystemsProvider`).
 *
 * `streakCheck()` — «отметиться на сегодня»: до этой панели её не звал ни один компонент
 * (см. `FIXPLAN-CODE.md` — `ui_regulars_club` был в TODO профильных ui-агентов). Дёргаем
 * его при каждом открытии панели; идемпотентно — и сервер, и лок-адаптер тикают день не
 * больше раза (`net/adapters/local.ts` `streakCheck`: `if (today > w.streakLastDay)`).
 */
import { useEffect, useState } from 'react'
import { useStore } from '@/state'
import type { StreakState } from '@/types'
import { streakBonusPct, streakInsurancePriceTickets } from '@/engine/retention'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useRetentionSystem } from '../social'

/** Рубежи блокнота (§4.2 — бронза/серебро/золото/легенда), сортированы по возрастанию. */
const MILESTONES = [3, 7, 14, 21, 30] as const

const STATE_LABEL: Record<StreakState, { icon: string; en: string; ru: string }> = {
  active: { icon: '🔥', en: 'Active', ru: 'Активен' },
  frozen: { icon: '🧊', en: 'Frozen (24h grace)', ru: 'Заморожен (24ч форы)' },
  insured: { icon: '🛡️', en: 'Insured', ru: 'Застрахован' },
  broken: { icon: '💤', en: 'Paused — start fresh', ru: 'Пауза — начни заново' },
}

/** Цвет рамки штампа по дню (§4.2 «визуальный статус блокнота»: бронза/серебро/золото/легенда). */
function stampBorderColor(day: number): string {
  if (day >= 30) return DINER.cherry // «Легенда прилавка»
  if (day >= 21) return DINER.mustard // золотая рамка
  if (day >= 14) return DINER.chrome // серебряная рамка
  if (day >= 7) return '#B08D57' // бронзовая рамка
  return DINER.chrome
}

export function RegularsClub() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const activePanel = useStore((s) => s.ui.activePanel)
  const streak = useStore((s) => s.progression?.streak)
  const tickets = useStore((s) => s.econ.wallet.tickets)
  const retention = useRetentionSystem()
  const [busy, setBusy] = useState(false)

  // «Отметиться на сегодня» при каждом открытии панели (см. докстринг файла).
  useEffect(() => {
    if (activePanel === 'ui_regulars_club') void retention.streakCheck()
  }, [activePanel, retention])

  const days = streak?.streakDays ?? 0
  const state: StreakState = streak?.state ?? 'active'
  const bonusPct = streakBonusPct(days)
  const info = STATE_LABEL[state]
  const insurancePrice = streakInsurancePriceTickets(days)
  const canInsure = state === 'frozen' || state === 'broken'
  const nextMilestone = MILESTONES.find((m) => m > days) ?? null
  const stampCount = Math.min(days, 30)

  async function handleInsure() {
    setBusy(true)
    try {
      const res = await retention.streakInsure()
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `streak_insure_err_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Не получилось застраховать стрик — попробуй ещё раз.' : "Couldn't insure the streak — try again.",
          createdAt: Date.now(),
          ttlMs: 5000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-testid="ui-regulars-club" className="pointer-events-auto flex w-full max-w-sm flex-col gap-3">
      <div
        className="rounded-lg p-3 text-center"
        style={{ background: DINER.card, color: DINER.ink, boxShadow: PRINT_SHADOW, border: `2px dashed ${DINER.chrome}` }}
      >
        <p className="text-xs font-bold uppercase tracking-wide opacity-60">
          {ru ? "Клуб завсегдатаев" : "Regulars' Club"}
        </p>
        <p data-testid="regulars-club-days" className="text-3xl font-black" style={{ color: DINER.cherry }}>
          {days}
        </p>
        <p className="text-xs opacity-60">{ru ? 'дней подряд' : 'days in a row'}</p>
        <p className="mt-1 text-sm font-semibold">
          {info.icon} {ru ? info.ru : info.en}
        </p>
        <p className="mt-1 text-xs opacity-70">
          {ru ? 'Бонус к выручке прилавка' : 'Counter revenue bonus'}: +{Math.round(bonusPct * 100)}%
        </p>
        {nextMilestone && (
          <p className="text-xs opacity-60">
            {ru
              ? `До следующего рубежа: ${nextMilestone - days} дн.`
              : `${nextMilestone - days} days to next milestone`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-10 gap-1" data-testid="regulars-club-stamps">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
          const stamped = day <= stampCount
          return (
            <div
              key={day}
              data-testid={`regulars-club-stamp-${day}`}
              className="flex aspect-square items-center justify-center rounded text-[9px] font-bold"
              style={{
                border: `2px solid ${stampBorderColor(day)}`,
                background: stamped ? DINER.card : 'transparent',
                color: stamped ? DINER.ink : DINER.chrome,
                opacity: stamped ? 1 : 0.35,
              }}
            >
              {stamped ? '☕' : day}
            </div>
          )
        })}
      </div>

      {canInsure && (
        <button
          type="button"
          data-testid="regulars-club-insure-btn"
          disabled={busy || tickets < insurancePrice}
          onClick={() => void handleInsure()}
          className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.teal }}
        >
          {ru ? `Застраховать стрик (${insurancePrice} 🎟)` : `Insure streak (${insurancePrice} 🎟)`}
        </button>
      )}

      <p className="text-xs italic opacity-60">
        {ru
          ? 'Пропуск дня не стирает прошлые штампы — блокнот просто ставится на паузу.'
          : "Missing a day doesn't erase past stamps — the notebook just pauses."}
      </p>
    </section>
  )
}
