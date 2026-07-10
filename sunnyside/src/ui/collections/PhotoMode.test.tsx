/**
 * @vitest-environment jsdom
 *
 * PhotoMode.test.tsx — C7 выбор фильтра, Snap без готовой сцены → мягкая ошибка
 * (canon P3 — «кадр не сохранился, сними ещё», без реального canvas в jsdom).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useStore } from '@/state'
import { PhotoMode } from './PhotoMode'

describe('PhotoMode (C7)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('переключает активный фильтр', () => {
    render(<PhotoMode />)
    const sepia = screen.getByTestId('photo-filter-sepia')
    fireEvent.click(sepia)
    expect(sepia.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('photo-filter-kodachrome').getAttribute('aria-pressed')).toBe('false')
  })

  it('кнопка скачивания выключена без сделанного снимка', () => {
    render(<PhotoMode />)
    expect((screen.getByTestId('photo-download') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Snap без доступного canvas — мягкая ошибка, без падения', async () => {
    render(<PhotoMode />)
    fireEvent.click(screen.getByTestId('photo-snap'))
    await waitFor(() => expect(screen.getByTestId('photo-mode-error')).toBeTruthy())
    expect((screen.getByTestId('photo-download') as HTMLButtonElement).disabled).toBe(true)
  })
})
