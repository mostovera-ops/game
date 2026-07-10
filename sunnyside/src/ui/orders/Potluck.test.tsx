/**
 * @vitest-environment jsdom
 *
 * Potluck.test.tsx — рендер + клик "Принести" (W4, 11-town §потлак).
 * Мокаем `CoopSystem` (DI через контекст) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CoopSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { Potluck } from './Potluck'
import { CoopSystemProvider } from './CoopSystemContext'

function makeCoopSystem(overrides: Partial<CoopSystem> = {}): CoopSystem {
  return {
    contribute: vi.fn(async () => ({ ok: true, data: { progress: 0 } }) as never),
    potluck: vi.fn(async () => ({ ok: true, data: { totalScore: 100 } }) as never),
    ...overrides,
  }
}

function seedInventory() {
  useStore.getState().setInventory({
    items: { dish_toast: 4 },
    stacks: [{ key: 'dish_toast', qty: 4, quality: 3, itemClass: 'dish' }],
    limits: { silo: 500, icehouse: 200, general: Infinity },
  })
}

describe('Potluck (W4)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('пустое состояние без стола', () => {
    useStore.setState({ coop: { orders: [], potluck: null } })
    render(
      <CoopSystemProvider value={makeCoopSystem()}>
        <Potluck />
      </CoopSystemProvider>,
    )
    expect(screen.getByTestId('potluck-empty')).toBeTruthy()
  })

  it('рендерит вклад и прогресс до баффа', () => {
    useStore.setState({
      coop: { orders: [], potluck: { weekIndex: 3, totalScore: 500, myScore: 120, buffActive: false } },
    })
    render(
      <CoopSystemProvider value={makeCoopSystem()}>
        <Potluck />
      </CoopSystemProvider>,
    )
    expect(screen.getByTestId('potluck-progress-bar').style.width).toBe('50%')
    expect(screen.queryByTestId('potluck-buff-active')).toBeNull()
  })

  it('клик "Принести" вызывает CoopSystem.potluck с weekIndex/предмет/кол-во', async () => {
    seedInventory()
    useStore.setState({
      coop: { orders: [], potluck: { weekIndex: 3, totalScore: 500, myScore: 120, buffActive: false } },
    })
    const coop = makeCoopSystem()
    render(
      <CoopSystemProvider value={coop}>
        <Potluck />
      </CoopSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('potluck-pick-item'), { target: { value: 'dish_toast' } })
    fireEvent.click(screen.getByTestId('potluck-bring-dish'))
    await vi.waitFor(() => expect(coop.potluck).toHaveBeenCalledWith(3, 'dish_toast', 1))
  })
})
