/**
 * boostCaps.test.ts — мастер-таблица дневных кэпов бустеров (14-economy §4.7, R5).
 */
import { describe, it, expect } from 'vitest'
import {
  BOOST_POOL_DAILY_CAP,
  FERTILIZER_DAILY_CAP,
  OVERTIME_DAILY_CAP,
  RUSH_DAILY_CAP,
  poolBoosterDailyCap,
  boostPoolRemaining,
  canActivatePoolBoost,
} from './boostCaps'

describe('мастер-числа §4.7', () => {
  it('пул/штучные кэпы совпадают со спекой', () => {
    expect(BOOST_POOL_DAILY_CAP).toBe(6)
    expect(FERTILIZER_DAILY_CAP).toBe(4)
    expect(OVERTIME_DAILY_CAP).toBe(3)
    expect(RUSH_DAILY_CAP).toBe(1)
  })

  it('поштучные кэпы в сумме (4+3+1=8) превышают пул (6) — пул должен побеждать', () => {
    expect(FERTILIZER_DAILY_CAP + OVERTIME_DAILY_CAP + RUSH_DAILY_CAP).toBeGreaterThan(
      BOOST_POOL_DAILY_CAP,
    )
  })
})

describe('poolBoosterDailyCap', () => {
  it('возвращает штучный кэп по виду бустера', () => {
    expect(poolBoosterDailyCap('fertilizer')).toBe(FERTILIZER_DAILY_CAP)
    expect(poolBoosterDailyCap('overtime')).toBe(OVERTIME_DAILY_CAP)
    expect(poolBoosterDailyCap('rush')).toBe(RUSH_DAILY_CAP)
  })
})

describe('boostPoolRemaining', () => {
  it('убывает по мере использования пула', () => {
    expect(boostPoolRemaining(0)).toBe(6)
    expect(boostPoolRemaining(4)).toBe(2)
  })
  it('не уходит в минус при переиспользовании пула', () => {
    expect(boostPoolRemaining(9)).toBe(0)
  })
  it('отрицательный вход трактуется как 0 использовано', () => {
    expect(boostPoolRemaining(-3)).toBe(6)
  })
})

describe('canActivatePoolBoost — пул побеждает штучный кэп (R5)', () => {
  it('Fertilizer(4) в одиночку разрешён, пока не выбран пул', () => {
    expect(canActivatePoolBoost('fertilizer', 3, 3)).toBe(true)
  })
  it('Fertilizer заблокирован своим штучным кэпом (4/день), даже если пул свободен', () => {
    expect(canActivatePoolBoost('fertilizer', 4, 4)).toBe(false)
  })
  it('пример спеки: Fertilizer 4 + Overtime 3 = 7 > пул 6 → 4-я активация overtime блокируется пулом', () => {
    // игрок уже потратил 4 (fertilizer) + 2 (overtime) = 6 из пула сегодня
    expect(canActivatePoolBoost('overtime', 2, 6)).toBe(false)
  })
  it('Rush(1) блокируется после первой активации своим штучным кэпом', () => {
    expect(canActivatePoolBoost('rush', 0, 0)).toBe(true)
    expect(canActivatePoolBoost('rush', 1, 1)).toBe(false)
  })
})
