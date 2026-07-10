/**
 * @vitest-environment jsdom
 *
 * StreetPanel.test.tsx — рендер + клик (W2). Мокаем `SocialSystem` (DI через
 * контекст) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SocialSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import type { TownSnapshot } from '@/types'
import { StreetPanel } from './StreetPanel'
import { SocialSystemProvider } from './SocialSystemContext'

function makeSocialSystem(overrides: Partial<SocialSystem> = {}): SocialSystem {
  return {
    help: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    gift: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    sit: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    chat: vi.fn(async () => ({ ok: true, data: { messageId: 'm1' } }) as never),
    ...overrides,
  }
}

function seedTown() {
  const town: TownSnapshot = {
    townId: 'town_1',
    streets: [{ id: 'street_1', name: 'Maple Street', memberCount: 2, farmIds: ['farm_a', 'farm_b'] }],
    projects: {},
    roster: [
      { userId: 'user_a', farmId: 'farm_a', displayName: 'Big Joe', streetId: 'street_1' },
      { userId: 'user_b', farmId: 'farm_b', displayName: 'Nana Opal', streetId: 'street_1' },
    ],
    coopOrders: [],
    migrations: [],
    movingVan: { cooldownUntil: 0 },
  }
  useStore.getState().setTown(town)
  useStore.getState().setIdentity({
    userId: 'user_me',
    farmId: 'farm_me',
    streetId: 'street_1',
    townId: 'town_1',
    displayName: 'Me',
    authStatus: 'anon',
  })
}

describe('StreetPanel (W2)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, town: null, event: null })
    useStore.getState().resetSession()
  })

  it('показывает пустое состояние без снапшота города', () => {
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <StreetPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('street-panel-empty')).toBeTruthy()
  })

  it('рендерит жителей стрита', () => {
    seedTown()
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <StreetPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('street-panel-name').textContent).toContain('Maple Street')
    expect(screen.getByTestId('street-member-user_a')).toBeTruthy()
    expect(screen.getByTestId('street-member-user_b')).toBeTruthy()
  })

  it('клик по Полить вызывает SocialSystem.help с targetId и типом action', async () => {
    seedTown()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <StreetPanel />
      </SocialSystemProvider>,
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('street-help-btn-user_a-water'))
    })
    expect(social.help).toHaveBeenCalledWith('user_a', 'water')
  })

  it('клик по имени соседа вызывает onSelectNeighbor', () => {
    seedTown()
    const onSelect = vi.fn()
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <StreetPanel onSelectNeighbor={onSelect} />
      </SocialSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('street-member-open-user_b'))
    expect(onSelect).toHaveBeenCalledWith('user_b')
  })

  it('вымпел стрита отражает event.streetPennant', () => {
    seedTown()
    useStore.setState({
      event: {
        meter: {
          eventKey: 'ev_glutton',
          meterPct: 0,
          meterFp: 0,
          goalFp: 100_000,
          milestones: [],
          window: { opensAt: 0, closesAt: 0 },
          finalAt: 0,
        },
        personalFp: 0,
        streetPennant: true,
        myContribHist: [],
      },
    })
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <StreetPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('street-pennant').textContent).toContain('🚩')
  })
})
