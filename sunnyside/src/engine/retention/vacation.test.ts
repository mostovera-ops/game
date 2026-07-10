import { describe, expect, it } from 'vitest'
import {
  isVacationActive,
  resolveNeighborSit,
  validateVacationStart,
  vacationEndAt,
  vacationReactivationCooldownEndsAt,
} from './vacation'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 6, 9)

describe('validateVacationStart (§3.5)', () => {
  it('принимает длительность в диапазоне 3–30 дней', () => {
    for (const days of [3, 10, 30]) {
      const result = validateVacationStart({ requestedDays: days, hasActiveVacation: false, now: NOW })
      expect(result).toEqual({ ok: true, value: { days } })
    }
  })

  it('отклоняет длительность вне 3–30 дней', () => {
    for (const days of [0, 1, 2, 31, 100, -5]) {
      const result = validateVacationStart({ requestedDays: days, hasActiveVacation: false, now: NOW })
      expect(result).toEqual({ ok: false, error: 'duration_out_of_range' })
    }
  })

  it('отклоняет нецелые дни', () => {
    const result = validateVacationStart({ requestedDays: 5.5, hasActiveVacation: false, now: NOW })
    expect(result).toEqual({ ok: false, error: 'duration_out_of_range' })
  })

  it('не более 1 активного Gone Fishin одновременно', () => {
    const result = validateVacationStart({ requestedDays: 5, hasActiveVacation: true, now: NOW })
    expect(result).toEqual({ ok: false, error: 'already_active' })
  })

  it('требует ≥24ч простоя на реальной ферме после предыдущего отпуска', () => {
    const cooldownEndsAt = NOW + DAY_MS
    const tooEarly = validateVacationStart({
      requestedDays: 5,
      hasActiveVacation: false,
      cooldownEndsAt,
      now: NOW,
    })
    expect(tooEarly).toEqual({ ok: false, error: 'cooldown' })

    const afterCooldown = validateVacationStart({
      requestedDays: 5,
      hasActiveVacation: false,
      cooldownEndsAt,
      now: cooldownEndsAt,
    })
    expect(afterCooldown).toEqual({ ok: true, value: { days: 5 } })
  })
})

describe('vacationEndAt / isVacationActive', () => {
  it('считает конец отпуска как start + days*24ч', () => {
    expect(vacationEndAt(NOW, 10)).toBe(NOW + 10 * DAY_MS)
  })

  it('активен в полуинтервале [start, end)', () => {
    expect(isVacationActive(NOW, 10, NOW)).toBe(true)
    expect(isVacationActive(NOW, 10, NOW + 5 * DAY_MS)).toBe(true)
    expect(isVacationActive(NOW, 10, NOW + 10 * DAY_MS)).toBe(false)
    expect(isVacationActive(NOW, 10, NOW - 1)).toBe(false)
  })
})

describe('vacationReactivationCooldownEndsAt', () => {
  it('добавляет 24ч анти-абьюз кулдауна после завершения', () => {
    expect(vacationReactivationCooldownEndsAt(NOW)).toBe(NOW + DAY_MS)
  })
})

describe('resolveNeighborSit (§4.4/RC5/§3.9)', () => {
  it('запрещает присмотр за собственной фермой (§3.9 sitter_id != farm_owner_id)', () => {
    const result = resolveNeighborSit('user_1', 'user_1', false)
    expect(result).toEqual({ ok: false, error: 'self_sit_forbidden' })
  })

  it('первый присмотр за игровой день оплачивается 🎟 1 + $10', () => {
    const result = resolveNeighborSit('user_2', 'user_1', false)
    expect(result).toEqual({ ok: true, value: { paid: true, ticketReward: 1, bucksReward: 10 } })
  })

  it('второй и последующие соседи в тот же день на ту же ферму — только косметика, без валюты (RC5)', () => {
    const result = resolveNeighborSit('user_3', 'user_1', true)
    expect(result).toEqual({ ok: true, value: { paid: false, ticketReward: 0, bucksReward: 0 } })
  })
})
