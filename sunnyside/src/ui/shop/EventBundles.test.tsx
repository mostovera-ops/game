/**
 * @vitest-environment jsdom
 *
 * EventBundles.test.tsx — окно продажи Пт–Сб гейтится серверной фазой `clock.calendar`
 * (21-client §3.6 — клиент не решает фазу сам), вне окна покупка недоступна.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { EventBundles } from './EventBundles'
import { ShopSystemProvider } from './ShopSystemContext'

function makeSystems(overrides: Partial<CollectionSystem> = {}) {
  const collection: CollectionSystem = {
    pullPrize: vi.fn(async () => ({ ok: true, data: { results: [], pityAfter: { series: 'toy_cosmos_57', pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 } } }) as never),
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    ...overrides,
  }
  const monetization: MonetizationSystem = { verifyPurchase: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 0 } }) as never) }
  return { collection, monetization }
}

function seedCalendar(phase: 'mon_plan' | 'fri_prep' | 'sat_fair') {
  useStore.getState().setCalendar({
    townId: 't1',
    weekIndex: 1,
    phase,
    rolloverAt: 0,
    fairWindow: { opensAt: 0, closesAt: 0 },
    coopDeadlineAt: 0,
    eventFinalAt: 0,
  })
}

describe('EventBundles (§3.5)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 5000, tickets: 0, ribbons: 0 })
  })

  it('вне окна Пт–Сб — покупка заблокирована', () => {
    seedCalendar('mon_plan')
    render(
      <ShopSystemProvider value={makeSystems()}>
        <EventBundles />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('event-bundles-closed')).toBeTruthy()
    expect((screen.getByTestId('event-bundle-buy-bundle_starter_basket') as HTMLButtonElement).disabled).toBe(true)
  })

  it('в окне (fri_prep) покупка доступна и OK вызывает purchaseDecor', async () => {
    seedCalendar('fri_prep')
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <EventBundles />
      </ShopSystemProvider>,
    )
    expect(screen.queryByTestId('event-bundles-closed')).toBeNull()
    fireEvent.click(screen.getByTestId('event-bundle-buy-bundle_starter_basket'))
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() => expect(systems.collection.purchaseDecor).toHaveBeenCalledWith('bundle_starter_basket'))
  })
})
