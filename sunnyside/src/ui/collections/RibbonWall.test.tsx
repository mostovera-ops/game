/**
 * @vitest-environment jsdom
 *
 * RibbonWall.test.tsx — C3 пустое состояние + подсветка последней ленты.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/state'
import { RibbonWall } from './RibbonWall'

describe('RibbonWall (C3)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('пустое состояние без лент', () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [] })
    render(<RibbonWall />)
    expect(screen.getByTestId('ribbon-wall-empty')).toBeTruthy()
  })

  it('последняя по weekIndex лента подсвечена data-latest=true', () => {
    useStore.getState().setCollections({
      toys: {},
      cosmetics: {},
      postcards: [],
      ribbons: [
        { id: 'r1', contestKey: 'ct_pie_week', weekIndex: 1, rank: 1 },
        { id: 'r2', contestKey: 'ct_giant_veg', weekIndex: 3, rank: 2 },
      ],
    })
    render(<RibbonWall />)
    expect(screen.getByTestId('ribbon-r2').getAttribute('data-latest')).toBe('true')
    expect(screen.getByTestId('ribbon-r1').getAttribute('data-latest')).toBe('false')
  })
})
