/**
 * @vitest-environment jsdom
 *
 * Profile.test.tsx — рендер XP-полосы и разбивки Farm Value (C1/F9).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { FarmSnapshot, ProgressionSnapshot } from '@/types'
import { useStore } from '@/state'
import { Profile } from './Profile'

const baseFarm: FarmSnapshot = {
  farmId: 'farm_1',
  farmLevel: 5,
  plots: [],
  buildings: {},
  machines: [],
  animals: [],
  farmValue: { production: 1000, buildings: 500, collections: 100, cosmetics: 50, total: 1650 },
}

const baseProgression: ProgressionSnapshot = {
  farmId: 'farm_1',
  farmLevel: 5,
  xp: 1000,
  knowHow: { points: 0, activeSlots: 1, nodes: {} },
  staff: {},
  routePass: { season: 1, tier: 0, xp: 0, track: 'free', claimedFree: [], claimedPremium: [] },
  streak: { streakDays: 0, state: 'active' },
  staffTokens: 0,
}

describe('Profile (C1/F9)', () => {
  beforeEach(() => {
    useStore.getState().setFarm(structuredClone(baseFarm))
    useStore.getState().setProgression(structuredClone(baseProgression))
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('показывает панель без загруженных данных', () => {
    useStore.setState({ farm: null, progression: null })
    render(<Profile />)
    expect(screen.getByTestId('profile-panel')).toBeTruthy()
  })

  it('рендерит XP-полосу и итоговый Farm Value', () => {
    render(<Profile />)
    expect(screen.getByTestId('profile-xp-bar')).toBeTruthy()
    expect(screen.getByTestId('profile-farm-value-total').textContent).toBe('1650')
  })

  it('рендерит разбивку по 4 осям Farm Value', () => {
    render(<Profile />)
    expect(screen.getByTestId('profile-fv-axis-production').textContent).toContain('1000')
    expect(screen.getByTestId('profile-fv-axis-buildings').textContent).toContain('500')
    expect(screen.getByTestId('profile-fv-axis-collections').textContent).toContain('100')
    expect(screen.getByTestId('profile-fv-axis-cosmetics').textContent).toContain('50')
  })

  it('низкий Farm Value даёт стартовый титул Roadside Stand', () => {
    render(<Profile />)
    expect(screen.getByTestId('profile-farm-value-title').textContent).toContain('Придорожный лоток')
  })
})
