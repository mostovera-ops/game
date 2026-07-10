/**
 * CoopOrders.tsx — доска кооп-заказов города (ui_coop_orders, 19-ui-ux §3.6 W5,
 * 11-town §3.5, canon C11 — пул на уровне Стрита, ≤10 участников/заказ).
 *
 * Читает `coop.orders` из стора (Realtime-кэш, истина серверная — AGENTS.md §0.3);
 * прогресс/дедлайн — уже посчитанные сервером числа, здесь только форматирование
 * (`./format.ts`). Мутация (`coop_contribute`) — через `CoopSystem` (DI-контекст, см.
 * `CoopSystemContext.tsx`); реальная проводка к адаптеру — вне зоны ui-market-orders
 * (ui/ не ходит в @/net, AGENTS.md §3).
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { ProductKey } from '@/types'
import { ingredients } from '@/data/catalogs/ingredients'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useCoopSystem } from './CoopSystemContext'
import { formatRemaining, reqProgressPct } from './format'

function productName(key: ProductKey, ru: boolean): string {
  const def = ingredients.find((i) => i.key === key)
  return (ru ? def?.name.ru : def?.name.en) ?? key
}

export function CoopOrders() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const orders = useStore((s) => s.coop.orders)
  const inventory = useStore((s) => s.inventory)
  const serverNow = useStore((s) => s.serverNow)
  const coop = useCoopSystem()

  const [qtyByReq, setQtyByReq] = useState<Record<string, number>>({})
  const [busyReq, setBusyReq] = useState<string | null>(null)

  const availableQty = (key: ProductKey) => inventory?.items[key] ?? 0

  async function contribute(orderId: string, itemKey: ProductKey, reqKey: string, qty: number) {
    setBusyReq(reqKey)
    try {
      const res = await coop.contribute(orderId, itemKey, qty)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `coop_contribute_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t contribute: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyReq(null)
    }
  }

  if (orders.length === 0) {
    return (
      <section
        data-testid="ui-coop-orders"
        className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="coop-orders-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Заказы откроются во вторник.' : 'Orders open on Tuesday.'}
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="ui-coop-orders"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Кооп-заказы города' : 'Co-op Orders'}
      </h2>

      <ul className="flex flex-col gap-3" data-testid="coop-orders-list">
        {orders.map((order) => {
          const remaining = order.deadlineAt - serverNow()
          return (
            <li
              key={order.id}
              data-testid={`coop-order-${order.id}`}
              className="rounded-lg border border-dashed p-3"
              style={{ borderColor: DINER.chrome }}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold">{order.reward}</span>
                <span data-testid={`coop-order-deadline-${order.id}`} className="tabular-nums opacity-70">
                  {ru ? 'До дедлайна' : 'Deadline in'}: {formatRemaining(remaining)}
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {order.requirements.map((req) => {
                  const reqKey = `${order.id}:${req.itemKey}`
                  const pct = reqProgressPct(req.filled, req.qty)
                  const done = req.filled >= req.qty
                  const inputQty = qtyByReq[reqKey] ?? 1
                  const have = availableQty(req.itemKey)
                  return (
                    <li key={reqKey} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span>
                          {productName(req.itemKey, ru)} · {req.filled}/{req.qty}
                          {done && ' ✓'}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded" style={{ background: DINER.chrome }}>
                        <div
                          data-testid={`coop-req-bar-${reqKey}`}
                          className="h-full"
                          style={{ width: `${pct}%`, background: DINER.teal }}
                        />
                      </div>
                      {!done && (
                        <div className="flex items-center gap-2">
                          <input
                            data-testid={`coop-req-qty-${reqKey}`}
                            type="number"
                            min={1}
                            max={Math.max(1, Math.min(have, req.qty - req.filled))}
                            value={inputQty}
                            onChange={(e) =>
                              setQtyByReq((s) => ({ ...s, [reqKey]: Math.max(1, Number(e.target.value) || 1) }))
                            }
                            className="w-16 rounded border px-1 py-0.5 text-xs"
                            style={{ borderColor: DINER.chrome }}
                          />
                          <button
                            type="button"
                            data-testid={`coop-req-contribute-${reqKey}`}
                            disabled={have <= 0 || busyReq === reqKey}
                            onClick={() => void contribute(order.id, req.itemKey, reqKey, inputQty)}
                            className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                            style={{ background: DINER.cherry }}
                          >
                            Contribute
                          </button>
                          <span className="text-xs opacity-50">
                            {ru ? 'на складе' : 'in stock'} {have}
                          </span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
