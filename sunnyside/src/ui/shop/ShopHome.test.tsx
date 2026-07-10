/**
 * @vitest-environment jsdom
 *
 * ShopHome.test.tsx — таб-переключатель Cosmetics/Boosters/Bundles/Dimes (19-ui-ux §4.2).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { ShopHome } from './ShopHome'
import { ShopSystemProvider } from './ShopSystemContext'

function makeSystems() {
  const collection: CollectionSystem = {
    pullPrize: vi.fn(async () => ({ ok: true, data: { results: [], pityAfter: { series: 'toy_cosmos_57', pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 } } }) as never),
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined }) as never),
  }
  const monetization: MonetizationSystem = { verifyPurchase: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 0 } }) as never) }
  return { collection, monetization }
}

describe('ShopHome', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 100, tickets: 0, ribbons: 0 })
  })

  it('по умолчанию открыт таб Cosmetics', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <ShopHome />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('ui-cosmetics-shop')).toBeTruthy()
  })

  it('переключение на таб Dimes рендерит DimesShop', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <ShopHome />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('shop-tab-dimes'))
    expect(screen.getByTestId('ui-dimes-shop')).toBeTruthy()
    expect(screen.queryByTestId('ui-cosmetics-shop')).toBeNull()
  })
})
