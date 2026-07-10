/**
 * @vitest-environment jsdom
 *
 * Boosters.test.tsx — рендер 4 бустеров с дневным кэпом, dev-эмуляция платежа, кэп
 * блокирует кнопку после исчерпания (витринный счётчик, `state/shop.ts`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { Boosters } from './Boosters'
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

describe('Boosters (§3.4)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 5000, tickets: 0, ribbons: 0 })
    useStore.setState({ shop: { prizePity: {}, scrap: 0, boosterUsageToday: {} } })
  })

  it('рендерит 4 бустера с кэпом дня', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <Boosters />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('booster-bst_overtime')).toBeTruthy()
    expect(screen.getByTestId('booster-bst_truck_contract')).toBeTruthy()
    expect(screen.getByTestId('booster-cap-bst_truck_contract').textContent).toContain('1/1')
  })

  it('OK в dev-диалоге вызывает purchaseDecor и уменьшает "осталось сегодня"', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <Boosters />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('booster-buy-bst_truck_contract'))
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() => expect(systems.collection.purchaseDecor).toHaveBeenCalledWith('bst_truck_contract'))
    await waitFor(() => expect(screen.getByTestId('booster-cap-bst_truck_contract').textContent).toContain('0/1'))
    expect((screen.getByTestId('booster-buy-bst_truck_contract') as HTMLButtonElement).disabled).toBe(true)
  })
})
