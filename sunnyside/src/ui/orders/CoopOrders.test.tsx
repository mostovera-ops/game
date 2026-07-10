/**
 * @vitest-environment jsdom
 *
 * CoopOrders.test.tsx — рендер + клик "Contribute" (W5, 11-town §3.5).
 * Мокаем `CoopSystem` (DI через контекст) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CoopSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { CoopOrders } from './CoopOrders'
import { CoopSystemProvider } from './CoopSystemContext'

function makeCoopSystem(overrides: Partial<CoopSystem> = {}): CoopSystem {
  return {
    contribute: vi.fn(async () => ({ ok: true, data: { progress: 50 } }) as never),
    potluck: vi.fn(async () => ({ ok: true, data: { totalScore: 0 } }) as never),
    ...overrides,
  }
}

describe('CoopOrders (W5)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('пустое состояние без заказов', () => {
    useStore.setState({ coop: { orders: [], potluck: null } })
    render(
      <CoopSystemProvider value={makeCoopSystem()}>
        <CoopOrders />
      </CoopSystemProvider>,
    )
    expect(screen.getByTestId('coop-orders-empty')).toBeTruthy()
  })

  it('рендерит требования заказа и прогресс', () => {
    useStore.setState({
      coop: {
        orders: [
          {
            version: 1,
            id: 'order_1',
            requirements: [{ itemKey: 'dish_toast', qty: 20, filled: 5 }],
            deadlineAt: Date.now() + 3_600_000,
            myContribution: {},
            reward: '🎟 5',
          },
        ],
        potluck: null,
      },
    })
    useStore.getState().setInventory({
      items: { dish_toast: 3 },
      stacks: [],
      limits: { silo: 500, icehouse: 200, general: Infinity },
    })
    render(
      <CoopSystemProvider value={makeCoopSystem()}>
        <CoopOrders />
      </CoopSystemProvider>,
    )
    expect(screen.getByTestId('coop-order-order_1')).toBeTruthy()
    const bar = screen.getByTestId('coop-req-bar-order_1:dish_toast')
    expect(bar.style.width).toBe('25%')
  })

  it('клик "Contribute" вызывает CoopSystem.contribute с id заказа/предмета/кол-вом', async () => {
    useStore.setState({
      coop: {
        orders: [
          {
            version: 1,
            id: 'order_1',
            requirements: [{ itemKey: 'dish_toast', qty: 20, filled: 5 }],
            deadlineAt: Date.now() + 3_600_000,
            myContribution: {},
            reward: '🎟 5',
          },
        ],
        potluck: null,
      },
    })
    useStore.getState().setInventory({
      items: { dish_toast: 3 },
      stacks: [],
      limits: { silo: 500, icehouse: 200, general: Infinity },
    })
    const coop = makeCoopSystem()
    render(
      <CoopSystemProvider value={coop}>
        <CoopOrders />
      </CoopSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('coop-req-contribute-order_1:dish_toast'))
    expect(coop.contribute).toHaveBeenCalledWith('order_1', 'dish_toast', 1)
  })
})
