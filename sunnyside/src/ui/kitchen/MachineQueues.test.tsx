/**
 * @vitest-environment jsdom
 *
 * MachineQueues.test.tsx — рендер + клик (K1). Мокаем `CraftSystem` (DI через контекст,
 * см. CraftSystemContext.tsx) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { CraftSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { MachineQueues } from './MachineQueues'
import { CraftSystemProvider } from './CraftSystemContext'

function makeCraftSystem(overrides: Partial<CraftSystem> = {}): CraftSystem {
  return {
    start: vi.fn(async () => ({ ok: true, data: { job: {} } }) as never),
    collect: vi.fn(async () => ({ ok: true, data: { items: [], masteryDelta: 0 } }) as never),
    experiment: vi.fn(async () => ({ ok: true, data: { result: null } }) as never),
    ...overrides,
  }
}

function seedFarm(jobsReady: boolean, withJob = true) {
  useStore.getState().setFarm({
    farmId: 'farm_1',
    farmLevel: 1,
    plots: [],
    buildings: {},
    animals: [],
    farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
    machines: [
      {
        id: 'mch_inst_1',
        key: 'mch_grill',
        level: 1,
        jobs: withJob
          ? [
              {
                id: 'job_1',
                version: 1,
                machineId: 'mch_inst_1',
                recipeKey: 'rcp_test',
                batch: 1,
                state: 'cooking',
                startedAt: 0,
                readyAt: jobsReady ? -1000 : Date.now() + 60_000,
              },
            ]
          : [],
      },
    ],
  })
  useStore.getState().setInventory({ items: {}, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
}

describe('MachineQueues (K1)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('рендерит станок и его очередь', () => {
    seedFarm(false)
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <MachineQueues onQueueDish={() => {}} />
      </CraftSystemProvider>,
    )
    expect(screen.getByTestId('machine-queues')).toBeTruthy()
    expect(screen.getByTestId('machine-row-mch_inst_1')).toBeTruthy()
    expect(screen.getByTestId('job-job_1')).toBeTruthy()
  })

  it('кнопка Забрать выключена, пока партия не готова', () => {
    seedFarm(false)
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <MachineQueues onQueueDish={() => {}} />
      </CraftSystemProvider>,
    )
    const btn = screen.getByTestId('machine-collect-btn-mch_inst_1') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('клик по Забрать вызывает CraftSystem.collect с готовыми job id', async () => {
    seedFarm(true)
    const craft = makeCraftSystem()
    render(
      <CraftSystemProvider value={craft}>
        <MachineQueues onQueueDish={() => {}} />
      </CraftSystemProvider>,
    )
    const btn = screen.getByTestId('machine-collect-btn-mch_inst_1') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(craft.collect).toHaveBeenCalledWith(['job_1'])
  })

  it('клик по Поставить вызывает onQueueDish с id станка', () => {
    seedFarm(false, false)
    const onQueueDish = vi.fn()
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <MachineQueues onQueueDish={onQueueDish} />
      </CraftSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('machine-queue-btn-mch_inst_1'))
    expect(onQueueDish).toHaveBeenCalledWith('mch_inst_1')
  })
})
