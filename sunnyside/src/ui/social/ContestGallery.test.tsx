/**
 * @vitest-environment jsdom
 *
 * ContestGallery.test.tsx — Contest Gallery (09-fair §4.5 `ui_contest_gallery`): войти
 * в конкурс / проголосовать через `ContestSystem` (DI) — компонент не ходит в сеть сам
 * (AGENTS.md §0.3). Заявки/фазы читаются из `state/fair.ts` (серверный снапшот).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ContestSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import type { Contest, InventorySnapshot } from '@/types'
import { ContestGallery } from './ContestGallery'
import { ContestSystemProvider } from './ContestSystemContext'

function makeContestSystem(overrides: Partial<ContestSystem> = {}): ContestSystem {
  return {
    enter: vi.fn(async () => ({ ok: true, data: { entryId: 'entry_1' } }) as never),
    vote: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    ...overrides,
  }
}

const inventory: InventorySnapshot = {
  items: { dish_pie: 2 },
  stacks: [{ key: 'dish_pie', qty: 2, quality: 3, itemClass: 'dish' }],
  limits: { silo: 100, icehouse: 100, general: 100 },
}

const entryContest: Contest = {
  id: 'contest_pie',
  key: 'ct_pie_week',
  phase: 'entry',
  entryWindow: { opensAt: 0, closesAt: 1000 },
  votingWindow: { opensAt: 1000, closesAt: 2000 },
  entries: [],
}

const votingContest: Contest = {
  id: 'contest_giant',
  key: 'ct_giant_veg',
  phase: 'voting',
  entryWindow: { opensAt: 0, closesAt: 1000 },
  votingWindow: { opensAt: 1000, closesAt: 2000 },
  myEntry: { id: 'entry_mine', playerId: 'me', payload: {}, votes: 3 },
  entries: [
    { id: 'entry_mine', playerId: 'me', payload: {}, votes: 3 },
    { id: 'entry_other', playerId: 'other', payload: {}, votes: 5 },
  ],
}

describe('ContestGallery (09-fair §4.5)', () => {
  beforeEach(() => {
    useStore.setState({
      ui: { ...useStore.getState().ui, locale: 'ru' },
      fair: { stall: null, contests: [], shift: null },
      inventory: null,
    })
  })

  it('без конкурсов недели — пустое состояние', () => {
    render(
      <ContestSystemProvider value={makeContestSystem()}>
        <ContestGallery />
      </ContestSystemProvider>,
    )
    expect(screen.getByTestId('contest-gallery-empty')).toBeTruthy()
  })

  it('фаза entry без заявки — подать заявку вызывает ContestSystem.enter', async () => {
    useStore.setState({
      fair: { stall: null, contests: [entryContest], shift: null },
      inventory,
    })
    const contest = makeContestSystem()
    render(
      <ContestSystemProvider value={contest}>
        <ContestGallery />
      </ContestSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('contest-item-pick-ct_pie_week'), { target: { value: 'dish_pie' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('contest-enter-btn-ct_pie_week'))
    })
    expect(contest.enter).toHaveBeenCalledWith('ct_pie_week', { itemKey: 'dish_pie' })
  })

  it('фаза voting — голосование за чужую заявку вызывает ContestSystem.vote, за свою кнопки нет', async () => {
    useStore.setState({ fair: { stall: null, contests: [votingContest], shift: null } })
    const contest = makeContestSystem()
    render(
      <ContestSystemProvider value={contest}>
        <ContestGallery />
      </ContestSystemProvider>,
    )
    expect(screen.queryByTestId('contest-vote-btn-entry_mine')).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByTestId('contest-vote-btn-entry_other'))
    })
    expect(contest.vote).toHaveBeenCalledWith('contest_giant', 'entry_other')
  })
})
