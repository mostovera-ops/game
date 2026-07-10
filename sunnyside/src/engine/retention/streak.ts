/**
 * engine/retention/streak.ts — Regular Streak («Завсегдатай», `mech_regular_streak`,
 * 16-retention.md §3.3/§4.2/§4.3): бонусная шкала, заморозка на 24ч, страховка за
 * `🎟`, месячный кап бесплатных заморозок, обвал стрика без потери `best_streak`.
 *
 * ЧИСТАЯ логика: НЕ списывает тикеты и НЕ ходит в adapter — списание/подтверждение
 * тикетов делает вызывающий (`SystemContext.applyMutation`, анти-чит 21-client §3.5).
 * Этот модуль только считает переходы состояния и предсказывает цену/бонус для UI.
 *
 * Состояние — конечный автомат на игровой день (сервер зовёт `advanceStreakDay`
 * один раз за ролловер, 00:00 UTC, канон §2.3):
 *
 *   active ──(miss, есть бесплатная заморозка)──▶ frozen
 *   active ──(miss, месячный кап исчерпан)───────▶ awaiting_insurance
 *   frozen ──(miss, бесплатные 24ч истекли)──────▶ awaiting_insurance
 *   awaiting_insurance ──(miss, не оплатил)───────▶ broken (streakDays → 0)
 *   awaiting_insurance ──(miss, оплатил `🎟`)──────▶ insured (ещё 24ч, §3.3)
 *   insured ──(miss, продлённые 24ч тоже истекли)─▶ broken
 *   любая фаза (кроме vacation) ──(≥2/3 выполнено)─▶ active, streakDays += 1
 *   vacation — стрик не двигается вовсе (§3.5, RC14), пока явно не завершат отпуск
 */

import type { EpochMs } from '@/types'
import {
  DAY_COMPLETE_BONUS_BUCKS,
  FREE_FREEZES_PER_MONTH,
  STREAK_BONUS_TABLE,
  STREAK_INSURANCE_PRICE_TABLE,
  TICKET_CHANCE_AT_2_OF_3,
  lookupByDayRange,
} from './constants'

export type StreakPhase = 'active' | 'frozen' | 'awaiting_insurance' | 'insured' | 'broken' | 'vacation'

export interface StreakEngineState {
  streakDays: number
  /** Коллекционный рекорд (пиллар P4) — никогда не сбрасывается обвалом стрика (§3.3). */
  bestStreak: number
  phase: StreakPhase
}

export interface MonthlyFreezeUsage {
  /** `YYYY-MM` (UTC) — счётчик привязан к календарному месяцу, не к эпизоду стрика (§3.3). */
  monthKey: string
  freeFreezesUsed: number
}

export interface DailyOutcome {
  /** ≥2/3 выполнено — засчитывается день стрика (§3.1/§3.3). */
  streakTicked: boolean
  /** Разовый `$`-бонус дня (§4.1, гипотеза DAY_COMPLETE_BONUS_BUCKS). 0, если день не засчитан. */
  bonusBucks: number
  /** Шанс `🎟 1` (один бросок) — только при ровно 2/3, 0 иначе (§4.1). */
  ticketChance: number
  /** `🎟 1` гарантирован (3/3) — заменяет `ticketChance`, не суммируется (§4.1). */
  ticketGuaranteed: boolean
}

/** Начальное состояние нового аккаунта (day 0, ничего не заморожено). */
export function initialStreakState(): StreakEngineState {
  return { streakDays: 0, bestStreak: 0, phase: 'active' }
}

export function initialMonthlyUsage(monthKey: string): MonthlyFreezeUsage {
  return { monthKey, freeFreezesUsed: 0 }
}

/** `YYYY-MM` в UTC — ключ месяца для месячного капа заморозок (§3.3). */
export function utcMonthKey(now: EpochMs): string {
  const d = new Date(now)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Сбрасывает счётчик, если наступил новый календарный месяц UTC (§3.3 — 00:00 UTC 1-го числа). */
export function resetMonthlyUsageIfNeeded(usage: MonthlyFreezeUsage, now: EpochMs): MonthlyFreezeUsage {
  const currentKey = utcMonthKey(now)
  if (usage.monthKey === currentKey) return usage
  return initialMonthlyUsage(currentKey)
}

function canUseFreeFreeze(usage: MonthlyFreezeUsage): boolean {
  return usage.freeFreezesUsed < FREE_FREEZES_PER_MONTH
}

/** Бонус к Bucks-выручке прилавка/смены по дню стрика (§4.2), как доля (0.18 = +18%). */
export function streakBonusPct(streakDays: number): number {
  return lookupByDayRange(STREAK_BONUS_TABLE, streakDays)
}

/** Цена страховки в `🎟` по дню стрика НА МОМЕНТ ПРОПУСКА (§4.3). */
export function streakInsurancePriceTickets(streakDaysAtMiss: number): number {
  return lookupByDayRange(STREAK_INSURANCE_PRICE_TABLE, streakDaysAtMiss)
}

/** Итог дня по числу выполненных Daily Specials (§4.1) — без учёта бонуса $/задачу. */
export function dailyOutcome(doneCount: 0 | 1 | 2 | 3): DailyOutcome {
  if (doneCount >= 3) {
    return { streakTicked: true, bonusBucks: DAY_COMPLETE_BONUS_BUCKS, ticketChance: 0, ticketGuaranteed: true }
  }
  if (doneCount === 2) {
    return {
      streakTicked: true,
      bonusBucks: DAY_COMPLETE_BONUS_BUCKS,
      ticketChance: TICKET_CHANCE_AT_2_OF_3,
      ticketGuaranteed: false,
    }
  }
  return { streakTicked: false, bonusBucks: 0, ticketChance: 0, ticketGuaranteed: false }
}

export interface AdvanceStreakDayInput {
  state: StreakEngineState
  monthlyUsage: MonthlyFreezeUsage
  doneCount: 0 | 1 | 2 | 3
  now: EpochMs
  /**
   * Оплатил ли игрок страховку `🎟` за текущую заморозку ДО этого ролловера
   * (списание тикетов делает вызывающий заранее через adapter; здесь только флаг).
   */
  insurancePaid?: boolean
}

export interface AdvanceStreakDayResult {
  state: StreakEngineState
  monthlyUsage: MonthlyFreezeUsage
  outcome: DailyOutcome
}

/**
 * Один тик ролловера игрового дня (00:00 UTC, канон §2.3). Вызывать РОВНО один раз
 * за календарный игровой день на аккаунт (§3.3 — мультиаккаунт/мультиустройство:
 * `streakDays` — атрибут аккаунта, не устройства).
 */
export function advanceStreakDay(input: AdvanceStreakDayInput): AdvanceStreakDayResult {
  const { state, doneCount, now } = input
  const monthlyUsage = resetMonthlyUsageIfNeeded(input.monthlyUsage, now)
  const outcome = dailyOutcome(doneCount)

  if (state.phase === 'vacation') {
    // Gone Fishin' — стрик не растёт и не падает, Daily Specials не генерируются (§3.5).
    return { state, monthlyUsage, outcome: dailyOutcome(0) }
  }

  if (outcome.streakTicked) {
    const streakDays = state.streakDays + 1
    return {
      state: { streakDays, bestStreak: Math.max(state.bestStreak, streakDays), phase: 'active' },
      monthlyUsage,
      outcome,
    }
  }

  switch (state.phase) {
    case 'active': {
      if (canUseFreeFreeze(monthlyUsage)) {
        return {
          state: { ...state, phase: 'frozen' },
          monthlyUsage: { ...monthlyUsage, freeFreezesUsed: monthlyUsage.freeFreezesUsed + 1 },
          outcome,
        }
      }
      // Месячный кап бесплатных заморозок исчерпан — сразу требуется страховка (§3.3).
      return { state: { ...state, phase: 'awaiting_insurance' }, monthlyUsage, outcome }
    }
    case 'frozen': {
      // Бесплатные 24ч истекли без выполнения условия — предложение страховки (§3.3).
      return { state: { ...state, phase: 'awaiting_insurance' }, monthlyUsage, outcome }
    }
    case 'awaiting_insurance': {
      if (input.insurancePaid) {
        return { state: { ...state, phase: 'insured' }, monthlyUsage, outcome }
      }
      // Вторые сутки без оплаты — стрик обнуляется, best_streak сохранён (§3.3/RC4).
      return {
        state: { streakDays: 0, bestStreak: Math.max(state.bestStreak, state.streakDays), phase: 'broken' },
        monthlyUsage,
        outcome,
      }
    }
    case 'insured':
    case 'broken': {
      // Оплаченное продление тоже истекло без выполнения — обвал (§3.3).
      return {
        state: { streakDays: 0, bestStreak: Math.max(state.bestStreak, state.streakDays), phase: 'broken' },
        monthlyUsage,
        outcome,
      }
    }
    default: {
      return { state, monthlyUsage, outcome }
    }
  }
}

/** Переводит стрик в `vacation` (Gone Fishin', §3.5) — сохраняет streakDays/bestStreak как есть. */
export function enterVacation(state: StreakEngineState): StreakEngineState {
  return { ...state, phase: 'vacation' }
}

/** Выход из отпуска — восстанавливает `active` с того состояния, на котором был заморожен (§3.5). */
export function exitVacation(state: StreakEngineState): StreakEngineState {
  if (state.phase !== 'vacation') return state
  return { ...state, phase: 'active' }
}
