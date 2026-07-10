/**
 * @vitest-environment jsdom
 *
 * FarmVisitPanel.test.tsx — рендер + клики панели визита (F8 Neighbor Visit, 11-town §3.10).
 * Компонент — чистый DOM (ноль three/@react-three), поэтому тестируем напрямую через
 * @testing-library/react без Canvas/WebGL (TownScene.tsx оборачивает его в drei `<Html>`
 * только при монтаже внутри сцены — см. AGENTS.md §4 «клик через @testing-library/react
 * при необходимости»).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FarmVisitPanel } from './FarmVisitPanel'

const farm = { farmId: 'farm-1', displayName: 'Betty', streetId: 'street-maple' }

describe('FarmVisitPanel (F8)', () => {
  it('показывает имя фермы и стрит', () => {
    render(<FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={vi.fn()} onGift={vi.fn()} />)
    expect(screen.getByTestId('farm-visit-title').textContent).toMatch(/Betty/)
    expect(screen.getByText(/street-maple/)).toBeTruthy()
  })

  it('клик «Полить» вызывает onHelp("water")', () => {
    const onHelp = vi.fn()
    render(<FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={onHelp} onGift={vi.fn()} />)
    fireEvent.click(screen.getByTestId('farm-visit-water'))
    expect(onHelp).toHaveBeenCalledWith('water')
  })

  it('клик «Cheer» вызывает onHelp("cheer")', () => {
    const onHelp = vi.fn()
    render(<FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={onHelp} onGift={vi.fn()} />)
    fireEvent.click(screen.getByTestId('farm-visit-cheer'))
    expect(onHelp).toHaveBeenCalledWith('cheer')
  })

  it('клик «Подарить» вызывает onGift', () => {
    const onGift = vi.fn()
    render(<FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={vi.fn()} onGift={onGift} />)
    fireEvent.click(screen.getByTestId('farm-visit-gift'))
    expect(onGift).toHaveBeenCalledTimes(1)
  })

  it('клик по крестику и по подложке закрывает панель (onClose)', () => {
    const onClose = vi.fn()
    render(<FarmVisitPanel farm={farm} onClose={onClose} onHelp={vi.fn()} onGift={vi.fn()} />)
    fireEvent.click(screen.getByTestId('farm-visit-close'))
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    fireEvent.click(screen.getByTestId('farm-visit-panel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('клик внутри карточки не закрывает панель (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<FarmVisitPanel farm={farm} onClose={onClose} onHelp={vi.fn()} onGift={vi.fn()} />)
    fireEvent.click(screen.getByTestId('farm-visit-title'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('дневной лимит помощи: 0 осталось → тёплый отказ, не ошибка (P3, T3 11-town §7)', () => {
    render(<FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={vi.fn()} onGift={vi.fn()} helpsLeftToday={0} />)
    expect(screen.getByText(/хватит/i)).toBeTruthy()
  })

  it('helpDisabled/giftDisabled отключают соответствующие кнопки', () => {
    render(
      <FarmVisitPanel farm={farm} onClose={vi.fn()} onHelp={vi.fn()} onGift={vi.fn()} helpDisabled giftDisabled />,
    )
    expect((screen.getByTestId('farm-visit-water') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('farm-visit-gift') as HTMLButtonElement).disabled).toBe(true)
  })
})
