/**
 * EventBundles.tsx — ивент-бандлы Пт–Сб (15-monetization.md §3.5). Окно продажи —
 * серверная фаза недели (`clock.calendar.phase`, canon §2.3): `fri_prep`/`sat_fair`
 * (гипотеза окна «Пт 00:00 → Сб 23:59 UTC», §3.5 — точная стыковка с `fairWindow`
 * открытый вопрос §8-8 спеки). Клиент НЕ решает фазу сам (21-client §3.6) — только
 * читает `ServerCalendar`, вне окна карточки показываются, но покупка недоступна.
 *
 * Покупка — `CollectionSystem.purchaseDecor` (см. `Boosters.tsx`/`ShopSystemContext.tsx`
 * докстринг для того же TODO про отсутствующий `MutationKind` бандлов) после
 * dev-эмуляции платежа.
 */
import { useStore } from '@/state'
import { EVENT_BUNDLES } from './catalog'
import { DINER, PRINT_SHADOW } from './tokens'
import { dimes, discountPct } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

export function EventBundles() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const phase = useStore((s) => s.clock.calendar?.phase)
  const { collection } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  const windowOpen = phase === 'fri_prep' || phase === 'sat_fair'

  async function buy(key: string, label: string, priceDimes: number) {
    const ok = await confirm(label, dimes(priceDimes))
    if (!ok) {
      useStore.getState().pushToast({
        id: `shop_bundle_fail_${Date.now()}`,
        kind: 'info',
        message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    const res = await collection.purchaseDecor(key)
    if (!res.ok) {
      useStore.getState().pushToast({
        id: `shop_bundle_err_${Date.now()}`,
        kind: 'warn',
        message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t buy: ${res.error.message}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    }
  }

  return (
    <section
      data-testid="ui-event-bundles"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Ивент-бандлы' : 'Event Bundles'}
      </h2>
      <p className="text-xs tabular-nums opacity-70">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>
      {!windowOpen && (
        <p data-testid="event-bundles-closed" className="text-sm italic opacity-70">
          {ru ? 'Бандлы открываются в пятницу.' : 'Bundles open on Friday.'}
        </p>
      )}
      <ul className="flex flex-col gap-2" data-testid="event-bundle-list">
        {EVENT_BUNDLES.map((b) => {
          const pct = discountPct(b.valueDimes, b.priceDimes)
          return (
            <li
              key={b.key}
              data-testid={`event-bundle-${b.key}`}
              className="flex flex-col gap-1 rounded-lg border border-dashed p-2.5"
              style={{ borderColor: DINER.chrome }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{ru ? b.name.ru : b.name.en}</span>
                <span className="text-xs opacity-60">−{pct}%</span>
              </div>
              <span className="text-xs opacity-70">{ru ? b.contents.ru : b.contents.en}</span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs tabular-nums opacity-50 line-through">{dimes(b.valueDimes)}</span>
                <button
                  type="button"
                  data-testid={`event-bundle-buy-${b.key}`}
                  disabled={!windowOpen}
                  onClick={() => void buy(b.key, ru ? b.name.ru : b.name.en, b.priceDimes)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                  style={{ background: DINER.cherry }}
                >
                  {dimes(b.priceDimes)}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <Dialog />
    </section>
  )
}
