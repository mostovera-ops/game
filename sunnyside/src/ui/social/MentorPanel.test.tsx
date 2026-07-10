/**
 * @vitest-environment jsdom
 *
 * MentorPanel.test.tsx — рендер + пул/пара/вехи. Прогресс читается из РЕАЛЬНЫХ полей
 * стора (`farm.farmLevel`, `town.coopOrders`, `town.potluck`, `fair.stall`) — пара
 * ментор/менти сама — локальный `mentorStore` (пробел бэкенда, см. докстринг файла).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import type { TownSnapshot, FarmSnapshot } from '@/types'
import { MentorPanel } from './MentorPanel'
import { useMentorStore } from './mentorStore'

function seedTown() {
  const town: TownSnapshot = {
    townId: 'town_1',
    streets: [{ id: 'street_1', name: 'Maple Street', memberCount: 1, farmIds: ['farm_a'] }],
    projects: {},
    roster: [
      { userId: 'user_a', farmId: 'farm_a', displayName: 'Big Joe', streetId: 'street_1' },
      { userId: 'user_me', farmId: 'farm_me', displayName: 'Me', streetId: 'street_1' },
    ],
    coopOrders: [],
    migrations: [],
    movingVan: { cooldownUntil: 0 },
  }
  useStore.getState().setTown(town)
  useStore.getState().setIdentity({
    userId: 'user_me',
    farmId: 'farm_me',
    streetId: 'street_1',
    townId: 'town_1',
    displayName: 'Me',
    authStatus: 'guest',
  })
}

describe('MentorPanel (11-town §3.7)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, town: null, farm: null })
    useMentorStore.getState().reset()
  })

  it('без пары — показывает пул и кандидатов, позволяет пригласить ментора', () => {
    seedTown()
    render(<MentorPanel />)
    expect(screen.getByTestId('mentor-pool-optin')).toBeTruthy()
    expect(screen.getByTestId('mentor-candidate-list')).toBeTruthy()
    fireEvent.click(screen.getByTestId('mentor-request-user_a'))
    expect(useMentorStore.getState().links).toHaveLength(1)
    expect(useMentorStore.getState().links[0]).toMatchObject({ partnerId: 'user_a', myRole: 'mentee' })
  })

  it('с парой менти — показывает вехи, отмечает выполненную по farm_level_5 из реального farmLevel', () => {
    seedTown()
    useMentorStore.getState().addLink({ partnerId: 'user_a', partnerName: 'Big Joe', myRole: 'mentee', since: 1 })
    const farm: FarmSnapshot = {
      farmId: 'farm_me',
      farmLevel: 5,
      plots: [],
      buildings: {},
      machines: [],
      animals: [],
      farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
    }
    useStore.getState().setFarm(farm)

    render(<MentorPanel />)
    expect(screen.getByTestId('mentor-mentee-partner').textContent).toContain('Big Joe')
    expect(screen.getByTestId('mentor-milestone-farm_level_5').textContent).toContain('✅')
    // Уровень 5 достигнут → доступна кнопка выпуска.
    expect(screen.getByTestId('mentor-graduate-btn')).toBeTruthy()
  })

  it('вехи НЕ отмечаются без реальных данных стора (нет фарма/фермы уровня 5)', () => {
    seedTown()
    useMentorStore.getState().addLink({ partnerId: 'user_a', partnerName: 'Big Joe', myRole: 'mentee', since: 1 })
    render(<MentorPanel />)
    expect(screen.getByTestId('mentor-milestone-farm_level_5').textContent).toContain('⬜️')
    expect(screen.queryByTestId('mentor-graduate-btn')).toBeNull()
  })

  it('ментор с 2 менти не может взять третьего (кнопка disabled)', () => {
    seedTown()
    useMentorStore.getState().addLink({ partnerId: 'x1', partnerName: 'X1', myRole: 'mentor', since: 1 })
    useMentorStore.getState().addLink({ partnerId: 'x2', partnerName: 'X2', myRole: 'mentor', since: 2 })
    render(<MentorPanel />)
    fireEvent.click(screen.getByTestId('mentor-role-mentor'))
    const btn = screen.getByTestId('mentor-request-user_a') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
