/**
 * store.test.ts — конечный автомат FTUE (18-onboarding §2/§3.2/§3.7). Node-env:
 * persist(localStorage) деградирует молча (как корневой стор), тестируем переходы.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useFtueStore, DEFAULT_FARM_NAME } from './store'
import { MINI_WEEK_STEPS } from './scenario'

const s = () => useFtueStore.getState()

describe('FTUE store', () => {
  beforeEach(() => {
    s().reset()
  })

  it('стартовая фаза — письмо, шаг 0', () => {
    expect(s().phase).toBe('letter')
    expect(s().step).toBe(0)
    expect(s().farmName).toBe(DEFAULT_FARM_NAME)
  })

  it('пустое имя фермы откатывается к дефолту', () => {
    s().setFarmName('Марс')
    expect(s().farmName).toBe('Марс')
    s().setFarmName('   ')
    expect(s().farmName).toBe(DEFAULT_FARM_NAME)
  })

  it('setAvatar меняет пресет', () => {
    s().setAvatar('denim')
    expect(s().avatar).toBe('denim')
  })

  it('startMiniWeek → фаза mini_week, шаг 0', () => {
    s().startMiniWeek()
    expect(s().phase).toBe('mini_week')
    expect(s().step).toBe(0)
  })

  it('advanceStep идёт по шагам и на последнем выпускает', () => {
    s().startMiniWeek()
    for (let i = 0; i < MINI_WEEK_STEPS.length - 1; i++) {
      s().advanceStep()
      expect(s().step).toBe(i + 1)
      expect(s().phase).toBe('mini_week')
    }
    // Последний шаг → выпуск.
    s().advanceStep()
    expect(s().phase).toBe('released')
  })

  it('skip → выпуск, флаг skipped, шаг на последнем (§3.7)', () => {
    s().skip()
    expect(s().phase).toBe('released')
    expect(s().skipped).toBe(true)
    expect(s().step).toBe(MINI_WEEK_STEPS.length - 1)
  })

  it('joinStreet и finish завершают флоу', () => {
    s().skip()
    s().joinStreet()
    expect(s().streetJoined).toBe(true)
    s().finish()
    expect(s().phase).toBe('done')
  })
})
