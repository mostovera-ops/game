/**
 * @vitest-environment jsdom
 *
 * TownBrowser.test.tsx — список/фильтры/превью/подтверждение личного Moving Van
 * (12-migration §3.1.3). `TownSystem` замокан — компонент не ходит в сеть сам.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TownSystem } from '@/engine/contracts'
import type { TownListing, TownSnapshot } from '@/types'
import { useStore } from '@/state'
import { TownBrowser } from './TownBrowser'
import { TownSystemProvider } from './TownSystemContext'

const LISTINGS: TownListing[] = [
  {
    townId: 'town-a', name: 'Cedar Falls', residents: 90, capacity: 200, freeStreets: 4,
    totalStreets: 8, dauAvg: 55, hasFriends: false, recommended: true,
  },
  {
    townId: 'town-b', name: 'Pinehurst', residents: 180, capacity: 200, freeStreets: 0,
    totalStreets: 12, dauAvg: 20, hasFriends: true, recommended: false,
  },
]

function makeTownSystem(overrides: Partial<TownSystem> = {}): TownSystem {
  return {
    proposeMigration: vi.fn(async () => ({ ok: true, data: { proposalId: 'mig_1' } }) as never),
    voteMigration: vi.fn(async () => ({ ok: true, data: { yes: 1, no: 0 } }) as never),
    listTowns: vi.fn(async () => ({ ok: true, data: LISTINGS }) as never),
    moveFarm: vi.fn(async () => ({
      ok: true,
      data: { ticketsAwarded: 12, convertedBucks: 600, carryoverBucks: 0, cooldownUntil: Date.now() + 1 },
    }) as never),
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

describe('TownBrowser (§3.1.3)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setTown(baseTown)
  })

  it('рендерит список городов после загрузки', async () => {
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <TownBrowser onMoved={vi.fn()} />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('town-browse-card-town-a')).toBeTruthy())
    expect(screen.getByTestId('town-browse-card-town-b')).toBeTruthy()
  })

  it('фильтр «Рекомендованные» скрывает нерекомендованные города', async () => {
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <TownBrowser onMoved={vi.fn()} />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('town-browse-card-town-a')).toBeTruthy())
    fireEvent.click(screen.getByTestId('town-browse-filter-recommended'))
    expect(screen.queryByTestId('town-browse-card-town-b')).toBeNull()
    expect(screen.getByTestId('town-browse-card-town-a')).toBeTruthy()
  })

  it('выбор города → превью чек-листа → подтверждение вызывает moveFarm и onMoved', async () => {
    const town = makeTownSystem()
    const onMoved = vi.fn()
    render(
      <TownSystemProvider value={town}>
        <TownBrowser onMoved={onMoved} />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('town-browse-card-town-a')).toBeTruthy())
    fireEvent.click(screen.getByTestId('town-browse-select-town-a'))
    expect(screen.getByTestId('town-browse-preview')).toBeTruthy()

    fireEvent.click(screen.getByTestId('town-browse-confirm-move'))
    await waitFor(() => expect(town.moveFarm).toHaveBeenCalledWith('town-a'))
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith('Cedar Falls', expect.objectContaining({ ticketsAwarded: 12 })))
  })

  it('на кулдауне: кнопка подтверждения в превью заблокирована', async () => {
    useStore.getState().setTown({ ...baseTown, movingVan: { cooldownUntil: Date.now() + 3_600_000 } })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <TownBrowser onMoved={vi.fn()} />
      </TownSystemProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('town-browse-card-town-a')).toBeTruthy())
    fireEvent.click(screen.getByTestId('town-browse-select-town-a'))
    expect((screen.getByTestId('town-browse-confirm-move') as HTMLButtonElement).disabled).toBe(true)
  })
})
