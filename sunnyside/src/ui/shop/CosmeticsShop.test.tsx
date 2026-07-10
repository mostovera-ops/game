/**
 * @vitest-environment jsdom
 *
 * CosmeticsShop.test.tsx — рендер сеток по сетам + dev-эмуляция платежа перед покупкой
 * SKU/Full-Set. Мокаем `ShopSystems` (DI) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { CosmeticsShop } from './CosmeticsShop'
import { ShopSystemProvider } from './ShopSystemContext'

function makeSystems(overrides: Partial<CollectionSystem> = {}) {
  const collection: CollectionSystem = {
    pullPrize: vi.fn(async () => ({ ok: true, data: { results: [], pityAfter: { series: 'toy_cosmos_57', pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 } } }) as never),
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    ...overrides,
  }
  const monetization: MonetizationSystem = {
    verifyPurchase: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 320 } }) as never),
  }
  return { collection, monetization }
}

describe('CosmeticsShop (§3.2)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 5000, tickets: 0, ribbons: 0 })
  })

  it('рендерит 4 сета с SKU', () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <CosmeticsShop />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('cosmetic-set-cos_googie')).toBeTruthy()
    expect(screen.getByTestId('cosmetic-set-cos_chrome')).toBeTruthy()
    expect(screen.getByTestId('cosmetic-set-cos_tiki')).toBeTruthy()
    expect(screen.getByTestId('cosmetic-set-cos_xmas_55')).toBeTruthy()
  })

  it('OK в dev-диалоге вызывает purchaseDecor с ключом SKU', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <CosmeticsShop />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('cosmetic-item-buy-cos_googie_accent_starburst_stars'))
    expect(screen.getByTestId('dev-payment-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() =>
      expect(systems.collection.purchaseDecor).toHaveBeenCalledWith('cos_googie_accent_starburst_stars'),
    )
  })

  it('FAIL в dev-диалоге НЕ вызывает purchaseDecor', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <CosmeticsShop />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('cosmetic-set-buy-full-cos_chrome'))
    fireEvent.click(screen.getByTestId('dev-payment-fail'))
    await waitFor(() => expect(screen.queryByTestId('dev-payment-dialog')).toBeNull())
    expect(systems.collection.purchaseDecor).not.toHaveBeenCalled()
  })
})
