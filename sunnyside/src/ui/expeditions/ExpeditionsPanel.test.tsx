/**
 * @vitest-environment jsdom
 *
 * ExpeditionsPanel.test.tsx — экран роуд-трипа (`ui_expeditions`, 07-expeditions §5).
 * Мокаем `ExpeditionSystem` (DI) — компонент не ходит в сеть сам (AGENTS.md §0.3);
 * проверяем карту-ленту, отправку, прогресс активного рейса, сбор груза, открытки.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { ExpeditionSystem } from '@/engine/contracts'
import type { Expedition, ExpeditionsSnapshot, RpcResult } from '@/types'
import { useStore } from '@/state'
import { ExpeditionsPanel } from './ExpeditionsPanel'
import { ExpeditionSystemProvider } from './ExpeditionSystemContext'

const HOUR = 3_600_000

function makeSystem(
  snapshot: ExpeditionsSnapshot,
  overrides: Partial<ExpeditionSystem> = {},
): ExpeditionSystem {
  return {
    start: vi.fn(async () => ({ ok: true, data: { expedition: {} as Expedition } }) as never),
    collect: vi.fn(async () => ({ ok: true, data: { items: [] } }) as never),
    list: vi.fn(async (): Promise<RpcResult<ExpeditionsSnapshot>> => ({ ok: true, data: snapshot })),
    ...overrides,
  }
}

const EMPTY_SNAPSHOT: ExpeditionsSnapshot = {
  expeditions: [],
  speedLevel: 0,
  routeSlots: 1,
  hasStaffGus: false,
}

function resetStore() {
  useStore.getState().openPanel('ui_expeditions')
  useStore.setState((s) => ({
    ui: { ...s.ui, locale: 'ru' },
    econ: { ...s.econ, wallet: { bucks: 5000, dimes: 100, tickets: 0, ribbons: 0 } },
    collections: {
      toys: {},
      cosmetics: {},
      postcards: [],
      ribbons: [],
      achievementsUnlocked: [],
      achievementsHung: [],
      recipeMastery: {},
      neonSign: null,
      photos: [],
    },
  }))
}

async function renderPanel(system: ExpeditionSystem) {
  await act(async () => {
    render(
      <ExpeditionSystemProvider value={system}>
        <ExpeditionsPanel />
      </ExpeditionSystemProvider>,
    )
  })
}

describe('ExpeditionsPanel (07-expeditions §5)', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('открытие панели зовёт list() и рисует карту-ленту волны 1 (8 стопов)', async () => {
    const system = makeSystem(EMPTY_SNAPSHOT)
    await renderPanel(system)
    expect(system.list).toHaveBeenCalled()
    // st_home всегда открыт (лестница §3.1), st_california — залочен без предыдущих открыток.
    expect(screen.getByTestId('expedition-stop-st_home').getAttribute('data-status')).toBe('unvisited')
    expect(screen.getByTestId('expedition-stop-st_california').getAttribute('data-status')).toBe('locked')
    expect(screen.getByTestId('expeditions-postcards-empty')).toBeTruthy()
  })

  it('выбор открытого стопа → «Отправить» зовёт start() с первым свободным routeSlot', async () => {
    const system = makeSystem(EMPTY_SNAPSHOT)
    await renderPanel(system)
    await act(async () => fireEvent.click(within(screen.getByTestId('expedition-stop-st_home')).getByRole('button')))
    await act(async () => fireEvent.click(screen.getByTestId('expedition-send')))
    expect(system.start).toHaveBeenCalledWith({ stateKey: 'st_home', routeSlot: 0 })
  })

  it('активный рейс: таймер идёт, до возврата нет кнопки сбора', async () => {
    const now = useStore.getState().serverNow()
    const exp: Expedition = {
      version: 1,
      id: 'exp-1',
      stateKey: 'st_illinois',
      routeSlot: 0,
      state: 'en_route',
      startedAt: now,
      returnAt: now + 6 * HOUR,
    }
    const system = makeSystem({ ...EMPTY_SNAPSHOT, expeditions: [exp] })
    await renderPanel(system)
    expect(screen.getByTestId('expedition-active-exp-1')).toBeTruthy()
    expect(screen.queryByTestId('expedition-collect-exp-1')).toBeNull()
    // Единственный слот занят → отправка заблокирована (X3).
    expect(screen.getByTestId('expeditions-no-slots')).toBeTruthy()
  })

  it('вернувшийся рейс: «Разгрузить» зовёт collect() и показывает привезённый груз', async () => {
    const now = useStore.getState().serverNow()
    const exp: Expedition = {
      version: 1,
      id: 'exp-2',
      stateKey: 'st_illinois',
      routeSlot: 0,
      state: 'en_route',
      startedAt: now - 7 * HOUR,
      returnAt: now - HOUR, // уже вернулся
    }
    const collect = vi.fn(async () => ({
      ok: true,
      data: { items: [{ key: 'crop_beef' as const, qty: 6, quality: 1 as const }] },
    }) as never)
    const system = makeSystem({ ...EMPTY_SNAPSHOT, expeditions: [exp] }, { collect })
    await renderPanel(system)
    const btn = screen.getByTestId('expedition-collect-exp-2')
    await act(async () => fireEvent.click(btn))
    expect(collect).toHaveBeenCalledWith(['exp-2'])
    expect(screen.getByTestId('expeditions-cargo')).toBeTruthy()
  })

  it('собранная открытка → стоп «visited», следующий по лестнице открывается', async () => {
    useStore.setState((s) => ({
      collections: s.collections
        ? { ...s.collections, postcards: [{ key: 'postcard_home', stateKey: 'st_home', owned: true }] }
        : s.collections,
    }))
    const system = makeSystem(EMPTY_SNAPSHOT)
    await renderPanel(system)
    expect(screen.getByTestId('expedition-stop-st_home').getAttribute('data-status')).toBe('visited')
    // st_illinois разблокирован завершённым рейсом в st_home (§3.1/§3.3).
    expect(screen.getByTestId('expedition-stop-st_illinois').getAttribute('data-status')).toBe('unvisited')
    expect(screen.getByTestId('expeditions-postcards')).toBeTruthy()
  })

  it('list() падает → тёплый экран ошибки с ретраем', async () => {
    const system = makeSystem(EMPTY_SNAPSHOT, {
      list: vi.fn(
        async (): Promise<RpcResult<ExpeditionsSnapshot>> => ({ ok: false, error: { code: 'offline', message: 'нет сети' } }),
      ),
    })
    await renderPanel(system)
    expect(screen.getByTestId('expeditions-error')).toBeTruthy()
    expect(screen.getByTestId('expeditions-retry')).toBeTruthy()
  })
})
