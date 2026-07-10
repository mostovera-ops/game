/**
 * DailySpecials.tsx — Доска Sheriff Roy (`ui_daily_specials`, 16-retention.md §3.1/§3.2/§4.1,
 * канон `npc_sheriff_roy`, `mech_daily_special`). Три задачи дня + таймер до ролловера
 * (00:00 UTC) + таблица per-day наград (§4.1). Генерация — см. докстринг `./shared.ts`
 * (клиентская, детерминированная — сервер этот RPC ещё не отдаёт).
 *
 * TODO(daily-specials-progress): живые «N/target» прогресс-бары по каждой задаче требуют
 * событийного учёта действий игрока по категориям (харвест/крафт/serve/...), которого пока
 * нигде в сторе нет (см. `./shared.ts`). Пока показываем только цель (`×N`) и общую таблицу
 * наград за итог дня — честно, без выдуманных чисел. Когда появится учёт/RPC — здесь
 * достаточно заменить блок целей на прогресс-бар, сама генерация не меняется.
 */
import { useEffect } from 'react'
import { useStore } from '@/state'
import type { Bilingual } from '@/types'
import { dailyOutcome, type DailySpecialCategory } from '@/engine/retention'
import { formatCountdown } from '@/ui/hud/format'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { DAY_MS, useDailySpecialsToday, useTickingServerNow, utcDayIndex } from './shared'

const CATEGORY_INFO: Record<DailySpecialCategory, { icon: string; label: Bilingual }> = {
  Field: { icon: '🌾', label: { en: 'Field', ru: 'Поле' } },
  Kitchen: { icon: '🍳', label: { en: 'Kitchen', ru: 'Кухня' } },
  Counter: { icon: '🛎️', label: { en: 'Counter', ru: 'Прилавок' } },
  Yard: { icon: '🚚', label: { en: 'Yard', ru: 'Двор/Гараж' } },
  Community: { icon: '🤝', label: { en: 'Community', ru: 'Общинное' } },
}

function pick(b: Bilingual, ru: boolean): string {
  return ru ? b.ru : b.en
}

export function DailySpecials() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const activePanel = useStore((s) => s.ui.activePanel)
  const markDailySpecialsSeen = useStore((s) => s.markDailySpecialsSeen)

  const now = useTickingServerNow(1000)
  const dayIndex = utcDayIndex(now)
  const { specials } = useDailySpecialsToday(now)
  const remainingMs = (dayIndex + 1) * DAY_MS - now

  // Открытие панели снимает бейдж лаунчера (см. `./shared.ts` `useDailySpecialsUnseen`).
  useEffect(() => {
    if (activePanel === 'ui_daily_specials') markDailySpecialsSeen(dayIndex)
  }, [activePanel, dayIndex, markDailySpecialsSeen])

  const at2 = dailyOutcome(2)
  const at3 = dailyOutcome(3)

  return (
    <section data-testid="ui-daily-specials" className="pointer-events-auto flex w-full max-w-sm flex-col gap-3">
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
        style={{ background: DINER.board, color: DINER.boardInk, boxShadow: PRINT_SHADOW }}
      >
        <span>🤠 {ru ? 'Шериф Рой' : 'Sheriff Roy'}</span>
        <span data-testid="daily-specials-countdown" className="tabular-nums">
          ⏱ {formatCountdown(remainingMs)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {specials.map((sp) => {
          const info = CATEGORY_INFO[sp.category]
          return (
            <li
              key={sp.templateKey}
              data-testid={`daily-special-${sp.templateKey}`}
              className="flex items-center gap-2 rounded-lg p-3"
              style={{ background: DINER.card, color: DINER.ink, boxShadow: PRINT_SHADOW }}
            >
              <span aria-hidden className="text-xl">
                {info.icon}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {pick(sp.name, ru)} <span className="opacity-60">×{sp.targetQty}</span>
                </p>
                <p className="text-xs opacity-60">
                  {pick(info.label, ru)}
                  {sp.isMainFocus ? <> · {ru ? 'главный фокус' : 'main focus'} ⭐</> : null}
                </p>
              </div>
            </li>
          )
        })}
        {specials.length === 0 && (
          <p className="text-sm italic opacity-70">
            {ru
              ? 'Шериф Рой сегодня без задач — загляни завтра.'
              : 'Sheriff Roy is out of tasks today — check back tomorrow.'}
          </p>
        )}
      </ul>

      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: DINER.card, color: DINER.ink, boxShadow: PRINT_SHADOW }}
      >
        <p className="mb-1 font-bold uppercase tracking-wide opacity-70">
          {ru ? 'Награда за итог дня' : 'Reward for the day'}
        </p>
        <p>
          2/3: +${at2.bonusBucks}, {Math.round(at2.ticketChance * 100)}% 🎟1
        </p>
        <p>
          3/3: +${at3.bonusBucks}, 🎟1 {ru ? 'гарантировано' : 'guaranteed'}
        </p>
      </div>
    </section>
  )
}
