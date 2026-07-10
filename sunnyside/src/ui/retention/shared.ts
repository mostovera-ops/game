/**
 * ui/retention/shared.ts — общие хелперы зоны `ui-daily-club`
 * (`ui_daily_specials`/`ui_regulars_club`, 16-retention.md): день-индекс UTC для
 * генератора Daily Specials, тикающий `serverNow()` для таймера/бейджа, и сама
 * генерация сегодняшнего набора задач.
 *
 * ПРОБЕЛ БЭКЕНДА (тот же паттерн, что уже задокументирован в `ui/social/MentorPanel.tsx`
 * для менторства): сервер пока НЕ генерирует и не хранит Daily Specials — нет ни RPC,
 * ни снапшота (сверено с `supabase/APPLIED.md` — список функций там не включает
 * `daily_special_*`; retention-система ограничена `streak_check`/`streak_insure`/
 * `vacation_start`/`vacation_end`, `engine/retention/system.ts`). Это ЗАДОКУМЕНТИРОВАННЫЙ
 * пробел (`FIXPLAN-CODE.md` — «ui_daily_specials/ui_regulars_club — не смонтированы,
 * TODO профильных ui-агентов»), не наша самодеятельность.
 *
 * Поэтому набор задач дня считается НА КЛИЕНТЕ уже готовой чистой функцией
 * `generateDailySpecials` (`engine/retention/generator.ts`, чужая зона, не трогаем) —
 * тот же алгоритм anti-repeat/скейлинга, который спека предполагает для сервера (§3.1),
 * просто посчитанный локально и детерминированно (сид от `farmId:dayIndex`, тот же приём,
 * что `hashSeed` для недельного спроса, `engine/econ/rng.ts`). Год ротации — «вчера» этим
 * же способом порождает `mainFocusCategory`, который передаётся как anti-repeat вход
 * «сегодня» — без отдельного персиста.
 *
 * ЧЕГО ЗДЕСЬ НЕТ (сознательно): живого прогресса «сколько уже сделано» по каждой задаче.
 * Прогресс требует событийного учёта действий игрока по категориям (харвест/крафт/
 * serve/...) — такого счётчика нигде в сторе нет, а придумывать его в этой зоне —
 * придумывать чужую систему (AGENTS.md §0.6 «не рефакторить/не изобретать то, о чём не
 * просили»). Когда появится реальный учёт (или серверный RPC) — меняется вызывающая
 * сторона (`DailySpecials.tsx`), сама генерация здесь не потребует правок.
 */

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import { generateDailySpecials, type GenerateDailySpecialsResult } from '@/engine/retention'
import { hashString } from '@/engine/econ/rng'
import type { EpochMs } from '@/types'

/** Сутки в мс — тот же ролловер-квант, что месяц/день в `engine/retention/streak.ts`. */
export const DAY_MS = 24 * 60 * 60 * 1000

/** Индекс UTC-дня (00:00 UTC ролловер, канон §2.3) — чистая арифметика времени, не формула игры. */
export function utcDayIndex(now: EpochMs): number {
  return Math.floor(now / DAY_MS)
}

/** `serverNow()`, тикающий раз в `intervalMs` — для таймера ротации/минутного бейджа. */
export function useTickingServerNow(intervalMs = 1000): EpochMs {
  const serverNow = useStore((s) => s.serverNow)
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs)
    return () => clearInterval(id)
  }, [serverNow, intervalMs])
  return now
}

/** Сегодняшний набор Daily Specials — детерминирован от (ферма, Farm Value, день). См. докстринг файла. */
export function useDailySpecialsToday(now: EpochMs): GenerateDailySpecialsResult {
  const farmId = useStore((s) => s.farm?.farmId ?? 'anon')
  const farmValueTotal = useStore((s) => s.farm?.farmValue.total ?? 0)
  const dayIndex = utcDayIndex(now)

  return useMemo(() => {
    const yesterday = generateDailySpecials({
      farmValueTotal,
      seed: hashString(`${farmId}:${dayIndex - 1}`),
    })
    return generateDailySpecials({
      farmValueTotal,
      previousMainFocusCategory: yesterday.mainFocusCategory,
      seed: hashString(`${farmId}:${dayIndex}`),
    })
  }, [farmId, farmValueTotal, dayIndex])
}

/** «Незабранное» — сегодняшние спецблюда ещё не открывали в этой сессии/раньше (бейдж лаунчера). */
export function useDailySpecialsUnseen(): boolean {
  const now = useTickingServerNow(60_000) // бейджу хватает минутной точности
  const dayIndex = utcDayIndex(now)
  const seenDay = useStore((s) => s.ui.dailySpecialsSeenDay)
  return seenDay !== dayIndex
}
