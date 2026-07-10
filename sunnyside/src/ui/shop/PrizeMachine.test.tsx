/**
 * @vitest-environment jsdom
 *
 * PrizeMachine.test.tsx — открытый pity, дневной free-пулл без dev-диалога, платный
 * пулл через dev-эмуляцию, дубль→⚙ scrap, обменник. Мокаем `ShopSystems` (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { PrizeMachine } from './PrizeMachine'
import { ShopSystemProvider } from './ShopSystemContext'

function makeSystems(overrides: Partial<CollectionSystem> = {}) {
  const collection: CollectionSystem = {
    pullPrize: vi.fn(
      async () =>
        ({
          ok: true,
          data: {
            results: [{ toyKey: 'toy_highway_dinos_01', rarity: 'common', duplicate: true }],
            pityAfter: { series: 'toy_highway_dinos', pullsSinceRare: 1, pullsSinceChase: 1, rareCap: 10, chaseCap: 40 },
          },
        }) as never,
    ),
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    ...overrides,
  }
  const monetization: MonetizationSystem = { verifyPurchase: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 0 } }) as never) }
  return { collection, monetization }
}

describe('PrizeMachine (§3.3)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 5000, tickets: 0, ribbons: 0 })
    useStore.setState({ shop: { prizePity: {}, scrap: 0, boosterUsageToday: {} } })
  })

  it('открытый pity виден по умолчанию (10/40 до гарантий)', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <PrizeMachine />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('prize-pity-rare').textContent).toBe('10')
    expect(screen.getByTestId('prize-pity-chase').textContent).toBe('40')
  })

  it('бесплатный пулл дня НЕ открывает dev-диалог и вызывает pullPrize сразу', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <PrizeMachine />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('prize-pull-free'))
    expect(screen.queryByTestId('dev-payment-dialog')).toBeNull()
    await waitFor(() => expect(systems.collection.pullPrize).toHaveBeenCalledWith({ seriesKey: 'toy_highway_dinos', count: 1 }))
  })

  it('платный пулл ×1 идёт через dev-эмуляцию, дубль пополняет ⚙ scrap', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <PrizeMachine />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('prize-pull-1'))
    expect(screen.getByTestId('dev-payment-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() => expect(systems.collection.pullPrize).toHaveBeenCalledWith({ seriesKey: 'toy_highway_dinos', count: 1 }))
    await waitFor(() => expect(screen.getByTestId('prize-scrap-balance').textContent).toBe('⚙ 2'))
    expect(screen.getByTestId('prize-pity-rare').textContent).toBe('9')
  })

  it('FAIL в dev-диалоге не вызывает pullPrize', async () => {
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <PrizeMachine />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('prize-pull-10'))
    fireEvent.click(screen.getByTestId('dev-payment-fail'))
    await waitFor(() => expect(screen.queryByTestId('dev-payment-dialog')).toBeNull())
    expect(systems.collection.pullPrize).not.toHaveBeenCalled()
  })

  it('обменник отказывает при нехватке scrap', () => {
    render(
      <ShopSystemProvider value={makeSystems()}>
        <PrizeMachine />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('prize-exchange-common'))
    expect(useStore.getState().ui.toasts.some((t) => t.message.includes('Scrap'))).toBe(true)
  })
})
