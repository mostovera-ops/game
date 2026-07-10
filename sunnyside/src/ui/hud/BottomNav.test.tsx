/**
 * @vitest-environment jsdom
 *
 * BottomNav.test.tsx — навигация сцен «по фазе»: Fair доступен для клика всегда
 * (P3 — без наказания), но визуально приглушён вне окна ярмарки (19-ui-ux U3).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import { BottomNav } from './BottomNav'

const weekStart = 1_000_000_000 // произвольный, детерминированный якорь для теста

describe('BottomNav', () => {
  beforeEach(() => {
    useStore.getState().goto('farm')
    useStore.setState((s) => ({ clock: { ...s.clock, calendar: null, serverOffset: 0 } }))
  })

  it('без календаря (ещё не загружен) — все кнопки активны на вид', () => {
    render(<BottomNav />)
    const fairBtn = screen.getByTestId('scene-btn-fair')
    expect(fairBtn.className).not.toContain('text-white/40')
  })

  it('вне окна ярмарки — Fair визуально приглушён, но клик всё равно работает', () => {
    useStore.getState().setCalendar({
      townId: 't1',
      weekIndex: 1,
      phase: 'mon_plan',
      rolloverAt: weekStart + 7 * 86_400_000,
      fairWindow: { opensAt: weekStart + 5 * 86_400_000, closesAt: weekStart + 6.5 * 86_400_000 },
      coopDeadlineAt: weekStart + 3 * 86_400_000,
      eventFinalAt: weekStart + 6.83 * 86_400_000,
    })
    useStore.getState().setServerOffset(weekStart - Date.now())

    render(<BottomNav />)
    const fairBtn = screen.getByTestId('scene-btn-fair')
    expect(fairBtn.className).toContain('text-white/40')

    fireEvent.click(fairBtn)
    expect(useStore.getState().scene.active).toBe('fair')
  })

  it('в окне ярмарки — Fair не приглушён', () => {
    useStore.getState().setCalendar({
      townId: 't1',
      weekIndex: 1,
      phase: 'sat_fair',
      rolloverAt: weekStart + 7 * 86_400_000,
      fairWindow: { opensAt: weekStart, closesAt: weekStart + 1.5 * 86_400_000 },
      coopDeadlineAt: weekStart,
      eventFinalAt: weekStart + 1.83 * 86_400_000,
    })
    useStore.getState().setServerOffset(weekStart - Date.now())

    render(<BottomNav />)
    expect(screen.getByTestId('scene-btn-fair').className).not.toContain('text-white/40')
  })
})
