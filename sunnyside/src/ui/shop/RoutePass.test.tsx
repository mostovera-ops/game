/**
 * @vitest-environment jsdom
 *
 * RoutePass.test.tsx — рендер лестницы 50 уровней (только вехи в каталоге), unlock
 * Route Club через dev-эмуляцию платежа, claim-кнопки заблокированы без серверного RPC.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { RoutePass } from './RoutePass'
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

function seedProgression(overrides: Partial<{ tier: number; xp: number; track: 'free' | 'premium' }> = {}) {
  useStore.getState().setProgression({
    farmId: 'f1',
    farmLevel: 1,
    xp: 0,
    knowHow: { points: 0, activeSlots: 1, nodes: {} },
    staff: {},
    routePass: {
      season: 1,
      tier: overrides.tier ?? 3,
      xp: overrides.xp ?? 600,
      track: overrides.track ?? 'free',
      claimedFree: [],
      claimedPremium: [],
    },
    streak: { streakDays: 0, state: 'active' },
    staffTokens: 0,
  })
}

describe('RoutePass (§3.1)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setWallet({ bucks: 0, dimes: 5000, tickets: 0, ribbons: 0 })
  })

  it('пустое состояние без прогрессии', () => {
    useStore.setState({ progression: null })
    render(
      <ShopSystemProvider value={makeSystems()}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('route-pass-empty')).toBeTruthy()
  })

  it('рендерит тир игрока и веху уровня 5', () => {
    seedProgression({ tier: 3 })
    render(
      <ShopSystemProvider value={makeSystems()}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    expect(screen.getByTestId('route-pass-tier').textContent).toBe('3/50')
    expect(screen.getByTestId('route-pass-tier-5')).toBeTruthy()
  })

  it('claim заблокирован для не-достигнутого уровня', () => {
    seedProgression({ tier: 3 })
    render(
      <ShopSystemProvider value={makeSystems()}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    const claim5 = screen.getByTestId('route-pass-claim-free-5') as HTMLButtonElement
    expect(claim5.disabled).toBe(true)
  })

  it('claim заблокирован даже для достигнутого уровня (нет серверного RPC ещё)', () => {
    seedProgression({ tier: 5 })
    render(
      <ShopSystemProvider value={makeSystems()}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    const claim5 = screen.getByTestId('route-pass-claim-free-5') as HTMLButtonElement
    expect(claim5.disabled).toBe(true)
  })

  it('OK в dev-диалоге разблокировки Route Club вызывает purchaseDecor', async () => {
    seedProgression({ tier: 3, track: 'free' })
    const systems = makeSystems()
    render(
      <ShopSystemProvider value={systems}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('route-pass-unlock-premium'))
    fireEvent.click(screen.getByTestId('dev-payment-ok'))
    await waitFor(() => expect(systems.collection.purchaseDecor).toHaveBeenCalledWith('route_pass_premium_s1'))
  })

  it('трек premium скрывает кнопку unlock', () => {
    seedProgression({ tier: 3, track: 'premium' })
    render(
      <ShopSystemProvider value={makeSystems()}>
        <RoutePass />
      </ShopSystemProvider>,
    )
    expect(screen.queryByTestId('route-pass-unlock-premium')).toBeNull()
  })
})
