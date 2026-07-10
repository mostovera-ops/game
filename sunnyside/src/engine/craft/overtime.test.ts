/**
 * overtime.test.ts — `mech_overtime` (04-machines.md §3.8/§4.5): +1 слот на 24ч, кэп
 * 3/сутки, цена по уровню станка.
 */
import { describe, it, expect } from 'vitest'
import {
  OVERTIME_DAILY_CAP,
  OVERTIME_DURATION_MS,
  overtimeCost,
  isOvertimeActive,
  overtimeExpiresAt,
  canActivateOvertime,
} from './overtime'

describe('overtimeCost — цена по уровню станка (§4.5)', () => {
  it('Ур.1–2 → 15 ◉', () => {
    expect(overtimeCost(1)).toBe(15)
    expect(overtimeCost(2)).toBe(15)
  })
  it('Ур.3–4 → 25 ◉', () => {
    expect(overtimeCost(3)).toBe(25)
    expect(overtimeCost(4)).toBe(25)
  })
  it('Ур.5 → 40 ◉', () => {
    expect(overtimeCost(5)).toBe(40)
  })
})

describe('isOvertimeActive / overtimeExpiresAt — дедлайн 24ч, не отсчёт (21-client §3.6)', () => {
  const activatedAt = 1_000_000

  it('слот активен сразу после покупки', () => {
    expect(isOvertimeActive({ activatedAt }, activatedAt)).toBe(true)
  })

  it('слот активен за миллисекунду до истечения', () => {
    expect(isOvertimeActive({ activatedAt }, activatedAt + OVERTIME_DURATION_MS - 1)).toBe(true)
  })

  it('слот истёк ровно в дедлайн (без возврата, M4)', () => {
    expect(isOvertimeActive({ activatedAt }, activatedAt + OVERTIME_DURATION_MS)).toBe(false)
  })

  it('слот истёк далеко после дедлайна', () => {
    expect(isOvertimeActive({ activatedAt }, activatedAt + OVERTIME_DURATION_MS * 3)).toBe(false)
  })

  it('отсутствие слота — не активен', () => {
    expect(isOvertimeActive(undefined, activatedAt)).toBe(false)
  })

  it('overtimeExpiresAt = activatedAt + 24ч', () => {
    expect(overtimeExpiresAt({ activatedAt })).toBe(activatedAt + OVERTIME_DURATION_MS)
  })
})

describe('canActivateOvertime — штучный кэп 3/сутки + общий пул 6/день (§4.5, §4.7)', () => {
  it('кэп равен 3 (мастер-число из boostCaps)', () => {
    expect(OVERTIME_DAILY_CAP).toBe(3)
  })
  it('разрешено ниже обоих кэпов', () => {
    expect(canActivateOvertime(0, 0)).toBe(true)
    expect(canActivateOvertime(2, 5)).toBe(true)
  })
  it('запрещено на штучном кэпе и выше', () => {
    expect(canActivateOvertime(3, 3)).toBe(false)
    expect(canActivateOvertime(4, 4)).toBe(false)
  })
  it('запрещено при исчерпанном общем пуле, даже если штучный кэп не достигнут', () => {
    expect(canActivateOvertime(0, 6)).toBe(false)
  })
})
