/**
 * engine/clock/calendar.ts — ЧИСТЫЕ функции серверного календаря (01-core-loop).
 *
 * Детерминированный конечный автомат недели, ведомый серверными часами в UTC
 * (§3.3). Клиент НЕ вычисляет фазу от локального времени — читает серверную
 * (21-client §3.6); эти функции — эталон, которым LocalBackendAdapter и тесты
 * воспроизводят серверную истину, а UI рендерит отсчёты (§4.3).
 *
 * DST-ИММУННОСТЬ: всё считается от абсолютного EpochMs и целочисленных смещений
 * в UTC — переход на летнее время в TZ игрока не двигает ни один якорь (C6).
 *
 * ГРАНИЦА: импортирует только типы `@/types` и локальные константы. Ноль сети/three.
 */

import type { EpochMs, UUID, ServerCalendar, WeekPhase, TimeWindow } from '@/types'
import {
  WEEK_MS,
  DAY_MS,
  WEEK_EPOCH_ANCHOR,
  COOP_DEADLINE_OFFSET,
  FAIR_OPEN_OFFSET,
  FAIR_CLOSE_OFFSET,
  EVENT_FINALE_OFFSET,
  ROLLOVER_OFFSET,
  SEASON_LENGTH_WEEKS,
  CONTEST_SUBMIT_CLOSE_OFFSET,
  CONTEST_VOTE_CLOSE_OFFSET,
  SEASON_REWARD_GRACE_MS,
} from './constants'

// ════════════════════════════════════════════════════════════════════════════
// Нарезка недель
// ════════════════════════════════════════════════════════════════════════════

/**
 * Абсолютный индекс недели от эпохи (§3.7 R7). Неделя 0 стартует Пн 1970-01-05.
 * Детерминированный и монотонный — база для сезонной арифметики.
 */
export function weekNumberOf(t: EpochMs): number {
  return Math.floor((t - WEEK_EPOCH_ANCHOR) / WEEK_MS)
}

/** Начало недели (Пн 00:00:00 UTC), в которую попадает `t` (canon `WEEK_START`). */
export function weekStartOf(t: EpochMs): EpochMs {
  return weekNumberOf(t) * WEEK_MS + WEEK_EPOCH_ANCHOR
}

/** Начало недели по её абсолютному индексу. */
export function weekStartOfIndex(weekIndex: number): EpochMs {
  return weekIndex * WEEK_MS + WEEK_EPOCH_ANCHOR
}

/** Смещение внутри недели [0, WEEK_MS) для `t`. */
export function offsetInWeek(t: EpochMs): number {
  return t - weekStartOf(t)
}

// ════════════════════════════════════════════════════════════════════════════
// Фаза недели
// ════════════════════════════════════════════════════════════════════════════

/**
 * Фаза дня-роли для смещения внутри недели (§3.3, §3.2). Границы «мягкие» для
 * игрока, но детерминированные для сервера:
 *   [0d,1d) mon_plan · [1d,2d) tue_produce · [2d,3d) wed_expedition ·
 *   [3d,4d) thu_push · [4d,5d) fri_prep · [Сб00:00, Вс12:00) sat_fair ·
 *   [Вс12:00, Пн00:00) sun_event (окно ярмарки закрыто, финал+тихий вечер).
 */
export function phaseAtOffset(offset: number): WeekPhase {
  if (offset < 1 * DAY_MS) return 'mon_plan'
  if (offset < 2 * DAY_MS) return 'tue_produce'
  if (offset < 3 * DAY_MS) return 'wed_expedition'
  if (offset < 4 * DAY_MS) return 'thu_push'
  if (offset < FAIR_OPEN_OFFSET) return 'fri_prep' // < 5d (Сб 00:00)
  if (offset < FAIR_CLOSE_OFFSET) return 'sat_fair' // Сб 00:00 → Вс 12:00 (36 ч)
  return 'sun_event' // Вс 12:00 → Пн 00:00
}

/** Фаза недели для абсолютного серверного времени `t`. */
export function phaseAt(t: EpochMs): WeekPhase {
  return phaseAtOffset(offsetInWeek(t))
}

// ════════════════════════════════════════════════════════════════════════════
// Якоря недели
// ════════════════════════════════════════════════════════════════════════════

/** Каноничные жёсткие якоря недели (§4.5): те, что двигают мир/дедлайны. */
export type AnchorCode = 'A0' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A8' | 'A10' | 'A12' | 'A14'

export interface Anchor {
  code: AnchorCode
  at: EpochMs
}

/** Упорядоченный список якорей недели, начинающейся в `weekStart`. */
export function weekAnchors(weekStart: EpochMs): Anchor[] {
  return [
    { code: 'A0', at: weekStart }, // Пн 00:00 — начало недели / публикация спроса
    { code: 'A2', at: weekStart + 1 * DAY_MS }, // Вт 00:00 — Co-op открыты
    { code: 'A3', at: weekStart + 2 * DAY_MS }, // Ср 00:00 — экспедиции
    { code: 'A4', at: weekStart + 3 * DAY_MS }, // Чт 00:00 — Potluck открыт
    { code: 'A5', at: weekStart + COOP_DEADLINE_OFFSET }, // Чт 23:59:59 — Co-op дедлайн
    { code: 'A6', at: weekStart + 4 * DAY_MS }, // Пт 00:00 — прожарка
    { code: 'A8', at: weekStart + FAIR_OPEN_OFFSET }, // Сб 00:00 — ярмарка открыта
    { code: 'A10', at: weekStart + FAIR_CLOSE_OFFSET }, // Вс 12:00 — ярмарка закрыта
    { code: 'A12', at: weekStart + EVENT_FINALE_OFFSET }, // Вс 20:00 — финал ивента
    { code: 'A14', at: weekStart + ROLLOVER_OFFSET }, // Вс 23:59:59 — rollover
  ]
}

/**
 * Ближайший якорь строго ПОСЛЕ `t` (§4.3 «next_anchor = min{A : A.utc > now}»).
 * Смотрит текущую и следующую неделю, поэтому после A14 корректно указывает на
 * A0 новой недели (нет «мёртвой зоны», §3.7).
 */
export function nextAnchor(t: EpochMs): Anchor {
  const ws = weekStartOf(t)
  const candidates = [...weekAnchors(ws), ...weekAnchors(ws + WEEK_MS)]
  // Первый строго больший — список уже упорядочен по возрастанию `at`.
  const found = candidates.find((a) => a.at > t)
  // Следующая неделя всегда даёт якорь > t, поэтому `found` определён.
  if (!found) throw new Error('clock: nextAnchor unreachable')
  return found
}

// ════════════════════════════════════════════════════════════════════════════
// Окна
// ════════════════════════════════════════════════════════════════════════════

/** Окно ярмарки (Сб 00:00 → Вс 12:00, 36 ч) для недели с началом `weekStart`. */
export function fairWindowOf(weekStart: EpochMs): TimeWindow {
  return {
    opensAt: weekStart + FAIR_OPEN_OFFSET,
    closesAt: weekStart + FAIR_CLOSE_OFFSET,
  }
}

/** Открыто ли окно [opensAt, closesAt) в момент `t` (полуоткрытое, как фазы). */
export function isWindowOpen(window: TimeWindow, t: EpochMs): boolean {
  return t >= window.opensAt && t < window.closesAt
}

/**
 * Окно приёма конкурсных заявок (Сб 00:00 → Сб 12:00, A8→A9, §3.2/§3.5, гипотеза).
 * Под-дедлайн ярмарки; правила самих конкурсов — `09-fair.md` (§6).
 */
export function contestEntryWindowOf(weekStart: EpochMs): TimeWindow {
  return {
    opensAt: weekStart + FAIR_OPEN_OFFSET,
    closesAt: weekStart + CONTEST_SUBMIT_CLOSE_OFFSET,
  }
}

/** Окно голосования конкурсов (Сб 12:00 → Вс 12:00, A9→A10, §3.2/§3.5, гипотеза). */
export function contestVoteWindowOf(weekStart: EpochMs): TimeWindow {
  return {
    opensAt: weekStart + CONTEST_SUBMIT_CLOSE_OFFSET,
    closesAt: weekStart + CONTEST_VOTE_CLOSE_OFFSET,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Полный снапшот календаря (эталон для LocalBackendAdapter)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Детерминированный `ServerCalendar` для города на момент `t`. Воспроизводит
 * серверную истину без сети — для локального адаптера/тестов. `weekIndex` можно
 * переопределить серверным значением; по умолчанию — абсолютный (`weekNumberOf`).
 */
export function buildCalendar(t: EpochMs, townId: UUID, weekIndex?: number): ServerCalendar {
  const ws = weekStartOf(t)
  return {
    townId,
    weekIndex: weekIndex ?? weekNumberOf(t),
    phase: phaseAt(t),
    rolloverAt: ws + ROLLOVER_OFFSET,
    fairWindow: fairWindowOf(ws),
    coopDeadlineAt: ws + COOP_DEADLINE_OFFSET,
    eventFinalAt: ws + EVENT_FINALE_OFFSET,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Сезоны (Route Pass, 8 недель — §3.8/§4.4)
// ════════════════════════════════════════════════════════════════════════════

export interface SeasonProgress {
  /** Порядковый сезон (0-based) от `seasonStartWeek`. */
  seasonIndex: number
  /** Неделя внутри сезона, 1..8. */
  weekInSeason: number
  /** Сколько недель (включая текущую) до конца сезона. */
  weeksRemaining: number
  /** Является ли текущая неделя последней (8-й) в сезоне — на её rollover финал сезона (C9). */
  isFinalWeek: boolean
}

/**
 * Прогресс сезона для абсолютной недели `weekIndex`, если сезоны выровнены от
 * `seasonStartWeek` шагом в 8 недель (границы сезона всегда по границам недель, §3.8).
 * `weekIndex` до `seasonStartWeek` даёт отрицательный `seasonIndex` — корректно
 * (пред-сезонные недели), но `weekInSeason` всегда в 1..8.
 */
export function seasonProgress(weekIndex: number, seasonStartWeek: number): SeasonProgress {
  const delta = weekIndex - seasonStartWeek
  const seasonIndex = Math.floor(delta / SEASON_LENGTH_WEEKS)
  // Неотрицательный остаток даже для delta < 0:
  const rem = ((delta % SEASON_LENGTH_WEEKS) + SEASON_LENGTH_WEEKS) % SEASON_LENGTH_WEEKS
  const weekInSeason = rem + 1
  return {
    seasonIndex,
    weekInSeason,
    weeksRemaining: SEASON_LENGTH_WEEKS - rem,
    isFinalWeek: weekInSeason === SEASON_LENGTH_WEEKS,
  }
}

/**
 * Абсолютный момент конца сезона `seasonIndex` (rollover его последней/8-й недели, §3.8).
 * `seasonStartWeek` — неделя, с которой начинается сезон 0 (`seasonIndex` 0-based).
 */
export function seasonEndAt(seasonStartWeek: number, seasonIndex: number): EpochMs {
  const lastWeekIndex = seasonStartWeek + (seasonIndex + 1) * SEASON_LENGTH_WEEKS - 1
  return weekStartOfIndex(lastWeekIndex) + ROLLOVER_OFFSET
}

/**
 * В пределах ли льготного периода возврата наград сезона (72 ч после его конца, §3.8 C10,
 * гипотеза): игрок, не забравший награды трека вовремя, всё ещё может их получить.
 */
export function isWithinSeasonRewardGrace(seasonEnd: EpochMs, t: EpochMs): boolean {
  return t >= seasonEnd && t < seasonEnd + SEASON_REWARD_GRACE_MS
}
