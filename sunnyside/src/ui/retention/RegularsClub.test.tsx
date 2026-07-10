/**
 * @vitest-environment jsdom
 *
 * RegularsClub.test.tsx — Блокнот завсегдатая (`ui_regulars_club`, 16-retention §3.3/§4.2/§4.3).
 * Мокаем `RetentionSystem` (DI) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import type { RetentionSystem } from '@/engine/retention'
import { useStore } from '@/state'
import type { ProgressionSnapshot } from '@/types'
import { RegularsClub } from './RegularsClub'
import { RetentionSystemProvider } from '../social'

function makeRetentionSystem(overrides: Partial<RetentionSystem> = {}): RetentionSystem {
  return {
    streakCheck: vi.fn(async () => ({ ok: true, data: { streakDays: 0, state: 'active' } }) as never),
    streakInsure: vi.fn(async () => ({ ok: true, data: { insuredUntil: 0 } }) as never),
    vacationStart: vi.fn(async () => ({ ok: true, data: { vacationUntil: 0 } }) as never),
    vacationEnd: vi.fn(async () => ({ ok: true, data: { vacationUntil: 0 } }) as never),
    ...overrides,
  }
}

const baseProgression: ProgressionSnapshot = {
  farmId: 'farm_me',
  farmLevel: 1,
  xp: 0,
  knowHow: { points: 0, activeSlots: 1, nodes: {} },
  staff: {},
  routePass: { season: 1, tier: 0, xp: 0, track: 'free', claimedFree: [], claimedPremium: [] },
  streak: { streakDays: 5, state: 'active' },
  staffTokens: 0,
}

function resetStore() {
  useStore.getState().openPanel(null)
  useStore.setState((s) => ({
    ui: { ...s.ui, locale: 'ru' },
    progression: baseProgression,
    econ: { ...s.econ, wallet: { bucks: 0, dimes: 0, tickets: 10, ribbons: 0 } },
  }))
}

describe('RegularsClub (16-retention §3.3/§4.2/§4.3)', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('рендерит день стрика, бонус % и штампы, без кнопки страховки в active', () => {
    render(
      <RetentionSystemProvider value={makeRetentionSystem()}>
        <RegularsClub />
      </RetentionSystemProvider>,
    )
    expect(screen.getByTestId('regulars-club-days').textContent).toBe('5')
    expect(screen.getByTestId('regulars-club-stamps')).toBeTruthy()
    expect(screen.queryByTestId('regulars-club-insure-btn')).toBeNull()
  })

  it('открытие панели зовёт RetentionSystem.streakCheck()', async () => {
    const retention = makeRetentionSystem()
    useStore.getState().openPanel('ui_regulars_club')
    await act(async () => {
      render(
        <RetentionSystemProvider value={retention}>
          <RegularsClub />
        </RetentionSystemProvider>,
      )
    })
    expect(retention.streakCheck).toHaveBeenCalled()
  })

  it('состояние frozen — показывает кнопку страховки, клик зовёт streakInsure()', async () => {
    useStore.setState((s) => ({
      progression: s.progression ? { ...s.progression, streak: { streakDays: 5, state: 'frozen' } } : s.progression,
    }))
    const retention = makeRetentionSystem()
    render(
      <RetentionSystemProvider value={retention}>
        <RegularsClub />
      </RetentionSystemProvider>,
    )
    const btn = screen.getByTestId('regulars-club-insure-btn')
    expect(btn).toBeTruthy()
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(retention.streakInsure).toHaveBeenCalled()
  })

  it('без прогрессии в сторе — не падает, показывает 0 дней', () => {
    useStore.setState({ progression: null })
    render(
      <RetentionSystemProvider value={makeRetentionSystem()}>
        <RegularsClub />
      </RetentionSystemProvider>,
    )
    expect(screen.getByTestId('regulars-club-days').textContent).toBe('0')
  })
})
