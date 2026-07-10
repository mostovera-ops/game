/**
 * @vitest-environment jsdom
 *
 * HudRoot.test.tsx — рендер верхнего/нижнего HUD + ключевые клики (AGENTS.md §4
 * «vitest, рендер+клик» для ui/). Смоук на уровне компонента (не Playwright).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useStore } from '@/state'
import { HudRoot } from './HudRoot'

function resetStore() {
  useStore.getState().goto('farm')
  useStore.getState().openPanel(null)
  useStore.setState((s) => ({
    econ: { ...s.econ, wallet: { bucks: 0, dimes: 0, tickets: 0, ribbons: 0 }, pendingDelta: {}, farmValue: null },
    ui: { ...s.ui, toasts: [], notifications: [], notifLastSeenAt: 0 },
    net: { ...s.net, online: true, reconnecting: false, queueLen: 0 },
    clock: { ...s.clock, calendar: null, serverOffset: 0 },
  }))
}

describe('HudRoot', () => {
  beforeEach(resetStore)
  afterEach(() => {
    vi.useRealTimers()
  })

  it('монтируется: бренд + бар валют + переключатель сцен', () => {
    render(<HudRoot />)
    expect(screen.getByTestId('brand').textContent).toBe('Sunnyside')
    expect(screen.getByTestId('currency-bar')).toBeTruthy()
    expect(screen.getByTestId('scene-switch')).toBeTruthy()
    expect(screen.getByTestId('scene-btn-farm')).toBeTruthy()
    expect(screen.getByTestId('scene-btn-town')).toBeTruthy()
    expect(screen.getByTestId('scene-btn-fair')).toBeTruthy()
  })

  it('показывает баланс валют из econ.wallet + оптимистичную дельту', () => {
    useStore.setState((s) => ({ econ: { ...s.econ, wallet: { bucks: 120, dimes: 3, tickets: 0, ribbons: 0 } } }))
    useStore.getState().addPendingDelta('bucks', 30)
    render(<HudRoot />)
    expect(screen.getByTestId('currency-bucks').textContent).toContain('150')
    expect(screen.getByTestId('currency-dimes').textContent).toContain('3')
  })

  it('клик по scene-btn-town меняет активную сцену в сторе', () => {
    render(<HudRoot />)
    fireEvent.click(screen.getByTestId('scene-btn-town'))
    expect(useStore.getState().scene.active).toBe('town')
  })

  it('колокол: бейдж показывает непрочитанные, клик открывает Notifications и снимает бейдж', () => {
    useStore.getState().pushNotification({ id: 'n1', kind: 'system', message: 'Грузовик вернулся', createdAt: 1000 })
    render(<HudRoot />)
    expect(screen.getByTestId('notif-badge').textContent).toBe('1')

    fireEvent.click(screen.getByTestId('notif-bell'))
    expect(screen.getByTestId('modal-ui_notif_log')).toBeTruthy()
    expect(screen.getByText('Грузовик вернулся')).toBeTruthy()
    expect(screen.queryByTestId('notif-badge')).toBeNull()
  })

  it('пустая лента уведомлений показывает тёплый empty-state', () => {
    render(<HudRoot />)
    fireEvent.click(screen.getByTestId('notif-bell'))
    expect(screen.getByTestId('notif-empty').textContent).toContain('Тихий день в Санисайде')
  })

  it('тост появляется в стеке и авто-скрывается по ttlMs', () => {
    vi.useFakeTimers()
    render(<HudRoot />)
    act(() => {
      useStore.getState().pushToast({ id: 't1', kind: 'info', message: 'Привет!', createdAt: Date.now(), ttlMs: 1000 })
    })
    expect(screen.getByTestId('toast-t1')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(useStore.getState().ui.toasts).toHaveLength(0)
  })

  it('dev-таймскип сдвигает clock.serverOffset и кладёт dev-тост (лента уведомлений — не отсюда)', () => {
    render(<HudRoot />)
    const before = useStore.getState().clock.serverOffset
    fireEvent.click(screen.getByTestId('dev-timeskip'))
    expect(useStore.getState().clock.serverOffset).toBe(before + 60 * 60 * 1000)
    expect(useStore.getState().ui.toasts.length).toBeGreaterThan(0)
    // Реальные нотификации идут через событийный канал адаптера/диф снапшотов
    // (app/notifications.ts), не через демо-заполнение кнопки — здесь лента пуста.
    expect(useStore.getState().ui.notifications.length).toBe(0)
  })
})
