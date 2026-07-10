/**
 * @vitest-environment jsdom
 *
 * CaravanVote.test.tsx — инициация и голосование Street Caravan (12-migration §3.2).
 * `TownSystem` замокан (DI) — компонент не ходит в сеть сам.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TownSystem } from '@/engine/contracts'
import type { TownListing, TownSnapshot } from '@/types'
import { useStore } from '@/state'
import { CaravanVote } from './CaravanVote'
import { TownSystemProvider } from './TownSystemContext'

const LISTINGS: TownListing[] = [
  {
    townId: 'town-a', name: 'Cedar Falls', residents: 90, capacity: 200, freeStreets: 4,
    totalStreets: 8, dauAvg: 55, hasFriends: false, recommended: true,
  },
]

function makeTownSystem(overrides: Partial<TownSystem> = {}): TownSystem {
  return {
    proposeMigration: vi.fn(async () => ({ ok: true, data: { proposalId: 'mig_1' } }) as never),
    voteMigration: vi.fn(async () => ({ ok: true, data: { yes: 1, no: 0 } }) as never),
    listTowns: vi.fn(async () => ({ ok: true, data: LISTINGS }) as never),
    moveFarm: vi.fn(async () => ({ ok: true, data: { ticketsAwarded: 0, convertedBucks: 0, carryoverBucks: 0, cooldownUntil: 0 } }) as never),
    ...overrides,
  }
}

const baseTown: TownSnapshot = {
  townId: 'town-1',
  streets: [{ id: 'street-1', name: 'Maple Street', memberCount: 10, farmIds: [] }],
  projects: {},
  roster: [],
  coopOrders: [],
  migrations: [],
  movingVan: { cooldownUntil: 0 },
}

describe('CaravanVote (§3.2)', () => {
  beforeEach(() => {
    useStore.setState({
      ui: { ...useStore.getState().ui, locale: 'ru' },
      session: { identity: { userId: 'u1', farmId: 'f1', streetId: 'street-1', townId: 'town-1', displayName: 'Me', authStatus: 'guest' }, authStatus: 'authenticated' },
    })
    useStore.getState().setTown(baseTown)
  })

  it('без активного предложения — показывает форму инициации', async () => {
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <CaravanVote />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('caravan-target-select')).toBeTruthy())
    // ничего не выбрано
    expect((screen.getByTestId('caravan-propose-btn') as HTMLButtonElement).disabled).toBe(true)
  })

  it('выбор города + клик "Предложить" вызывает proposeMigration(street_caravan, streetId)', async () => {
    const town = makeTownSystem()
    render(
      <TownSystemProvider value={town}>
        <CaravanVote />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('caravan-target-select')).toBeTruthy())
    fireEvent.change(screen.getByTestId('caravan-target-select'), { target: { value: 'town-a' } })
    fireEvent.click(screen.getByTestId('caravan-propose-btn'))
    await waitFor(() =>
      expect(town.proposeMigration).toHaveBeenCalledWith({
        kind: 'street_caravan',
        targetTown: 'town-a',
        streetId: 'street-1',
      }),
    )
  })

  it('с активным предложением — рендерит VoteCard с тэлли/кворумом', () => {
    useStore.getState().setTown({
      ...baseTown,
      migrations: [
        {
          version: 1,
          id: 'mig_1',
          kind: 'street_caravan',
          targetTownId: 'town-a',
          streetId: 'street-1',
          votingWindow: { opensAt: Date.now() - 1000, closesAt: Date.now() + 3_600_000 },
          tally: { yes: 3, no: 1, quorum: 7 },
        },
      ],
    })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <CaravanVote />
      </TownSystemProvider>,
    )
    expect(screen.getByTestId('vote-card-mig_1')).toBeTruthy()
    expect(screen.getByTestId('vote-card-yes-mig_1')).toBeTruthy()
  })
})
