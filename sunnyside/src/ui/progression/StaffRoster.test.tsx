/**
 * @vitest-environment jsdom
 *
 * StaffRoster.test.tsx — рендер + фильтр по посту + клик "Улучшить" (F6).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ProgressionSystem } from '@/engine/contracts'
import type { ProgressionSnapshot } from '@/types'
import { useStore } from '@/state'
import { StaffRoster } from './StaffRoster'
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

const baseProgression: ProgressionSnapshot = {
  farmId: 'farm_1',
  farmLevel: 3,
  xp: 100,
  knowHow: { points: 5, activeSlots: 1, nodes: {} },
  staff: {
    staff_bruno: { version: 1, key: 'staff_bruno', level: 1, hired: true, assignedPost: 'Kitchen' },
  },
  routePass: { season: 1, tier: 0, xp: 0, track: 'free', claimedFree: [], claimedPremium: [] },
  streak: { streakDays: 0, state: 'active' },
  staffTokens: 50,
}

describe('StaffRoster (F6)', () => {
  beforeEach(() => {
    useStore.getState().setProgression(structuredClone(baseProgression))
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('рендерит все 12 карточек стаффа', () => {
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <StaffRoster />
      </ProgressionSystemProvider>,
    )
    expect(screen.getByTestId('staff-roster')).toBeTruthy()
    expect(screen.getAllByTestId(/^staff-card-/)).toHaveLength(12)
  })

  it('фильтр по посту Kitchen оставляет только 3 карточки', () => {
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <StaffRoster />
      </ProgressionSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('staff-tab-kitchen'))
    expect(screen.getAllByTestId(/^staff-card-/)).toHaveLength(3)
  })

  it('клик "Улучшить" вызывает ProgressionSystem.upgradeStaff для нанятого персонажа', async () => {
    const system = makeProgressionSystem()
    render(
      <ProgressionSystemProvider value={system}>
        <StaffRoster />
      </ProgressionSystemProvider>,
    )
    const btn = screen.getByTestId('staff-upgrade-staff_bruno') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(system.upgradeStaff).toHaveBeenCalledWith('staff_bruno')
  })

  it('не нанятый персонаж не показывает кнопку апгрейда', () => {
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <StaffRoster />
      </ProgressionSystemProvider>,
    )
    expect(screen.queryByTestId('staff-upgrade-staff_gus')).toBeNull()
  })

  it('onClose вызывается по клику на Закрыть', () => {
    const onClose = vi.fn()
    render(
      <ProgressionSystemProvider value={makeProgressionSystem()}>
        <StaffRoster onClose={onClose} />
      </ProgressionSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('staff-roster-close'))
    expect(onClose).toHaveBeenCalled()
  })
})
