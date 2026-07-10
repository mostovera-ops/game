/**
 * @vitest-environment jsdom
 *
 * FairStall.test.tsx — рендер + клик "Выложить"/"Снять"/"Upgrade Tent" (R2, 09-fair §3.2/§3.6).
 * Мокаем `FairSystem` (DI через контекст) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FairSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { FairStall } from './FairStall'
import { FairSystemProvider } from './FairSystemContext'

function makeFairSystem(overrides: Partial<FairSystem> = {}): FairSystem {
  return {
    open: vi.fn(async () => ({ ok: true, data: { openedAt: 0 } }) as never),
    list: vi.fn(async () => ({ ok: true, data: { stall: {} } }) as never),
    upgradeTent: vi.fn(async () => ({ ok: true, data: { stallLevel: 2, displaySlots: 8 } }) as never),
    ...overrides,
  }
}

function seedInventory() {
  useStore.getState().setInventory({
    items: { dish_toast: 10 },
    stacks: [{ key: 'dish_toast', qty: 10, quality: 3, itemClass: 'dish' }],
    limits: { silo: 500, icehouse: 200, general: Infinity },
  })
}

describe('FairStall (R2)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('пустое состояние без прилавка', () => {
    useStore.setState({ fair: { stall: null, contests: [], shift: null } })
    render(
      <FairSystemProvider value={makeFairSystem()}>
        <FairStall />
      </FairSystemProvider>,
    )
    expect(screen.getByTestId('fair-stall-empty')).toBeTruthy()
  })

  it('рендерит выставленные лоты и прогноз продаж', () => {
    seedInventory()
    useStore.setState({
      fair: {
        stall: {
          version: 1,
          id: 'stall_1',
          level: 1,
          displaySlots: 6,
          lots: [{ id: 'lot_1', itemKey: 'dish_toast', qty: 10, remaining: 8, quality: 3, price: 6 }],
        },
        contests: [],
        shift: null,
      },
    })
    render(
      <FairSystemProvider value={makeFairSystem()}>
        <FairStall />
      </FairSystemProvider>,
    )
    expect(screen.getByTestId('fair-lot-dish_toast')).toBeTruthy()
    expect(screen.getByTestId('fair-stall-slots').textContent).toContain('1/6')
  })

  it('клик "Выложить" вызывает FairSystem.list с новым лотом', async () => {
    seedInventory()
    useStore.setState({
      fair: { stall: { version: 1, id: 'stall_1', level: 1, displaySlots: 6, lots: [] }, contests: [], shift: null },
    })
    const fair = makeFairSystem()
    render(
      <FairSystemProvider value={fair}>
        <FairStall />
      </FairSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('fair-pick-item'), { target: { value: 'dish_toast' } })
    fireEvent.click(screen.getByTestId('fair-add-lot'))
    await vi.waitFor(() => expect(fair.list).toHaveBeenCalled())
    const call = (fair.list as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call).toBeDefined()
    const req = call![0]
    expect(req.stallId).toBe('stall_1')
    expect(req.lots).toEqual([expect.objectContaining({ itemKey: 'dish_toast', qty: 1 })])
  })

  it('клик "Снять" вызывает FairSystem.list без удалённого лота', async () => {
    seedInventory()
    useStore.setState({
      fair: {
        stall: {
          version: 1,
          id: 'stall_1',
          level: 1,
          displaySlots: 6,
          lots: [{ id: 'lot_1', itemKey: 'dish_toast', qty: 10, remaining: 8, quality: 3, price: 6 }],
        },
        contests: [],
        shift: null,
      },
    })
    const fair = makeFairSystem()
    render(
      <FairSystemProvider value={fair}>
        <FairStall />
      </FairSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('fair-lot-remove-dish_toast'))
    await vi.waitFor(() => expect(fair.list).toHaveBeenCalledWith({ stallId: 'stall_1', lots: [] }))
  })

  it('клик "Upgrade Tent" вызывает FairSystem.upgradeTent', () => {
    seedInventory()
    useStore.setState({
      fair: { stall: { version: 1, id: 'stall_1', level: 1, displaySlots: 6, lots: [] }, contests: [], shift: null },
    })
    const fair = makeFairSystem()
    render(
      <FairSystemProvider value={fair}>
        <FairStall />
      </FairSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('fair-upgrade-tent'))
    expect(fair.upgradeTent).toHaveBeenCalled()
  })
})
