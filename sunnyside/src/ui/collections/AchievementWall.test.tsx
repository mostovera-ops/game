/**
 * @vitest-environment jsdom
 *
 * AchievementWall.test.tsx — C6 прогресс X/Y, клик Hang переключает витрину.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import { AchievementWall } from './AchievementWall'

describe('AchievementWall (C6)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('показывает прогресс X/Y и запертую табличку без кнопки Hang', () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [], achievementsUnlocked: ['ach_first_harvest'] })
    render(<AchievementWall />)
    expect(screen.getByTestId('achievement-wall-progress').textContent).toMatch(/^1 \//)
    expect(screen.getByTestId('achievement-ach_first_harvest').getAttribute('data-unlocked')).toBe('true')
    expect(screen.queryByTestId('achievement-hang-ach_100_crops')).toBeNull()
  })

  it('клик Hang переключает data-hung на разблокированной табличке', () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [], achievementsUnlocked: ['ach_first_harvest'] })
    render(<AchievementWall />)
    const btn = screen.getByTestId('achievement-hang-ach_first_harvest')
    expect(screen.getByTestId('achievement-ach_first_harvest').getAttribute('data-hung')).toBe('false')
    fireEvent.click(btn)
    expect(screen.getByTestId('achievement-ach_first_harvest').getAttribute('data-hung')).toBe('true')
  })
})
