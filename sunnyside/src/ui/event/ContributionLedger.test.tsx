/**
 * @vitest-environment jsdom
 *
 * ContributionLedger.test.tsx — рендер + клик (V3). Мокаем `EventSystem` (DI через
 * контекст) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { EventSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import type { EventSnapshot } from '@/types'
import { ContributionLedger } from './ContributionLedger'
import { EventSystemProvider } from './EventSystemContext'

function makeEventSystem(overrides: Partial<EventSystem> = {}): EventSystem {
  return {
    contribute: vi.fn(async () => ({ ok: true, data: { meterPct: 5, personalFp: 100, milestonesHit: [] } }) as never),
    ...overrides,
  }
}

function seedEvent(personalFp: number) {
  const now = Date.now()
  const snapshot: EventSnapshot = {
    meter: {
      eventKey: 'ev_glutton',
      meterPct: 5,
      meterFp: 5_000,
      goalFp: 100_000,
      milestones: [
        { pct: 25, reward: 'T3 seeds', hit: false },
        { pct: 50, reward: 'decor + 🎟', hit: false },
        { pct: 75, reward: 'weekly boost', hit: false },
        { pct: 100, reward: 'parade + frame', hit: false },
      ],
      window: { opensAt: now, closesAt: now + 40 * 3_600_000 },
      finalAt: now + 6 * 3_600_000,
    },
    personalFp,
    streetPennant: false,
    myContribHist: [],
  }
  useStore.getState().setEvent(snapshot)
}

function seedInventory() {
  useStore.getState().setInventory({
    items: { dish_pie: 3 },
    stacks: [{ key: 'dish_pie', qty: 3, quality: 3, itemClass: 'dish' }],
    limits: { silo: 500, icehouse: 200, general: Infinity },
  })
}

describe('ContributionLedger (V3)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, event: null })
  })

  it('показывает пустое состояние без снапшота ивента', () => {
    render(
      <EventSystemProvider value={makeEventSystem()}>
        <ContributionLedger />
      </EventSystemProvider>,
    )
    expect(screen.getByTestId('contribution-ledger-empty')).toBeTruthy()
  })

  it('открывает Bronze-сундук по participation-floor (≥1 внесённого блюда)', () => {
    seedEvent(700)
    render(
      <EventSystemProvider value={makeEventSystem()}>
        <ContributionLedger />
      </EventSystemProvider>,
    )
    expect(screen.getByTestId('chest-row-chest_bronze').textContent).toContain('✓')
  })

  it('клик по Внести вызывает EventSystem.contribute с каналом donate', async () => {
    seedEvent(0)
    seedInventory()
    const eventSystem = makeEventSystem()
    render(
      <EventSystemProvider value={eventSystem}>
        <ContributionLedger />
      </EventSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('event-donate-pick-item'), { target: { value: 'dish_pie' } })
    fireEvent.change(screen.getByTestId('event-donate-qty'), { target: { value: '2' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('event-donate-btn'))
    })
    expect(eventSystem.contribute).toHaveBeenCalledWith('dish_pie', 2, 'donate')
  })
})
