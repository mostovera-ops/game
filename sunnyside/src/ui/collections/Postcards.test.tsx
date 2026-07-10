/**
 * @vitest-environment jsdom
 *
 * Postcards.test.tsx — C5 владение открыткой + прогресс/бафф собранного сета.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/state'
import { Postcards } from './Postcards'

describe('Postcards (C5)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('пустое состояние без открыток', () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [] })
    render(<Postcards />)
    expect(screen.getByTestId('postcards-empty')).toBeTruthy()
    expect(screen.getByTestId('postcard-postcard_home').getAttribute('data-owned')).toBe('false')
  })

  it('сет «Home Region» собран → data-complete=true и бафф в тексте', () => {
    useStore.getState().setCollections({
      toys: {},
      cosmetics: {},
      postcards: [{ key: 'postcard_home', stateKey: 'st_home', owned: true }],
      ribbons: [],
    })
    render(<Postcards />)
    expect(screen.getByTestId('postcard-postcard_home').getAttribute('data-owned')).toBe('true')
    const set = screen.getByTestId('postcard-set-postcards_home_region')
    expect(set.getAttribute('data-complete')).toBe('true')
    expect(set.textContent).toMatch(/скорость грузовика/)
  })
})
