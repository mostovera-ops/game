/**
 * @vitest-environment jsdom
 *
 * DimesShop.test.tsx — единственная реал-транзакция монетизации (§9): dev-эмуляция
 * платежа → `MonetizationSystem.verifyPurchase` → toast с зачисленной суммой.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { DimesShop } from './DimesShop'
import { ShopSystemProvider } from './ShopSystemContext'

function makeSystems(overrides: Partial<MonetizationSystem> = {}) {
  const collection: CollectionSystem = {
    pullPrize: vi.fn(async () => ({ ok: true, data: { results: [], pityAfter: { series: 'toy_cosmos_57', pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 } } }) as never),
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined }) as never),
  }
  const monetization: MonetizationSystem = {
    verifyPurchase: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 740 } }) as never),
    ...overrides,
  }
  return { collection, monetization }
}

describe('DimesShop (§9)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 0, tickets: 0, ribbons: 0 })
  })

  it('рендерит 6 пакетов', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <DimesShop />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('dimes-package-dimes_sack')).toBeTruthy()
    expect(screen.getByTestId('dimes-package-dimes_boxcar_deluxe')).toBeTruthy()
  })

  it('OK в dev-диалоге вызывает verifyPurchase с sku пакета и показывает toast зачисления', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <DimesShop />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('dimes-package-buy-dimes_sack'))
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() =>
      expect(systems.monetization.verifyPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'dimes_sack', provider: 'web' }),
      ),
    )
    await waitFor(() => expect(useStore.getState().ui.toasts.some((t) => t.kind === 'success')).toBe(true))
  })

  it('FAIL в dev-диалоге не вызывает verifyPurchase', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <DimesShop />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('dimes-package-buy-dimes_handful'))
    fireEvent.click(screen.getByTestId('dev-payment-fail'))
    await waitFor(() => expect(screen.queryByTestId('dev-payment-dialog')).toBeNull())
    expect(systems.monetization.verifyPurchase).not.toHaveBeenCalled()
  })
})
