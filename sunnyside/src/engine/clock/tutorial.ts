/**
 * engine/clock/tutorial.ts — ЧИСТАЯ логика Tutorial Mini-Week и вливания новичка
 * (01-core-loop §3.9/§3.10).
 *
 * Мини-неделя — ИЗОЛИРОВАННАЯ песочница: 7 «сжатых дней» гейтятся ДЕЙСТВИЕМ игрока,
 * а не реальным временем (offline-safe, single-player). Она НЕ пишет в общий
 * `server_calendars` и не влияет на серверные агрегаты (§3.9). Поэтому здесь —
 * детерминированный степ-автомат без обращения к серверным часам.
 *
 * После `t_day_7` — вливание в ТЕКУЩУЮ реальную фазу сервера + Grand Opening ×2 с
 * фиксированным таймером 7×24 ч, переживающим rollover (§3.10, FIXPLAN R1).
 *
 * ЧИСЛА — ИЗ СПЕКИ (§3.9 таблица, §4.2), не выдуманы.
 * ГРАНИЦА: импортирует только типы `@/types` + локальные константы/функции.
 */

import type { EpochMs, WeekPhase } from '@/types'
import { GRAND_OPENING_MS, GRAND_OPENING_MULT } from './constants'
import { phaseAt } from './calendar'

/** Ключи сжатых дней мини-недели (§3.9). */
export type TutorialDayKey =
  | 't_day_1'
  | 't_day_2'
  | 't_day_3'
  | 't_day_4'
  | 't_day_5'
  | 't_day_6'
  | 't_day_7'

export interface TutorialStep {
  key: TutorialDayKey
  /** Прообраз реальной фазы недели (§3.9 колонка «Прообраз»). */
  prototypePhase: WeekPhase
  /** Сжатый таймер шага в секундах (гипотеза §3.9; 0 = мгновенно/без таймера). */
  timerSec: number
  /** Ведущий NPC шага (§3.9). Ключ канона — английский. */
  npc: string
}

/**
 * Таблица мини-недели (§3.9). Порядок — канон посев→рост→готовка→…→финал.
 * Гарантированные награды (первая лента, рецепт Nana Opal, стартовые семена)
 * детерминированы — «первый праздник» точно случается (§3.9), их выдача — за
 * онбордингом (18-onboarding), здесь только тайминг/структура.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { key: 't_day_1', prototypePhase: 'mon_plan', timerSec: 10, npc: 'old_man_whittaker' },
  { key: 't_day_2', prototypePhase: 'tue_produce', timerSec: 15, npc: 'nana_opal' },
  { key: 't_day_3', prototypePhase: 'wed_expedition', timerSec: 20, npc: 'trucker_cody' },
  { key: 't_day_4', prototypePhase: 'thu_push', timerSec: 0, npc: 'mayor_calloway' },
  { key: 't_day_5', prototypePhase: 'fri_prep', timerSec: 0, npc: 'dj_ricky_ray' },
  { key: 't_day_6', prototypePhase: 'sat_fair', timerSec: 60, npc: 'miss_maybelle' },
  { key: 't_day_7', prototypePhase: 'sun_event', timerSec: 0, npc: 'grimsby' },
] as const

const TUTORIAL_ORDER: readonly TutorialDayKey[] = TUTORIAL_STEPS.map((s) => s.key)

/** Индекс шага (0-based) или -1 если ключ неизвестен. */
export function tutorialIndexOf(key: TutorialDayKey): number {
  return TUTORIAL_ORDER.indexOf(key)
}

/** Шаг по ключу (или undefined). */
export function tutorialStep(key: TutorialDayKey): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((s) => s.key === key)
}

/**
 * Следующий шаг после завершения `current` действием игрока.
 * Возвращает `null`, когда пройден последний день (`t_day_7`) — мини-неделя завершена.
 */
export function tutorialNext(current: TutorialDayKey): TutorialDayKey | null {
  const i = tutorialIndexOf(current)
  if (i < 0 || i >= TUTORIAL_ORDER.length - 1) return null
  return TUTORIAL_ORDER[i + 1] ?? null
}

/** Завершена ли мини-неделя, если текущий (последний завершённый) шаг — `current`. */
export function isTutorialComplete(current: TutorialDayKey): boolean {
  return current === 't_day_7'
}

export interface TutorialProgress {
  index: number // 1-based номер текущего дня
  total: number
  remaining: number
}

/** Прогресс мини-недели для HUD (§3.9). */
export function tutorialProgress(current: TutorialDayKey): TutorialProgress {
  const i = tutorialIndexOf(current)
  const total = TUTORIAL_ORDER.length
  return { index: i + 1, total, remaining: Math.max(0, total - (i + 1)) }
}

// ════════════════════════════════════════════════════════════════════════════
// Вливание в реальный календарь + Grand Opening (§3.10)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Фаза, в которую вливается новичок сразу после `t_day_7` — ТЕКУЩАЯ реальная фаза
 * сервера в момент `enteredAt` (§3.10 п.1: «входит в phase_* текущей недели»).
 * Пропущенные будни в минус не идут (§3.10 матрица).
 */
export function entryPhase(enteredAt: EpochMs): WeekPhase {
  return phaseAt(enteredAt)
}

export interface GrandOpeningWindow {
  opensAt: EpochMs
  closesAt: EpochMs
  /** Множитель дохода (мастер — 14-economy §3.10 R1; здесь для UI-подачи). */
  mult: number
}

/**
 * Окно Grand Opening: фиксированный таймер 7×24 ч от момента активации, НЕ привязан
 * к границам недели и свободно переживает rollover (§3.10 п.2, FIXPLAN R1, C7).
 */
export function grandOpeningWindow(activatedAt: EpochMs): GrandOpeningWindow {
  return {
    opensAt: activatedAt,
    closesAt: activatedAt + GRAND_OPENING_MS,
    mult: GRAND_OPENING_MULT,
  }
}

/** Активен ли Grand Opening в момент `t` (полуоткрытое окно [activatedAt, +7д)). */
export function isGrandOpeningActive(activatedAt: EpochMs, t: EpochMs): boolean {
  return t >= activatedAt && t < activatedAt + GRAND_OPENING_MS
}

/** Остаток Grand Opening в мс (≤0 — истёк). */
export function grandOpeningRemainingMs(activatedAt: EpochMs, t: EpochMs): number {
  return activatedAt + GRAND_OPENING_MS - t
}
