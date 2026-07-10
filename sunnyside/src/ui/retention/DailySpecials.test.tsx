/**
 * @vitest-environment jsdom
 *
 * DailySpecials.test.tsx — Доска Sheriff Roy (`ui_daily_specials`, 16-retention §3.1/§3.2).
 * Компонент генерирует набор чисто клиентски (см. `./shared.ts`) — тест не мокает сеть,
 * только фиксирует `serverOffset`/`farm` в сторе, чтобы генерация была детерминирована.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useStore } from '@/state'
import type { FarmSnapshot } from '@/types'
import { DailySpecials } from './DailySpecials'

const baseFarm: FarmSnapshot = {
  farmId: 'farm_me',
  farmLevel: 1,
  plots: [],
  buildings: {},
  machines: [],
  animals: [],
  farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
}

function resetStore() {
  useStore.getState().openPanel(null)
  useStore.setState((s) => ({
    ui: { ...s.ui, locale: 'ru', dailySpecialsSeenDay: null },
    farm: baseFarm,
    clock: { ...s.clock, serverOffset: 0 },
  }))
}

describe('DailySpecials (16-retention §3.1)', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('рендерит ровно 3 задачи дня + таймер + таблицу наград', () => {
    render(<DailySpecials />)
    expect(screen.getByTestId('ui-daily-specials')).toBeTruthy()
    expect(screen.getByTestId('daily-specials-countdown')).toBeTruthy()
    // 3 задачи (§3.1 «три задачи дня») — anti-repeat гарантирует непустой набор с полным пулом.
    const items = screen.getAllByTestId(/^daily-special-/)
    expect(items.length).toBe(3)
  })

  it('одна и та же ферма/день — одинаковый набор при повторном рендере (детерминизм)', () => {
    const { unmount } = render(<DailySpecials />)
    const first = screen.getAllByTestId(/^daily-special-/).map((el) => el.getAttribute('data-testid'))
    unmount()
    render(<DailySpecials />)
    const second = screen.getAllByTestId(/^daily-special-/).map((el) => el.getAttribute('data-testid'))
    expect(second).toEqual(first)
  })

  it('открытие панели помечает сегодняшний день просмотренным (снимает бейдж)', () => {
    useStore.getState().openPanel('ui_daily_specials')
    render(<DailySpecials />)
    expect(useStore.getState().ui.dailySpecialsSeenDay).not.toBeNull()
  })
})
