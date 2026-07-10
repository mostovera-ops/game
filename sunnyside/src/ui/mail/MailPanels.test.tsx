/**
 * @vitest-environment jsdom
 *
 * MailPanels.test.tsx — панели Каталога почтой (`ui_mail_catalog`/`ui_mailbox`,
 * 08-mail-foraging §3.1). Мокаем `MailForagingSystem` (без сети), фиксируем кошелёк/часы
 * в сторе; проверяем состав витрины, вызов order/claim/speedup и лимиты.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import type { MailForagingSystem } from '@/engine/contracts'
import type { MailForagingSnapshot, MailOrder, RpcResult, ForageRes, FishCastRes } from '@/types'
import { CATALOG_POSITIONS_TOTAL } from '@/engine/mail-foraging'
import { MailSystemProvider } from './MailSystemContext'
import { MailCatalog } from './MailCatalog'
import { MailboxPanel } from './MailboxPanel'

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data }
}
function offline<T>(): RpcResult<T> {
  return { ok: false, error: { code: 'offline', message: '' } }
}

function makeSystem(orders: MailOrder[]) {
  const calls = { order: [] as string[], speedup: [] as string[], claim: [] as string[][] }
  const system: MailForagingSystem = {
    order: vi.fn(async (k: string) => {
      calls.order.push(k)
      return ok({ orderId: 'o_new', deliverAt: 0 })
    }),
    speedup: vi.fn(async (id: string) => {
      calls.speedup.push(id)
      return ok({ deliverAt: 0 })
    }),
    claim: vi.fn(async (ids: string[]) => {
      calls.claim.push(ids)
      return ok({ items: [] })
    }),
    snapshot: vi.fn(async () => ok<MailForagingSnapshot>({ orders, foragePoints: [] })),
    forageClaim: vi.fn(async () => offline<ForageRes>()),
    forageCollect: vi.fn(async () => offline<ForageRes>()),
    fish: vi.fn(async () => offline<FishCastRes>()),
  }
  return { system, calls }
}

function resetStore() {
  useStore.getState().openPanel(null)
  useStore.setState((s) => ({
    ui: { ...s.ui, locale: 'ru' },
    econ: { ...s.econ, wallet: { bucks: 100_000, dimes: 1000, tickets: 0, ribbons: 0 } },
    clock: { ...s.clock, serverOffset: 0 },
  }))
}

describe('MailCatalog (ui_mail_catalog, §3.1.7)', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it('рендерит витрину из 12 позиций и заказывает по клику', async () => {
    const { system, calls } = makeSystem([])
    render(
      <MailSystemProvider value={system}>
        <MailCatalog />
      </MailSystemProvider>,
    )
    expect(screen.getByTestId('ui-mail-catalog')).toBeTruthy()
    const items = screen.getAllByTestId(/^mail-item-/)
    expect(items.length).toBe(CATALOG_POSITIONS_TOTAL)

    const firstOrderBtn = screen.getAllByTestId(/^mail-order-/)[0]!
    fireEvent.click(firstOrderBtn)
    await waitFor(() => expect(calls.order.length).toBe(1))
  })
})

describe('MailboxPanel (ui_mailbox, §3.1.3)', () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  const now = Date.now()
  const order = (id: string, deliverAt: number): MailOrder => ({
    version: 1,
    id,
    itemKey: 'tool_silo_boost',
    qty: 1,
    state: 'in_transit',
    orderedAt: now - 3_600_000,
    deliverAt,
  })

  it('готовый заказ показывает «Забрать» и зовёт claim', async () => {
    const { system, calls } = makeSystem([order('rdy', now - 1000)])
    render(
      <MailSystemProvider value={system}>
        <MailboxPanel />
      </MailSystemProvider>,
    )
    const claimBtn = await screen.findByTestId('mailbox-claim-rdy')
    fireEvent.click(claimBtn)
    await waitFor(() => expect(calls.claim).toEqual([['rdy']]))
  })

  it('заказ в пути показывает «Ускорить» и зовёт speedup', async () => {
    const { system, calls } = makeSystem([order('pend', now + 6 * 3_600_000)])
    render(
      <MailSystemProvider value={system}>
        <MailboxPanel />
      </MailSystemProvider>,
    )
    const speedBtn = await screen.findByTestId('mailbox-speedup-pend')
    fireEvent.click(speedBtn)
    await waitFor(() => expect(calls.speedup).toEqual(['pend']))
  })

  it('пустой ящик показывает подсказку', async () => {
    const { system } = makeSystem([])
    render(
      <MailSystemProvider value={system}>
        <MailboxPanel />
      </MailSystemProvider>,
    )
    expect(await screen.findByTestId('mailbox-empty')).toBeTruthy()
  })
})
