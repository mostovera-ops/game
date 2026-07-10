/**
 * CosmeticsShop.tsx — Cosmetics Shop (15-monetization.md §3.2, 19-ui-ux §5 «сетка SKU
 * по сетам, Full-Set-скидка, «применить/примерить»»). 4 канон-сета × 8 SKU (§3.2.2).
 *
 * Читает контент из `./catalog.ts` (read-only, `@/data/catalogs/cosmetics`) и
 * баланс `◉` из `econ.wallet` (серверная истина). Покупка одного SKU идёт через
 * `CollectionSystem.purchaseDecor(decorKey)` — переиспользование generic «купить
 * содержимое по ключу» до появления отдельного `MutationKind` для косметик-магазина
 * (см. докстринг `ShopSystemContext.tsx`). Каждая покупка сначала проходит dev-эмуляцию
 * платежа (`usePaymentEmulation`, задание зоны `ui-shop-pass`) — на FAIL система не
 * вызывается вовсе, ничего не списывается.
 *
 * TODO(owner: collections-net): `CollectionsSnapshot.cosmetics` сейчас хранит владение
 * на уровне СЕТА (`Cosmetic.owned`), а каталог продаёт по SKU (32 записи) — нет способа
 * узнать «этот конкретный Accent уже куплен» до появления `ownedSkus`/аналога в снапшоте.
 * До тех пор кнопка «Купить» не блокируется по владению (не наш файл — collections.ts).
 */
import { useStore } from '@/state'
import { COSMETIC_KEYS } from '@/types'
import type { CosmeticKey } from '@/types'
import { DINER, PRINT_SHADOW } from './tokens'
import {
  cosmeticsInSet,
  cosmeticFullSetPriceDimes,
  cosmeticSetSumDimes,
  cosmeticSetLabel,
  cosmeticItemLabel,
} from './catalog'
import { dimes, discountPct } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

const TARGET_LABEL: Record<string, { en: string; ru: string }> = {
  diner: { en: 'Diner', ru: 'Дайнер' },
  truck: { en: 'Truck', ru: 'Грузовик' },
  staff: { en: 'Staff', ru: 'Стафф' },
  sign: { en: 'Sign', ru: 'Вывеска' },
  interior: { en: 'Interior', ru: 'Интерьер' },
}

export function CosmeticsShop() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const { collection } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  async function buy(decorKey: string, label: string, priceDimes: number) {
    const ok = await confirm(label, dimes(priceDimes))
    if (!ok) {
      useStore.getState().pushToast({
        id: `shop_cosmetic_fail_${Date.now()}`,
        kind: 'info',
        message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    const res = await collection.purchaseDecor(decorKey)
    if (!res.ok) {
      useStore.getState().pushToast({
        id: `shop_cosmetic_err_${Date.now()}`,
        kind: 'warn',
        message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t buy: ${res.error.message}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    }
  }

  return (
    <section
      data-testid="ui-cosmetics-shop"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Косметик-магазин' : 'Cosmetics Shop'}
      </h2>
      <p className="text-xs tabular-nums opacity-70">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>

      {(COSMETIC_KEYS as readonly CosmeticKey[]).map((setKey) => {
        const items = cosmeticsInSet(setKey)
        const apart = cosmeticSetSumDimes(setKey)
        const fullSet = cosmeticFullSetPriceDimes(setKey)
        const pct = discountPct(apart, fullSet)
        return (
          <div key={setKey} data-testid={`cosmetic-set-${setKey}`} className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold uppercase tracking-wide">{cosmeticSetLabel(setKey, locale)}</h3>
              <button
                type="button"
                data-testid={`cosmetic-set-buy-full-${setKey}`}
                onClick={() => void buy(setKey, `${cosmeticSetLabel(setKey, locale)} — Full Set`, fullSet)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: DINER.cherry }}
              >
                {ru ? 'Весь сет' : 'Full Set'} · {dimes(fullSet)}{' '}
                <span className="opacity-80">(−{pct}%)</span>
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {items.map((item) => (
                <li
                  key={item.key}
                  data-testid={`cosmetic-item-${item.key}`}
                  className="flex flex-col gap-1 rounded-md p-2 text-xs"
                  style={{ background: DINER.paper }}
                >
                  <span className="font-semibold leading-tight">{cosmeticItemLabel(item, locale)}</span>
                  <span className="opacity-60">{ru ? TARGET_LABEL[item.target]?.ru : TARGET_LABEL[item.target]?.en}</span>
                  <button
                    type="button"
                    data-testid={`cosmetic-item-buy-${item.key}`}
                    onClick={() => void buy(item.key, cosmeticItemLabel(item, locale), item.priceDimes ?? 0)}
                    className="mt-1 rounded px-2 py-1 font-bold uppercase tracking-wide text-white"
                    style={{ background: DINER.teal }}
                  >
                    {dimes(item.priceDimes ?? 0)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <Dialog />
    </section>
  )
}
