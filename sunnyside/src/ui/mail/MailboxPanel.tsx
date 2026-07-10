/**
 * ui/mail/MailboxPanel.tsx — экран `ui_mailbox` (08-mail-foraging §3.1.3/§3.1.7 «На пути»):
 * заказы «в пути» (до 5), прогресс-бар доставки, ETA, кнопка «Ускорить за ◉», сбор
 * готовых посылок в 1 клик. Открывается кликом по почтовому ящику на ферме и из каталога.
 *
 * Готовность = `serverNow() >= deliverAt` (таймер истёк ≠ начислено — забор отдельной
 * подтверждаемой мутацией `claim`, AGENTS.md §0.4). Цена ускорения — из движка
 * (`speedupCostDimes`), клиент не считает (§0.3).
 *
 * ГРАНИЦА: ноль three/net. Время — `serverNow()` стора.
 */
import { useStore } from '@/state'
import {
  catalogItemOf,
  speedupCostDimes,
  deliveryProgress,
  MAX_ORDERS_IN_TRANSIT,
  type MailCatalogItem,
} from '@/engine/mail-foraging'
import type { MailOrder } from '@/types'
import { MAIL, PRINT_SHADOW } from './tokens'
import { priceLabel, countdown } from './format'
import { useMailSystem } from './MailSystemContext'
import { useMailSnapshot, useTick } from './useMail'

function itemName(order: MailOrder, ru: boolean): string {
  const it: MailCatalogItem | undefined = catalogItemOf(order.itemKey)
  if (it) return ru ? it.name.ru : it.name.en
  return order.itemKey
}

export function MailboxPanel() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const serverNow = useStore((s) => s.serverNow)
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const pushToast = useStore((s) => s.pushToast)
  const mail = useMailSystem()
  const { orders, refresh } = useMailSnapshot()
  useTick(true)

  const now = serverNow()
  // Только активные посылки (claimed текущей недели держатся в снапшоте ради лимитов — не показываем).
  const active = orders.filter((o) => o.state === 'in_transit')
  const ready = active.filter((o) => now >= o.deliverAt)

  async function speedup(order: MailOrder) {
    const res = await mail.speedup(order.id)
    refresh()
    if (res.ok) {
      pushToast({
        id: `mail_speedup_${Date.now()}`,
        kind: 'success',
        message: ru ? 'Доставку ускорили!' : 'Delivery sped up!',
        createdAt: Date.now(),
        ttlMs: 2600,
      })
    }
  }

  async function claim(ids: string[]) {
    if (ids.length === 0) return
    const res = await mail.claim(ids)
    refresh()
    if (res.ok) {
      pushToast({
        id: `mail_claim_${Date.now()}`,
        kind: 'success',
        message: ru ? 'Посылка у тебя!' : 'Parcel collected!',
        createdAt: Date.now(),
        ttlMs: 2600,
      })
    }
  }

  return (
    <section
      data-testid="ui-mailbox"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: MAIL.card, color: MAIL.ink, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-baseline justify-between border-b border-dotted pb-2" style={{ borderColor: MAIL.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">{ru ? 'Почтовый ящик' : 'Mailbox'}</h2>
        <span className="text-xs tabular-nums opacity-70">{ru ? 'В пути' : 'On the Way'}: {active.length}/{MAX_ORDERS_IN_TRANSIT}</span>
      </header>

      {active.length === 0 && (
        <p data-testid="mailbox-empty" className="py-6 text-center text-sm opacity-60">
          {ru ? 'Ящик пуст — загляни в каталог Винни.' : 'Empty — check Winnie’s catalog.'}
        </p>
      )}

      <ul className="flex flex-col gap-2" data-testid="mailbox-list">
        {active.map((order) => {
          const isReady = now >= order.deliverAt
          const pct = Math.round(deliveryProgress(order.orderedAt, order.deliverAt, now) * 100)
          const cost = speedupCostDimes(order.deliverAt, now)
          return (
            <li
              key={order.id}
              data-testid={`mailbox-order-${order.id}`}
              className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5"
              style={{ borderColor: MAIL.chrome }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{itemName(order, ru)}</span>
                <span className="text-xs tabular-nums opacity-70">
                  {isReady ? (ru ? 'Готово' : 'Ready') : countdown(order.deliverAt - now, locale)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: MAIL.chrome }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: isReady ? MAIL.teal : MAIL.mustard }}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-0.5">
                {isReady ? (
                  <button
                    type="button"
                    data-testid={`mailbox-claim-${order.id}`}
                    onClick={() => void claim([order.id])}
                    className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
                    style={{ background: MAIL.teal }}
                  >
                    {ru ? 'Забрать' : 'Collect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`mailbox-speedup-${order.id}`}
                    disabled={dimesBalance < cost}
                    onClick={() => void speedup(order)}
                    className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                    style={{ background: MAIL.cherry }}
                  >
                    {ru ? 'Ускорить' : 'Speed up'} · {priceLabel(cost, 'dimes')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {ready.length > 1 && (
        <button
          type="button"
          data-testid="mailbox-claim-all"
          onClick={() => void claim(ready.map((o) => o.id))}
          className="self-center rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
          style={{ background: MAIL.teal }}
        >
          {ru ? `Забрать всё (${ready.length})` : `Collect all (${ready.length})`}
        </button>
      )}
    </section>
  )
}
