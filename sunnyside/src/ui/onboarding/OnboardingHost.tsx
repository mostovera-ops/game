/**
 * OnboardingHost.tsx — корень FTUE-оверлея (ui_ftue_overlay, 18-onboarding §5).
 * Роутит по фазе стора (`useFtueStore.phase`) нужный экран: письмо → мини-неделя →
 * выпуск/Grand Opening. После `done` FTUE ничего не рисует (кроме опциональной
 * карточки цели дня, если композиция задала `personalDay`).
 *
 * РЕЗЮМ ПОСЛЕ ПЕРЕЗАГРУЗКИ (§3.2/O2): фаза и шаг персистятся в `sunnyside.ftue`,
 * поэтому монтирование хоста само восстанавливает игрока на нужном экране/дне.
 *
 * ИНТЕГРАЦИЯ: композиция (владелец `App.tsx`/бутстрап — AGENTS.md §2) монтирует
 *   `<OnboardingHost locale={locale} canSkip={serverSkipFlag} />`
 * поверх HUD. `ui/` не ходит в net — серверные флаги/колбэки приходят пропами.
 */

import type { Locale } from '@/types'
import { useFtueStore } from './store'
import { LegacyLetter } from './LegacyLetter'
import { MiniWeek } from './MiniWeek'
import { GrandOpeningIntro } from './GrandOpeningIntro'
import { DailyGoalCard } from './DailyGoalCard'

export interface OnboardingHostProps {
  locale: Locale
  /** Серверный флаг права на скип мини-недели (§3.7). */
  canSkip?: boolean
  /** Личный день 1..7 для карточки цели после выпуска (§3.5). Опционально. */
  personalDay?: number
  /** Хук композиции на реальный матчинг стрита (§3.8). */
  onStreetJoin?: () => void
  /** Хук композиции на завершение FTUE (аналитика onb_ftue_complete). */
  onFinish?: () => void
}

export function OnboardingHost({
  locale,
  canSkip = false,
  personalDay,
  onStreetJoin,
  onFinish,
}: OnboardingHostProps) {
  const phase = useFtueStore((s) => s.phase)

  switch (phase) {
    case 'letter':
      return <LegacyLetter locale={locale} canSkip={canSkip} />
    case 'mini_week':
      return <MiniWeek locale={locale} />
    case 'released':
    case 'skipped':
      return <GrandOpeningIntro locale={locale} onStreetJoin={onStreetJoin} onFinish={onFinish} />
    case 'done':
      // FTUE пройден: только мягкая карточка цели дня, если композиция её просит.
      return personalDay != null ? (
        <div className="pointer-events-none fixed left-3 top-20 z-30 sm:left-4">
          <DailyGoalCard locale={locale} day={personalDay} />
        </div>
      ) : null
    default:
      return null
  }
}
