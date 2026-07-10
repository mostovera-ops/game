/**
 * @vitest-environment jsdom
 *
 * MovingVan.test.tsx — Moving Van (`ui_moving_truck`, 12-migration §3.1): статус кулдауна,
 * переключение вкладок (Найти город / Караван стрита / Город). `TownSystem` замокан (DI) —
 * компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { TownSystem } from '@/engine/contracts'
import type { TownSnapshot } from '@/types'
import { useStore } from '@/state'
import { MovingVan } from './MovingVan'
import { TownSystemProvider } from './TownSystemContext'

function makeTownSystem(overrides: Partial<TownSystem> = {}): TownSystem {
  return {
    proposeMigration: vi.fn(async () => ({ ok: true, data: { proposalId: 'mig_1' } }) as never),
    voteMigration: vi.fn(async () => ({ ok: true, data: { yes: 1, no: 0 } }) as never),
    listTowns: vi.fn(async () => ({ ok: true, data: [] }) as never),
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

describe('MovingVan (ui_moving_truck)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('готов к переезду, когда кулдаун истёк', () => {
    useStore.getState().setTown({ ...baseTown, movingVan: { cooldownUntil: Date.now() - 1000 } })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <MovingVan />
      </TownSystemProvider>,
    )
    expect(screen.getByTestId('moving-van-cooldown').textContent).toMatch(/готов/i)
  })

  it('показывает остаток кулдауна, когда переезд ещё недоступен', () => {
    useStore.getState().setTown({ ...baseTown, movingVan: { cooldownUntil: Date.now() + 2 * 24 * 3_600_000 } })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <MovingVan />
      </TownSystemProvider>,
    )
    expect(screen.getByTestId('moving-van-cooldown').textContent).toMatch(/отдыхает/i)
  })

  it('переключение вкладок показывает Town Browser / Caravan / Town Merge', async () => {
    useStore.getState().setTown({ ...baseTown, movingVan: { cooldownUntil: 0 } })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <MovingVan />
      </TownSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('moving-van-tab-browser'))
    await waitFor(() => expect(screen.getByTestId('ui-town-browser')).toBeTruthy())

    fireEvent.click(screen.getByTestId('moving-van-tab-caravan'))
    expect(screen.getByTestId('ui-caravan-vote')).toBeTruthy()

    fireEvent.click(screen.getByTestId('moving-van-tab-city'))
    expect(screen.getByTestId('ui-town-merge-banner')).toBeTruthy()
  })

  it('кнопка "Найти город" на домашней вкладке переключает на Town Browser', async () => {
    useStore.getState().setTown({ ...baseTown, movingVan: { cooldownUntil: 0 } })
    render(
      <TownSystemProvider value={makeTownSystem()}>
        <MovingVan />
      </TownSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('moving-van-cta-browse'))
    await waitFor(() => expect(screen.getByTestId('ui-town-browser')).toBeTruthy())
  })
})
