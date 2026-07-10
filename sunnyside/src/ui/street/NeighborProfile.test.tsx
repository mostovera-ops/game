/**
 * @vitest-environment jsdom
 *
 * NeighborProfile.test.tsx — рендер + клик (F8, упрощённый профиль соседа).
 * Мокаем `SocialSystem` (DI через контекст) — компонент не ходит в сеть сам.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SocialSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import type { TownSnapshot } from '@/types'
import { NeighborProfile } from './NeighborProfile'
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
    streets: [{ id: 'street_1', name: 'Maple Street', memberCount: 1, farmIds: ['farm_a'] }],
    projects: {},
    roster: [{ userId: 'user_a', farmId: 'farm_a', displayName: 'Big Joe', streetId: 'street_1' }],
    coopOrders: [],
    migrations: [],
    movingVan: { cooldownUntil: 0 },
  }
  useStore.getState().setTown(town)
}

describe('NeighborProfile (F8)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, town: null, inventory: null })
  })

  it('показывает пустое состояние, если соседа нет в ростере', () => {
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <NeighborProfile userId="ghost" />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('neighbor-profile-empty')).toBeTruthy()
  })

  it('рендерит имя соседа из ростера стрита', () => {
    seedTown()
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <NeighborProfile userId="user_a" />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('neighbor-profile-name').textContent).toContain('Big Joe')
  })

  it('клик по Полить вызывает SocialSystem.help(userId, "water")', async () => {
    seedTown()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <NeighborProfile userId="user_a" />
      </SocialSystemProvider>,
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('neighbor-profile-help-btn'))
    })
    expect(social.help).toHaveBeenCalledWith('user_a', 'water')
  })

  it('клик по Присмотреть вызывает SocialSystem.sit(userId) — neighbor_sit', async () => {
    seedTown()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <NeighborProfile userId="user_a" />
      </SocialSystemProvider>,
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('neighbor-profile-sit-btn'))
    })
    expect(social.sit).toHaveBeenCalledWith('user_a')
  })

  it('клик по крестику вызывает onBack', () => {
    seedTown()
    const onBack = vi.fn()
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <NeighborProfile userId="user_a" onBack={onBack} />
      </SocialSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('neighbor-profile-back'))
    expect(onBack).toHaveBeenCalled()
  })
})
