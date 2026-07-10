/**
 * DimesShop.tsx — пакеты `◉` Dimes за реал (15-monetization.md §9). Единственная
 * настоящая реал-транзакция во всей монетизации (19-ui-ux §4.2 «Топ-бар: баланс ◉,
 * кнопка «+» → магазин пакетов Dimes»). Купить → dev-эмуляция платежа → на OK
 * `MonetizationSystem.verifyPurchase` (`engine/monetization`, dev-receipt синтетический,
 * реальный provider-SDK вне скоупа) → адаптер зачисляет `dimes` в `Wallet` (истина —
 * ответ адаптера, клиент не досчитывает сам, AGENTS.md §0.3).
 */
import { useStore } from '@/state'
import { DIMES_PACKAGES, dimesPackageTotal } from './catalog'
import { DINER, PRINT_SHADOW } from './tokens'
import { dimes, usd } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

export function DimesShop() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const { monetization } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  async function buy(sku: string, label: string, priceUsd: number) {
    const ok = await confirm(label, usd(priceUsd))
    if (!ok) {
      useStore.getState().pushToast({
        id: `shop_dimes_fail_${Date.now()}`,
        kind: 'info',
        message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    const res = await monetization.verifyPurchase({ provider: 'web', receipt: `dev-${sku}-${Date.now()}`, sku })
    if (res.ok) {
      useStore.getState().pushToast({
        id: `shop_dimes_ok_${Date.now()}`,
        kind: 'success',
        message: ru ? `Зачислено ${dimes(res.data.dimes)}` : `Credited ${dimes(res.data.dimes)}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    } else {
      useStore.getState().pushToast({
        id: `shop_dimes_err_${Date.now()}`,
        kind: 'warn',
        message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t buy: ${res.error.message}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    }
  }

  return (
    <section
      data-testid="ui-dimes-shop"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Пакеты Dimes' : 'Dimes Packages'}
      </h2>
      <p className="text-xs tabular-nums opacity-70">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="dimes-package-list">
        {DIMES_PACKAGES.map((pkg) => (
          <li
            key={pkg.sku}
            data-testid={`dimes-package-${pkg.sku}`}
            className="flex flex-col items-center gap-1 rounded-lg border border-dashed p-2.5 text-center"
            style={{ borderColor: DINER.chrome }}
          >
            <span className="text-sm font-bold">{ru ? pkg.name.ru : pkg.name.en}</span>
            <span className="text-lg font-black tabular-nums" style={{ color: DINER.mustard }}>
              {dimes(dimesPackageTotal(pkg))}
            </span>
            {pkg.bonusDimes > 0 && (
              <span className="text-[10px] opacity-60">
                {pkg.dimesBase} + {pkg.bonusDimes} {ru ? 'бонус' : 'bonus'}
              </span>
            )}
            <button
              type="button"
              data-testid={`dimes-package-buy-${pkg.sku}`}
              onClick={() => void buy(pkg.sku, ru ? pkg.name.ru : pkg.name.en, pkg.priceUsd)}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
              style={{ background: DINER.cherry }}
            >
              {usd(pkg.priceUsd)}
            </button>
          </li>
        ))}
      </ul>
      <Dialog />
    </section>
  )
}
