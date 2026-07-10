/**
 * @vitest-environment jsdom
 *
 * DemandBoard.test.tsx — рендер E/данные (W6, 19-ui-ux §3.6).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/state'
import { DemandBoardScreen } from './DemandBoard'

describe('DemandBoardScreen (W6)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, demand: null })
  })

  it('пустое состояние до первой загрузки доски', () => {
    render(<DemandBoardScreen />)
    expect(screen.getByTestId('ui-demand-board')).toBeTruthy()
    expect(screen.getByTestId('demand-board-empty')).toBeTruthy()
  })

  it('рендерит категории со стрелками/процентом и ностальгия-бонус', () => {
    useStore.getState().setDemand({
      weekIndex: 3,
      seed: 42,
      board: { bakery: 1.25, garden: 0.85, dairy: 1.0 },
      nostalgia: ['bakery'],
    })
    render(<DemandBoardScreen />)
    expect(screen.queryByTestId('demand-board-empty')).toBeNull()
    const bakeryRow = screen.getByTestId('demand-row-bakery')
    expect(bakeryRow.textContent).toContain('▲')
    expect(bakeryRow.textContent).toContain('+25%')
    expect(bakeryRow.textContent).toContain('Ностальгия-бонус ×2')

    const gardenRow = screen.getByTestId('demand-row-garden')
    expect(gardenRow.textContent).toContain('▼')
    expect(gardenRow.textContent).toContain('-15%')

    const dairyRow = screen.getByTestId('demand-row-dairy')
    expect(dairyRow.textContent).toContain('±0')
  })
})
