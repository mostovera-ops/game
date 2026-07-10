/**
 * MiniWeek.tsx — оркестратор сжатой мини-недели (18-onboarding §3.3): по шагам
 * t_day_1..7 крутит {реплики → действие → награда}, ведёт споллайт на цель шага,
 * показывает сжатый таймер и финальную мини-ярмарку (t_day_6). Прогресс шага —
 * в сторе (`useFtueStore.step`), локально — только под-фаза текущего шага.
 *
 * P3/P4: провала нет — таймер не блокирует действие, кнопка действия доступна
 * всегда; по завершении шага мягкая награда и переход к следующему дню.
 */

import { useState } from 'react'
import type { Locale } from '@/types'
import { useFtueStore } from './store'
import { MINI_WEEK_STEPS } from './scenario'
import { DialogueBox } from './DialogueBox'
import { Spotlight } from './Spotlight'
import { StepTimer } from './StepTimer'
import { MiniFair } from './MiniFair'
import { TX, t } from './text'
import { OT, PRINT_SHADOW, DINER_RADIUS } from './theme'

type SubPhase = 'talk' | 'act' | 'reward'

export interface MiniWeekProps {
  locale: Locale
}

export function MiniWeek({ locale }: MiniWeekProps) {
  const step = useFtueStore((s) => s.step)
  const advanceStep = useFtueStore((s) => s.advanceStep)
  const [sub, setSub] = useState<SubPhase>('talk')

  const data = MINI_WEEK_STEPS[step]
  if (!data) return null

  function toReward() {
    setSub('reward')
  }

  function nextDay() {
    setSub('talk')
    advanceStep()
  }

  return (
    <>
      {/* Споллайт цели — под слоем диалога, не блокирует экран (§5). */}
      {sub !== 'reward' && data.target && <Spotlight target={data.target} />}

      <div
        data-testid="onboarding-miniweek"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4"
      >
        <div className="pointer-events-auto w-full max-w-md">
          {/* Плашка «День N из 7 · Title» */}
          <div
            className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
            style={{ background: OT.board, color: OT.boardInk, boxShadow: PRINT_SHADOW }}
          >
            <span data-testid="onboarding-daycounter">
              {t(TX.dayCounter, locale)} {data.day} {t(TX.of, locale)} {MINI_WEEK_STEPS.length}
            </span>
            <span style={{ color: OT.mustard }}>· {t(data.title, locale)}</span>
          </div>

          {sub === 'talk' && (
            <DialogueBox lines={data.lines} locale={locale} onDone={() => setSub('act')} />
          )}

          {sub === 'act' && (
            <div
              data-testid="onboarding-act"
              style={{
                background: OT.card,
                color: OT.ink,
                borderRadius: DINER_RADIUS,
                boxShadow: PRINT_SHADOW,
                border: `2px solid ${OT.chrome}`,
                padding: 16,
              }}
            >
              {data.miniFair && <MiniFair locale={locale} />}

              <div className="mb-1 text-xs font-black uppercase tracking-wide" style={{ color: OT.mustard }}>
                {t(TX.learnKicker, locale)}
              </div>
              <p className="mb-3 text-sm" style={{ color: OT.ink }}>
                {t(data.learn, locale)}
              </p>

              {data.timerSec != null && (
                <div className="mb-3">
                  <StepTimer seconds={data.timerSec} label={t(data.title, locale)} />
                </div>
              )}

              <button
                type="button"
                data-testid="onboarding-action"
                onClick={toReward}
                className="w-full rounded-full py-2.5 text-sm font-black uppercase tracking-wide"
                style={{ background: OT.cherry, color: OT.card, boxShadow: PRINT_SHADOW }}
              >
                {t(data.action, locale)}
              </button>
            </div>
          )}

          {sub === 'reward' && (
            <div
              data-testid="onboarding-reward"
              style={{
                background: OT.card,
                color: OT.ink,
                borderRadius: DINER_RADIUS,
                boxShadow: PRINT_SHADOW,
                border: `2px solid ${OT.chrome}`,
                padding: 16,
              }}
            >
              {data.miniFair && <MiniFair locale={locale} ribbonAwarded />}

              <div className="mb-1 text-xs font-black uppercase tracking-wide" style={{ color: OT.good }}>
                {t(TX.rewardKicker, locale)}
              </div>
              <p className="mb-3 text-sm font-semibold" style={{ color: OT.ink }}>
                {t(data.reward, locale)}
              </p>

              <button
                type="button"
                data-testid="onboarding-nextday"
                onClick={nextDay}
                className="w-full rounded-full py-2.5 text-sm font-black uppercase tracking-wide"
                style={{ background: OT.teal, color: OT.card, boxShadow: PRINT_SHADOW }}
              >
                {t(TX.next, locale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
