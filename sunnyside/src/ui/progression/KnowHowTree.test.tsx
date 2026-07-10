/**
 * @vitest-environment jsdom
 *
 * KnowHowTree.test.tsx — рендер + переключение веток + клик "Изучить" (F7).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ProgressionSystem } from '@/engine/contracts'
import type { ProgressionSnapshot } from '@/types'
import { useStore } from '@/state'
import { KnowHowTree } from './KnowHowTree'
import { ProgressionSystemProvider } from './ProgressionSystemContext'

function makeProgressionSystem(overrides: Partial<ProgressionSystem> = {}): ProgressionSystem {
  return {
    research: vi.fn(async () => ({ ok: true, data: { studyReadyAt: 0 } }) as never),
    assignStaff: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    upgradeStaff: vi.fn(async () => ({ ok: true, data: { level: 2 } }) as never),
    streakCheck: vi.fn(async () => ({ ok: true, data: { streakDays: 1, state: 'active' } }) as never),
    streakInsure: vi.fn(async () => ({ ok: true, data: { insuredUntil: 0 } }) as never),
    ...overrides,
  }
}

// Тир 1 первого узла ветки agronomy — без предпосылок, стоимость 1 очко (детерминированный якорь теста).
const FIRST_NODE = 'kh_agronomy_green_thumb'
const FIRST_COOKERY_NODE = 'kh_cookery_mise_en_place'

const baseProgression: ProgressionSnapshot = {
  farmId: 'farm_1',
  farmLevel: 3,
  xp: 100,
  knowHow: { points: 5, activeSlots: 1, nodes: {} },
  staff: {},
  routePass: { season: 1, tier: 0, xp: 0, track: 'free', claimedFree: [], claimedPremium: [] },
  streak: { streakDays: 0, state: 'active' },
  staffTokens: 0,
}

describe('KnowHowTree (F7)', () => {
  beforeEach(() => {
    useStore.getState().setProgression(structuredClone(baseProgression))
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('рендерит 15 узлов ветки Agronomy по умолчанию', () => {
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <KnowHowTree />
      </ProgressionSystemProvider>,
    )
    expect(screen.getByTestId('know-how-tree')).toBeTruthy()
    expect(screen.getAllByTestId(/^know-how-node-kh_agronomy_/)).toHaveLength(15)
  })

  it('переключение на ветку Cookery меняет список узлов', () => {
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <KnowHowTree />
      </ProgressionSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('know-how-branch-kh_cookery'))
    expect(screen.getByTestId(`know-how-node-${FIRST_COOKERY_NODE}`)).toBeTruthy()
    expect(screen.queryByTestId(`know-how-node-${FIRST_NODE}`)).toBeNull()
  })

  it('первый узел ветки доступен (без предпосылок, очков хватает) и клик вызывает research', async () => {
    const system = makeProgressionSystem()
    render(
      <ProgressionSystemProvider value={system}>
        <KnowHowTree />
      </ProgressionSystemProvider>,
    )
    const node = screen.getByTestId(`know-how-node-${FIRST_NODE}`)
    expect(node.getAttribute('data-status')).toBe('available')
    const btn = screen.getByTestId(`know-how-research-${FIRST_NODE}`) as HTMLButtonElement
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(system.research).toHaveBeenCalledWith(FIRST_NODE)
  })

  it('изученный узел показывает статус studied и без кнопки исследования', () => {
    useStore.getState().setProgression({
      ...structuredClone(baseProgression),
      knowHow: {
        points: 10,
        activeSlots: 1,
        nodes: { [FIRST_NODE]: { version: 1, key: FIRST_NODE, branch: 'kh_agronomy', studied: true, prereqs: [] } },
      },
    })
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <KnowHowTree />
      </ProgressionSystemProvider>,
    )
    const node = screen.getByTestId(`know-how-node-${FIRST_NODE}`)
    expect(node.getAttribute('data-status')).toBe('studied')
    expect(screen.queryByTestId(`know-how-research-${FIRST_NODE}`)).toBeNull()
  })
})
