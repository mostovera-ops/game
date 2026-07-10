/**
 * RoutePass.tsx — `ui_route_pass` Route Pass (15-monetization.md §3.1, 19-ui-ux §5
 * «шкала 50 уровней, 2 трека, кнопка «Разблокировать Route Club», счётчик Miles до
 * уровня, кнопка «докупить уровень» (с явной надписью «дешевле играть»)»).
 *
 * Прогресс (`tier`/`xp`/`track`/`claimedFree`/`claimedPremium`) — из `ProgressionSnapshot`
 * (серверная истина, «прогресс — от ритуалов недели, не от гринда», §2.3/§3.1.3), этот
 * компонент НИЧЕГО не считает — только показывает уже готовые числа + контент-каталог
 * наград (`./catalog.ts` ← `@/data/catalogs/passTracks`).
 *
 * TODO(owner: engine-contracts/progression): нет `MutationKind` для (а) разблокировки
 * платного трека за `◉` и (б) «забрать награду уровня» — обе кнопки ниже готовы к
 * подключению, но пока (а) временно уходит через `CollectionSystem.purchaseDecor`
 * (generic SKU-buy, см. `ShopSystemContext.tsx`), а (б) заблокирована (disabled) —
 * клиент НЕ зачисляет награду сам без ответа сервера (AGENTS.md §0.3 анти-чит).
 */
import { useStore } from '@/state'
import { DINER, PRINT_SHADOW } from './tokens'
import {
  currentPassTrack,
  isMilestoneTier,
  nextTierBuyoutPriceDimes,
  rewardLabel,
  ROUTE_PASS_MAX_TIER,
  ROUTE_PASS_PREMIUM_PRICE_DIMES,
} from './catalog'
import { dimes } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

export function RoutePass() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const routePass = useStore((s) => s.progression?.routePass)
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const { collection } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  const track = currentPassTrack()

  async function unlockPremium() {
    const label = ru ? 'Route Club — разблокировать трек' : 'Route Club — unlock track'
    const ok = await confirm(label, dimes(ROUTE_PASS_PREMIUM_PRICE_DIMES))
    if (!ok) {
      useStore.getState().pushToast({
        id: `shop_pass_fail_${Date.now()}`,
        kind: 'info',
        message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    const res = await collection.purchaseDecor(`route_pass_premium_s${routePass?.season ?? 1}`)
    if (!res.ok) {
      useStore.getState().pushToast({
        id: `shop_pass_err_${Date.now()}`,
        kind: 'warn',
        message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t unlock: ${res.error.message}`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
    }
  }

  async function buyoutNextTier() {
    if (!routePass) return
    const price = nextTierBuyoutPriceDimes(routePass.tier)
    const label = ru ? 'Докупить уровень' : 'Buy next level'
    const ok = await confirm(label, dimes(price))
    if (!ok) return
    // TODO(owner: engine-contracts): нет RPC для докупки уровня — см. докстринг файла.
  }

  if (!routePass || !track) {
    return (
      <section
        data-testid="ui-route-pass"
        className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="route-pass-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Route Pass ещё грузится.' : 'Route Pass is still loading.'}
        </p>
      </section>
    )
  }

  const isPremium = routePass.track === 'premium'

  return (
    <section
      data-testid="ui-route-pass"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">
          {ru ? track.name.ru : track.name.en} · {ru ? 'Route Pass' : 'Route Pass'}
        </h2>
        <span data-testid="route-pass-tier" className="tabular-nums text-sm font-bold">
          {routePass.tier}/{ROUTE_PASS_MAX_TIER}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span data-testid="route-pass-xp" className="tabular-nums opacity-70">
          {ru ? 'Route Miles' : 'Route Miles'}: {routePass.xp}
        </span>
        {!isPremium && (
          <button
            type="button"
            data-testid="route-pass-unlock-premium"
            onClick={() => void unlockPremium()}
            className="rounded-lg px-3 py-1.5 font-bold uppercase tracking-wide text-white"
            style={{ background: DINER.cherry }}
          >
            {ru ? 'Разблокировать Route Club' : 'Unlock Route Club'} · {dimes(ROUTE_PASS_PREMIUM_PRICE_DIMES)}
          </button>
        )}
      </div>

      <ul data-testid="route-pass-ladder" className="flex flex-col gap-1.5">
        {track.tiers.map((t) => {
          const reached = routePass.tier >= t.tier
          const milestone = isMilestoneTier(t.tier)
          const freeClaimed = routePass.claimedFree.includes(t.tier)
          const premiumClaimed = routePass.claimedPremium.includes(t.tier)
          if (!milestone && !t.freeReward && !t.premiumReward) return null // §3.1.2: только вехи описаны каталогом
          return (
            <li
              key={t.tier}
              data-testid={`route-pass-tier-${t.tier}`}
              className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 rounded-md p-1.5 text-xs"
              style={{ background: reached ? DINER.paper : 'transparent', opacity: reached ? 1 : 0.55 }}
            >
              <span className="tabular-nums font-bold">#{t.tier}</span>
              <div className="flex items-center justify-between gap-1">
                <span>{rewardLabel(t.freeReward, locale)}</span>
                <button
                  type="button"
                  data-testid={`route-pass-claim-free-${t.tier}`}
                  disabled // забор наград без серверного RPC ещё не подключён (TODO выше)
                  title={ru ? 'Забор наград — открывается позже (нет серверного RPC)' : 'Claiming lands later (no server RPC yet)'}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase disabled:opacity-30"
                  style={{ background: DINER.teal, color: 'white' }}
                >
                  {freeClaimed ? '✓' : ru ? 'Забрать' : 'Claim'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span>{rewardLabel(t.premiumReward, locale)}</span>
                <button
                  type="button"
                  data-testid={`route-pass-claim-premium-${t.tier}`}
                  disabled // забор наград без серверного RPC ещё не подключён (TODO выше)
                  title={ru ? 'Забор наград — открывается позже (нет серверного RPC)' : 'Claiming lands later (no server RPC yet)'}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase disabled:opacity-30"
                  style={{ background: DINER.mustard, color: 'white' }}
                >
                  {premiumClaimed ? '✓' : ru ? 'Забрать' : 'Claim'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-dotted pt-2 text-xs" style={{ borderColor: DINER.chrome }}>
        <span className="opacity-60">
          {ru ? 'Дешевле просто играть неделю.' : 'Cheaper to just play the week.'}
        </span>
        <button
          type="button"
          data-testid="route-pass-buyout-next"
          disabled={routePass.tier >= ROUTE_PASS_MAX_TIER}
          onClick={() => void buyoutNextTier()}
          className="rounded-lg px-3 py-1.5 font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.chrome }}
        >
          {ru ? 'Докупить уровень' : 'Buy next level'} · {dimes(nextTierBuyoutPriceDimes(routePass.tier))}
        </button>
      </div>
      <p className="text-center text-xs tabular-nums opacity-50">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>
      <Dialog />
    </section>
  )
}
