/**
 * @vitest-environment jsdom
 *
 * GoneFishinToggle.test.tsx — Gone Fishin' (16-retention §3.5). Мокаем `RetentionSystem`
 * (DI) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { RetentionSystem } from '@/engine/retention'
import { useStore } from '@/state'
import type { FarmSnapshot } from '@/types'
import { GoneFishinToggle } from './GoneFishinToggle'
import { RetentionSystemProvider } from './RetentionSystemContext'

function makeRetentionSystem(overrides: Partial<RetentionSystem> = {}): RetentionSystem {
  return {
    streakCheck: vi.fn(async () => ({ ok: true, data: { streakDays: 0, state: 'active' } }) as never),
    streakInsure: vi.fn(async () => ({ ok: true, data: { insuredUntil: 0 } }) as never),
    vacationStart: vi.fn(async () => ({ ok: true, data: { vacationUntil: 1_000_000 } }) as never),
    vacationEnd: vi.fn(async () => ({ ok: true, data: { vacationUntil: 0 } }) as never),
    ...overrides,
  }
}

const baseFarm: FarmSnapshot = {
  farmId: 'farm_me',
  farmLevel: 1,
  plots: [],
  buildings: {},
  machines: [],
  animals: [],
  farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
}

describe('GoneFishinToggle (16-retention §3.5)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, farm: baseFarm })
  })

  it('без активного отпуска — показывает слайдер и кнопку «Уехать»', () => {
    render(
      <RetentionSystemProvider value={makeRetentionSystem()}>
        <GoneFishinToggle />
      </RetentionSystemProvider>,
    )
    expect(screen.getByTestId('gone-fishin-days')).toBeTruthy()
    expect(screen.getByTestId('gone-fishin-start-btn')).toBeTruthy()
  })

  it('клик «Уехать» вызывает RetentionSystem.vacationStart с requestedDays', async () => {
    const retention = makeRetentionSystem()
    render(
      <RetentionSystemProvider value={retention}>
        <GoneFishinToggle />
      </RetentionSystemProvider>,
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('gone-fishin-start-btn'))
    })
    expect(retention.vacationStart).toHaveBeenCalledWith(
      expect.objectContaining({ requestedDays: 7, hasActiveVacation: false }),
    )
  })

  it('с активным отпуском (farm.vacationUntil в будущем) — показывает статус и кнопку возврата', async () => {
    useStore.setState({ farm: { ...baseFarm, vacationUntil: Date.now() + 100_000 } })
    const retention = makeRetentionSystem()
    render(
      <RetentionSystemProvider value={retention}>
        <GoneFishinToggle />
      </RetentionSystemProvider>,
    )
    expect(screen.getByTestId('gone-fishin-status')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByTestId('gone-fishin-end-btn'))
    })
    expect(retention.vacationEnd).toHaveBeenCalled()
  })
})
