import { describe, expect, it } from 'vitest'
import type { EpochMs } from '@/types'
import {
  advanceStreakDay,
  dailyOutcome,
  enterVacation,
  exitVacation,
  initialMonthlyUsage,
  initialStreakState,
  resetMonthlyUsageIfNeeded,
  streakBonusPct,
  streakInsurancePriceTickets,
  utcMonthKey,
  type MonthlyFreezeUsage,
  type StreakEngineState,
} from './streak'

const DAY_MS = 24 * 60 * 60 * 1000
const JAN_1_2026_UTC = Date.UTC(2026, 0, 1)

describe('streakBonusPct (§4.2)', () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, 0.1],
    [6, 0.1],
    [7, 0.18],
    [13, 0.18],
    [14, 0.26],
    [20, 0.26],
    [21, 0.34],
    [29, 0.34],
    [30, 0.4],
    [999, 0.4],
  ])('день %i → бонус %f', (days, expected) => {
    expect(streakBonusPct(days)).toBeCloseTo(expected)
  })
})

describe('streakInsurancePriceTickets (§4.3)', () => {
  it.each([
    [1, 2],
    [6, 2],
    [7, 4],
    [13, 4],
    [14, 6],
    [20, 6],
    [21, 8],
    [29, 8],
    [30, 10],
    [500, 10],
  ])('день %i → цена страховки %i 🎟', (days, expected) => {
    expect(streakInsurancePriceTickets(days)).toBe(expected)
  })
})

describe('dailyOutcome (§4.1)', () => {
  it('0 или 1 выполнено — день не засчитан, без бонуса и без тикетов', () => {
    for (const n of [0, 1] as const) {
      const outcome = dailyOutcome(n)
      expect(outcome.streakTicked).toBe(false)
      expect(outcome.bonusBucks).toBe(0)
      expect(outcome.ticketChance).toBe(0)
      expect(outcome.ticketGuaranteed).toBe(false)
    }
  })

  it('ровно 2/3 — день засчитан, +$40, шанс 20% на 🎟, не гарантирован', () => {
    const outcome = dailyOutcome(2)
    expect(outcome.streakTicked).toBe(true)
    expect(outcome.bonusBucks).toBe(40)
    expect(outcome.ticketChance).toBeCloseTo(0.2)
    expect(outcome.ticketGuaranteed).toBe(false)
  })

  it('3/3 — день засчитан, +$40, 🎟 гарантирован (не суммируется с шансом 2/3)', () => {
    const outcome = dailyOutcome(3)
    expect(outcome.streakTicked).toBe(true)
    expect(outcome.bonusBucks).toBe(40)
    expect(outcome.ticketGuaranteed).toBe(true)
    expect(outcome.ticketChance).toBe(0)
  })
})

describe('utcMonthKey / resetMonthlyUsageIfNeeded (§3.3)', () => {
  it('форматирует YYYY-MM в UTC', () => {
    expect(utcMonthKey(JAN_1_2026_UTC)).toBe('2026-01')
  })

  it('не сбрасывает счётчик внутри того же месяца', () => {
    const usage: MonthlyFreezeUsage = { monthKey: '2026-01', freeFreezesUsed: 1 }
    const result = resetMonthlyUsageIfNeeded(usage, JAN_1_2026_UTC + 15 * DAY_MS)
    expect(result).toEqual(usage)
  })

  it('сбрасывает счётчик 1-го числа следующего месяца UTC', () => {
    const usage: MonthlyFreezeUsage = { monthKey: '2026-01', freeFreezesUsed: 2 }
    const result = resetMonthlyUsageIfNeeded(usage, Date.UTC(2026, 1, 1))
    expect(result).toEqual({ monthKey: '2026-02', freeFreezesUsed: 0 })
  })
})

describe('advanceStreakDay — конечный автомат (§3.3)', () => {
  function day(n: number): EpochMs {
    return JAN_1_2026_UTC + n * DAY_MS
  }

  it('выполнение ≥2/3 каждый день тикает стрик и обновляет best_streak', () => {
    let state = initialStreakState()
    let usage = initialMonthlyUsage(utcMonthKey(JAN_1_2026_UTC))
    for (let i = 0; i < 5; i++) {
      const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 2, now: day(i) })
      state = res.state
      usage = res.monthlyUsage
    }
    expect(state.streakDays).toBe(5)
    expect(state.bestStreak).toBe(5)
    expect(state.phase).toBe('active')
  })

  it('пропуск дня — бесплатная заморозка на 24ч, стрик НЕ сбрасывается (§3.3)', () => {
    const state: StreakEngineState = { streakDays: 5, bestStreak: 5, phase: 'active' }
    const usage = initialMonthlyUsage(utcMonthKey(day(0)))
    const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0) })
    expect(res.state.phase).toBe('frozen')
    expect(res.state.streakDays).toBe(5) // не сброшен
    expect(res.monthlyUsage.freeFreezesUsed).toBe(1)
  })

  it('второй пропуск подряд после заморозки — переход к обязательной страховке', () => {
    let state: StreakEngineState = { streakDays: 5, bestStreak: 5, phase: 'active' }
    let usage = initialMonthlyUsage(utcMonthKey(day(0)))
    let res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0) })
    state = res.state
    usage = res.monthlyUsage
    expect(state.phase).toBe('frozen')

    res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(1) })
    expect(res.state.phase).toBe('awaiting_insurance')
    expect(res.state.streakDays).toBe(5) // всё ещё не сброшен — есть шанс оплатить
  })

  it('не оплатил страховку — стрик сбрасывается до 0, best_streak сохраняется (§3.3/RC4)', () => {
    const state: StreakEngineState = { streakDays: 32, bestStreak: 32, phase: 'awaiting_insurance' }
    const usage = initialMonthlyUsage(utcMonthKey(day(0)))
    const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0), insurancePaid: false })
    expect(res.state.phase).toBe('broken')
    expect(res.state.streakDays).toBe(0)
    expect(res.state.bestStreak).toBe(32)
  })

  it('оплатил страховку — продлевает ещё на 24ч (переходит в insured), стрик не рушится сразу', () => {
    const state: StreakEngineState = { streakDays: 10, bestStreak: 10, phase: 'awaiting_insurance' }
    const usage = initialMonthlyUsage(utcMonthKey(day(0)))
    const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0), insurancePaid: true })
    expect(res.state.phase).toBe('insured')
    expect(res.state.streakDays).toBe(10)
  })

  it('оплаченное продление тоже пропущено — обвал (нет бесконечной страховки)', () => {
    const state: StreakEngineState = { streakDays: 10, bestStreak: 10, phase: 'insured' }
    const usage = initialMonthlyUsage(utcMonthKey(day(0)))
    const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0) })
    expect(res.state.phase).toBe('broken')
    expect(res.state.streakDays).toBe(0)
  })

  it('успешное выполнение из любой фазы (frozen/awaiting_insurance/insured/broken) возвращает в active и тикает', () => {
    for (const phase of ['frozen', 'awaiting_insurance', 'insured', 'broken'] as const) {
      const state: StreakEngineState = { streakDays: 3, bestStreak: 5, phase }
      const usage = initialMonthlyUsage(utcMonthKey(day(0)))
      const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 2, now: day(0) })
      expect(res.state.phase).toBe('active')
      expect(res.state.streakDays).toBe(4)
    }
  })

  it('не более 2 бесплатных заморозок в календарный месяц — 3-й пропуск в месяце сразу требует страховку', () => {
    let usage = initialMonthlyUsage(utcMonthKey(day(0)))
    // Заморозка 1: active → frozen (использует бесплатную), сразу выполняет день → active снова.
    let state: StreakEngineState = { streakDays: 1, bestStreak: 1, phase: 'active' }
    let res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0) })
    state = res.state
    usage = res.monthlyUsage
    expect(state.phase).toBe('frozen')
    expect(usage.freeFreezesUsed).toBe(1)

    res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 2, now: day(1) })
    state = res.state
    usage = res.monthlyUsage
    expect(state.phase).toBe('active')

    // Заморозка 2 (тот же месяц) — снова бесплатно.
    res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(2) })
    state = res.state
    usage = res.monthlyUsage
    expect(state.phase).toBe('frozen')
    expect(usage.freeFreezesUsed).toBe(2)

    res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 2, now: day(3) })
    state = res.state
    usage = res.monthlyUsage
    expect(state.phase).toBe('active')

    // Заморозка 3 (тот же месяц, кап исчерпан) — сразу awaiting_insurance, без бесплатной заморозки.
    res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(4) })
    expect(res.state.phase).toBe('awaiting_insurance')
    expect(res.monthlyUsage.freeFreezesUsed).toBe(2) // не увеличился — эта заморозка не бесплатная
  })

  it('vacation — стрик полностью заморожен, ролловер не двигает состояние (§3.5, RC14)', () => {
    const state: StreakEngineState = { streakDays: 8, bestStreak: 8, phase: 'vacation' }
    const usage = initialMonthlyUsage(utcMonthKey(day(0)))
    const res = advanceStreakDay({ state, monthlyUsage: usage, doneCount: 0, now: day(0) })
    expect(res.state).toEqual(state)
    expect(res.monthlyUsage).toEqual(usage)
  })
})

describe('enterVacation / exitVacation (§3.5)', () => {
  it('enterVacation переводит active в vacation, сохраняя streakDays', () => {
    const state: StreakEngineState = { streakDays: 12, bestStreak: 12, phase: 'active' }
    const result = enterVacation(state)
    expect(result.phase).toBe('vacation')
    expect(result.streakDays).toBe(12)
  })

  it('exitVacation восстанавливает active с того streakDays, на котором был заморожен', () => {
    const state: StreakEngineState = { streakDays: 12, bestStreak: 12, phase: 'vacation' }
    const result = exitVacation(state)
    expect(result.phase).toBe('active')
    expect(result.streakDays).toBe(12)
  })

  it('exitVacation — no-op вне vacation', () => {
    const state: StreakEngineState = { streakDays: 12, bestStreak: 12, phase: 'active' }
    expect(exitVacation(state)).toEqual(state)
  })
})
