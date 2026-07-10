/**
 * @vitest-environment jsdom
 *
 * FishingQte.test.tsx — смоук фаз мини-игры (BL-1, 08-mail-foraging §3.2.4). Чистая
 * математика Catch Bar покрыта node-тестом `engine/mail-foraging/fishing.test.ts` — здесь
 * только таймеры/фазы/итог колбэка (ui-граница).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useStore } from '@/state'
import { FishingQte } from './FishingQte'
import { FISHING_ATTEMPTS_PER_CAST } from '@/engine/mail-foraging/constants'

describe('FishingQte (BL-1)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('стартует в фазе заброса, затем открывает Catch Bar через 2с', () => {
    render(<FishingQte onClose={vi.fn()} onCastComplete={vi.fn()} />)
    expect(screen.getByTestId('fishing-qte-casting')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('fishing-qte-bar')).toBeTruthy()
  })

  it('3 попытки «Тяни!» → фаза done → onCastComplete с числом попаданий 0..3', () => {
    const onCastComplete = vi.fn()
    render(<FishingQte onClose={vi.fn()} onCastComplete={onCastComplete} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    for (let i = 0; i < FISHING_ATTEMPTS_PER_CAST; i++) {
      act(() => {
        fireEvent.click(screen.getByTestId('fishing-qte-pull'))
      })
    }

    expect(onCastComplete).toHaveBeenCalledTimes(1)
    const hits = onCastComplete.mock.calls[0]![0] as number
    expect(hits).toBeGreaterThanOrEqual(0)
    expect(hits).toBeLessThanOrEqual(FISHING_ATTEMPTS_PER_CAST)
    expect(screen.getByTestId('fishing-qte-done')).toBeTruthy()
  })

  it('закрытие ДО итога не зовёт onCastComplete (отмена без начисления)', () => {
    const onCastComplete = vi.fn()
    const onClose = vi.fn()
    render(<FishingQte onClose={onClose} onCastComplete={onCastComplete} />)

    act(() => {
      fireEvent.click(screen.getByTestId('fishing-qte-close'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onCastComplete).not.toHaveBeenCalled()
  })
})
