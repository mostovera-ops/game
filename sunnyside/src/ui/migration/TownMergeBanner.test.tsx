/**
 * @vitest-environment jsdom
 *
 * TownMergeBanner.test.tsx — Town Merge Proposal + Grand Reopening banner (12-migration
 * §3.3/§3.3.4). `TownSystem` замокан (DI) — компонент не ходит в сеть сам.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TownSystem } from '@/engine/contracts'
import type { TownSnapshot } from '@/types'
import { useStore } from '@/state'
import { TownMergeBanner } from './TownMergeBanner'
import { TownSystemProvider } from './TownSystemContext'

function makeTownSystem(overrides: Partial<TownSystem> = {}): TownSystem {
  return {
    proposeMigration: vi.fn(async () => ({ ok: true, data: { proposalId: 'mig_1' } }) as never),
    voteMigration: vi.fn(async () => ({ ok: true, data: { yes: 14, no: 0 } }) as never),
    listTowns: vi.fn(async () => ({ ok: true, data: [] }) as never),
    moveFarm: vi.fn(async () => ({ ok: true, data: { ticketsAwarded: 0, convertedBucks: 0, carryoverBucks: 0, cooldownUntil: 0 } }) as never),
    ...overrides,
  }
}

const baseTown: TownSnapshot = {
  townId: 'town-1',
  streets: [],
  projects: {},
  roster: [],
  coopOrders: [],
  migrations: [],
  movingVan: { cooldownUntil: 0 },
}

describe('TownMergeBanner (§3.3/§3.3.4)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('без предложения и без Grand Reopening — пустое состояние', () => {
    useStore.getState().setTown(baseTown)
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <TownMergeBanner />
      </TownSystemProvider>,
    )
    expect(screen.getByTestId('town-merge-empty')).toBeTruthy()
  })

  it('активное предложение — VoteCard + клик "За" вызывает voteMigration', async () => {
    useStore.getState().setTown({
      ...baseTown,
      migrations: [
        {
          version: 1,
          id: 'mig_1',
          kind: 'town_merge',
          targetTownId: 'town-a',
          votingWindow: { opensAt: Date.now() - 1000, closesAt: Date.now() + 3 * 24 * 3_600_000 },
          tally: { yes: 12, no: 2, quorum: 13 },
        },
      ],
    })
    const town = makeTownSystem()
    render(
      <TownSystemProvider value={town}>
        <TownMergeBanner />
      </TownSystemProvider>,
    )
    expect(screen.queryByTestId('town-merge-empty')).toBeNull()
    fireEvent.click(screen.getByTestId('vote-card-yes-mig_1'))
    await waitFor(() => expect(town.voteMigration).toHaveBeenCalledWith('mig_1', 'yes'))
  })

  it('Grand Reopening активен — показывает баннер с остатком времени', () => {
    useStore.getState().setTown({
      ...baseTown,
      grandReopening: { active: true, endsAt: Date.now() + 2 * 24 * 3_600_000 },
    })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <TownMergeBanner />
      </TownSystemProvider>,
    )
    expect(screen.getByTestId('grand-reopening-banner')).toBeTruthy()
  })
})
