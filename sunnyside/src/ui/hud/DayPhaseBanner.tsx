/**
 * DayPhaseBanner.tsx — «плашка дня» с таймером до следующей вехи (19-ui-ux §1/§3.1 S2,
 * canon §2.3). Считает остаток ЧИСТО презентационно: якорь берёт из `engine/clock`
 * (`nextAnchor`, уже готовая чистая функция — не дублируем расчёт), время — из
 * `serverNow()` (clock-слайс). Вс/Сб — акцентная (вишнёвая) плашка (§2).
 */

import { useEffect, useReducer } from 'react'
import { useStore } from '@/state'
import { nextAnchor } from '@/engine/clock'
import { PHASE_LABEL, ACCENT_PHASES, pick } from './labels'
import { formatCountdown } from './format'

const WARMING_UP = { en: 'Warming up the grill…', ru: 'Разогреваем гриль…' }

export function DayPhaseBanner() {
  const calendar = useStore((s) => s.clock.calendar)
  const serverNow = useStore((s) => s.serverNow)
  const locale = useStore((s) => s.ui.locale)
  // Пере-рендер раз в секунду ради тикающего таймера (чисто визуально, не игровая логика).
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!calendar) {
    return (
      <div data-testid="day-phase-banner" className="hud-marquee rounded-full px-3 py-1 text-xs opacity-80">
        {pick(WARMING_UP, locale)}
      </div>
    )
  }

  const now = serverNow()
  const anchor = nextAnchor(now)
  const accent = ACCENT_PHASES.includes(calendar.phase)

  return (
    <div
      data-testid="day-phase-banner"
      className={
        'hud-marquee flex items-center gap-2 rounded-full px-3 py-1 text-xs ' +
        (accent ? 'ring-2 ring-[var(--cherry)]' : '')
      }
    >
      <span className="uppercase tracking-wide" style={{ color: 'var(--mustard)' }}>
        {pick(PHASE_LABEL[calendar.phase], locale)}
      </span>
      <span className="tabular-nums opacity-80" data-testid="day-phase-countdown">
        {formatCountdown(anchor.at - now)}
      </span>
    </div>
  )
}
