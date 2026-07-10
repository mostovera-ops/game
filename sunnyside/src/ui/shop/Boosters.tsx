/**
 * Boosters.tsx — бустеры «время/удобство» (15-monetization.md §3.4). Дневные кэпы —
 * мастер `14-economy.md §4.7` (жёсткий верх пула 6 покупок/день, канон §4 G3);
 * счётчик «сегодня осталось N/K» здесь — ВИТРИННАЯ оценка (`state/shop.ts
 * boosterUsageToday`, ключ уже включает день сервера) — реальный кэп валидирует
 * бэкенд, когда появится отдельный `MutationKind` для бустеров (пока нет — см.
 * TODO у `buy()`).
 *
 * Покупка идёт через `CollectionSystem.purchaseDecor` (generic SKU-buy, см. докстринг
 * `ShopSystemContext.tsx`) после dev-эмуляции платежа.
 */
import { useStore } from '@/state'
import { BOOSTERS } from './catalog'
import { DINER, PRINT_SHADOW } from './tokens'
import { dimes, dayKeyOf } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

export function Boosters() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const serverNow = useStore((s) => s.serverNow)
  const usageToday = useStore((s) => s.shop.boosterUsageToday)
  const recordBoosterUse = useStore((s) => s.recordBoosterUse)
  const { collection } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  async function buy(key: string, label: string, priceDimes: number, usageKey: string) {
    const ok = await confirm(label, dimes(priceDimes))
    if (!ok) {
      useStore.getState().pushToast({
        id: `shop_booster_fail_${Date.now()}`,
        kind: 'info',
        message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    // TODO(owner: engine-contracts): нет отдельного `MutationKind` "booster_purchase" —
    // переиспользуем `decor_purchase` (generic content-buy) как временную точку входа,
    // пока не согласован proper RPC (AGENTS.md §2 — контракты меняются по согласованию).
    const res = await collection.purchaseDecor(key)
    if (res.ok) recordBoosterUse(usageKey)
    else {
      useStore.getState().pushToast({
        id: `shop_booster_err_${Date.now()}`,
        kind: 'warn',
        message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t buy: ${res.error.message}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    }
  }

  const dayKey = dayKeyOf(serverNow())

  return (
    <section
      data-testid="ui-boosters"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Бустеры' : 'Boosters'}
      </h2>
      <p className="text-xs tabular-nums opacity-70">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>
      <ul className="flex flex-col gap-2" data-testid="booster-list">
        {BOOSTERS.map((b) => {
          const usageKey = `${b.key}:${dayKey}`
          const usedToday = usageToday[usageKey] ?? 0
          const capped = usedToday >= b.dailyCap
          return (
            <li
              key={b.key}
              data-testid={`booster-${b.key}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-2.5"
              style={{ borderColor: DINER.chrome }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold">{ru ? b.name.ru : b.name.en}</span>
                <span className="text-xs opacity-70">{ru ? b.effect.ru : b.effect.en}</span>
                <span data-testid={`booster-cap-${b.key}`} className="text-xs tabular-nums opacity-60">
                  {ru ? 'Сегодня осталось' : 'Left today'}: {Math.max(0, b.dailyCap - usedToday)}/{b.dailyCap}
                </span>
              </div>
              <button
                type="button"
                data-testid={`booster-buy-${b.key}`}
                disabled={capped}
                onClick={() => void buy(b.key, ru ? b.name.ru : b.name.en, b.priceDimes, usageKey)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: DINER.cherry }}
              >
                {dimes(b.priceDimes)}
              </button>
            </li>
          )
        })}
      </ul>
      <Dialog />
    </section>
  )
}
