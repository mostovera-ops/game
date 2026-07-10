/**
 * DailyGoalCard.tsx — мягкая карточка «Цель на сегодня» первых реальных дней D1–D7
 * (ui_daily_goal_card, 18-onboarding §3.5). Подаётся мягко, БЕЗ жёсткого квест-лога и
 * наказаний (§3.5 правила чек-поинтов): цель дня + что раскрывается. Показывается
 * после выпуска (`done`); композиция передаёт номер личного дня.
 */

import type { Locale } from '@/types'
import { DAILY_GOALS, TX, t } from './text'
import { OT, PRINT_SHADOW } from './theme'

export interface DailyGoalCardProps {
  locale: Locale
  /** Личный день игрока 1..7 (§3.5 — счётчик дней активности, не серверный день). */
  day: number
}

export function DailyGoalCard({ locale, day }: DailyGoalCardProps) {
  const goal = DAILY_GOALS.find((g) => g.day === day)
  if (!goal) return null

  return (
    <div
      data-testid="onboarding-daily-goal"
      className="pointer-events-auto w-full max-w-xs rounded-xl p-3"
      style={{
        background: OT.card,
        color: OT.ink,
        border: `2px dashed ${OT.chrome}`,
        boxShadow: PRINT_SHADOW,
      }}
    >
      <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-wide">
        <span style={{ color: OT.mustard }}>
          {t(TX.dayCounter, locale)} {goal.day}
        </span>
      </div>
      <p className="text-sm font-semibold" style={{ color: OT.ink }}>
        {t(goal.goal, locale)}
      </p>
      <p className="mt-1 text-xs" style={{ color: OT.inkSoft }}>
        + {t(goal.reveals, locale)}
      </p>
    </div>
  )
}
