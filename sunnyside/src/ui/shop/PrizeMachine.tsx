/**
 * PrizeMachine.tsx — `ui_prize_machine` Prize Machine (15-monetization.md §3.3,
 * 19-ui-ux §5 «рычаг автомата, дроп-таблица (раскрыть), счётчик pity открыто,
 * «Бесплатный пулл дня», обменник Scrap» + анимация выдачи, дубль→скрап на месте).
 *
 * Открытый pity (canon §4 «никакого скрытого RNG-давления»): счётчик берётся из
 * `state/shop.ts` (`prizePity`), который сливает `pityAfter` из КАЖДОГО ответа
 * `CollectionSystem.pullPrize` — сервер решает дроп/pity (`engine/collections`
 * докстринг `prizeMachine.ts`), этот компонент только рисует уже готовое число.
 *
 * Дубли → Scrap: аналогично, `⚙` — ЛОКАЛЬНАЯ витринная оценка (`state/shop.ts`
 * докстринг — до появления `player_prize_scrap` на сервере, 15-monetization §3.3.2/K11).
 *
 * Пуллы — платное действие за `◉`, поэтому идут через dev-эмуляцию платежа
 * (`usePaymentEmulation`); бесплатный дневной пулл (`mech_crackerjack`) — НЕ покупка,
 * без диалога. Обменник Scrap → недостающая фигурка — тоже нет отдельного RPC
 * (TODO ниже), реализован как generic SKU-buy через `CollectionSystem.purchaseDecor`.
 */
import { useState } from 'react'
import { useStore } from '@/state'
import { TOY_SERIES_KEYS } from '@/types'
import type { ToySeriesKey, PrizeRarity } from '@/types'
import { pityOrDefault } from '@/state/shop'
import { DINER, PRINT_SHADOW, RARITY_COLOR } from './tokens'
import { PRIZE_PULL_PRICE_DIMES, PRIZE_PULL10_PRICE_DIMES, SCRAP_EXCHANGE_PRICE } from './catalog'
import { dimes } from './format'
import { usePaymentEmulation } from './PaymentDialog'
import { useShopSystems } from './ShopSystemContext'

const SERIES_LABEL: Record<ToySeriesKey, { en: string; ru: string }> = {
  toy_highway_dinos: { en: 'Highway Dinos', ru: 'Динозавры шоссе' },
  toy_cosmos_57: { en: 'Cosmos-57', ru: 'Космос-57' },
  toy_route_critters: { en: 'Route Critters', ru: 'Зверьки шоссе' },
  toy_chrome_rockets: { en: 'Chrome Rockets', ru: 'Хромовые ракеты' },
  toy_diner_mascots: { en: 'Diner Mascots', ru: 'Талисманы дайнера' },
}

const RARITY_LABEL: Record<PrizeRarity, { en: string; ru: string }> = {
  common: { en: 'Common', ru: 'Common' },
  uncommon: { en: 'Uncommon', ru: 'Uncommon' },
  rare: { en: 'Rare', ru: 'Rare' },
  chase: { en: 'Chase', ru: 'Chase' },
}

export function PrizeMachine() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const dimesBalance = useStore((s) => s.econ.wallet.dimes)
  const scrap = useStore((s) => s.shop.scrap)
  const pityMap = useStore((s) => s.shop.prizePity)
  const setPrizePity = useStore((s) => s.setPrizePity)
  const addScrapFromDuplicates = useStore((s) => s.addScrapFromDuplicates)
  const trySpendScrap = useStore((s) => s.trySpendScrap)
  const toys = useStore((s) => s.collections?.toys)
  const { collection } = useShopSystems()
  const { confirm, Dialog } = usePaymentEmulation()

  const [series, setSeries] = useState<ToySeriesKey>('toy_highway_dinos')
  const [lastResult, setLastResult] = useState<{ toyKey: string; rarity: PrizeRarity; duplicate: boolean }[]>([])
  const [busy, setBusy] = useState(false)

  const pity = pityOrDefault(pityMap, series)
  const ownedInSeries = Object.values(toys ?? {}).filter((t) => t.series === series && t.owned).length

  async function pull(count: number, priceDimes: number, free: boolean) {
    if (!free) {
      const ok = await confirm(
        ru ? `Крутить ×${count}` : `Pull ×${count}`,
        dimes(priceDimes),
      )
      if (!ok) {
        useStore.getState().pushToast({
          id: `shop_prize_fail_${Date.now()}`,
          kind: 'info',
          message: ru ? 'Платёж отклонён (dev)' : 'Payment declined (dev)',
          createdAt: Date.now(),
          ttlMs: 6000,
        })
        return
      }
    }
    setBusy(true)
    try {
      const res = await collection.pullPrize({ seriesKey: series, count })
      if (res.ok) {
        setLastResult(res.data.results)
        setPrizePity(res.data.pityAfter)
        addScrapFromDuplicates(res.data.results.filter((r) => r.duplicate).map((r) => r.rarity))
      } else {
        useStore.getState().pushToast({
          id: `shop_prize_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не вышло: ${res.error.message}` : `Couldn’t pull: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function exchange(rarity: PrizeRarity) {
    const price = SCRAP_EXCHANGE_PRICE[rarity]
    if (!trySpendScrap(price)) {
      useStore.getState().pushToast({
        id: `shop_exchange_short_${Date.now()}`,
        kind: 'info',
        message: ru ? `Не хватает ⚙ Scrap (нужно ${price})` : `Not enough ⚙ Scrap (need ${price})`,
        createdAt: Date.now(),
        ttlMs: 6000,
      })
      return
    }
    // TODO(owner: engine-contracts): нет RPC "prize_exchange" — временно переиспользуем
    // generic SKU-buy, см. докстринг файла/`ShopSystemContext.tsx`.
    await collection.purchaseDecor(`toy_exchange_${series}_${rarity}`)
  }

  return (
    <section
      data-testid="ui-prize-machine"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Автомат с призами' : 'Prize Machine'}
      </h2>

      <div className="flex flex-wrap gap-1.5" data-testid="prize-series-tabs">
        {TOY_SERIES_KEYS.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`prize-series-${s}`}
            onClick={() => setSeries(s)}
            className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: series === s ? DINER.cherry : DINER.paper,
              color: series === s ? 'white' : DINER.board,
            }}
          >
            {ru ? SERIES_LABEL[s].ru : SERIES_LABEL[s].en}
          </button>
        ))}
      </div>

      <p className="text-xs tabular-nums opacity-70" data-testid="prize-series-progress">
        {ru ? 'Собрано' : 'Collected'}: {ownedInSeries}/8
      </p>

      {/* Открытый pity — canon §4 гардрейл G2 «цифра видна». */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md p-2" style={{ background: DINER.paper }}>
          <span className="opacity-60">{ru ? 'До гарантии Rare+' : 'Until guaranteed Rare+'}</span>
          <p data-testid="prize-pity-rare" className="text-lg font-black tabular-nums" style={{ color: DINER.teal }}>
            {Math.max(0, pity.rareCap - pity.pullsSinceRare)}
          </p>
        </div>
        <div className="rounded-md p-2" style={{ background: DINER.paper }}>
          <span className="opacity-60">{ru ? 'До гарантии Chase' : 'Until guaranteed Chase'}</span>
          <p data-testid="prize-pity-chase" className="text-lg font-black tabular-nums" style={{ color: DINER.cherry }}>
            {Math.max(0, pity.chaseCap - pity.pullsSinceChase)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="prize-pull-free"
          disabled={busy}
          onClick={() => void pull(1, 0, true)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.mustard }}
        >
          {ru ? 'Бесплатный пулл дня' : 'Free pull of the day'}
        </button>
        <button
          type="button"
          data-testid="prize-pull-1"
          disabled={busy}
          onClick={() => void pull(1, PRIZE_PULL_PRICE_DIMES, false)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.cherry }}
        >
          {ru ? 'Крутить ×1' : 'Pull ×1'} · {dimes(PRIZE_PULL_PRICE_DIMES)}
        </button>
        <button
          type="button"
          data-testid="prize-pull-10"
          disabled={busy}
          onClick={() => void pull(10, PRIZE_PULL10_PRICE_DIMES, false)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.cherry }}
        >
          {ru ? 'Крутить ×10' : 'Pull ×10'} · {dimes(PRIZE_PULL10_PRICE_DIMES)}
        </button>
      </div>

      {lastResult.length > 0 && (
        <ul data-testid="prize-last-results" className="flex flex-wrap gap-1.5">
          {lastResult.map((r, i) => (
            <li
              key={`${r.toyKey}_${i}`}
              data-testid={`prize-result-${i}`}
              className="rounded-full px-2 py-1 text-[10px] font-bold uppercase text-white"
              style={{ background: RARITY_COLOR[r.rarity] }}
            >
              {RARITY_LABEL[r.rarity][locale]}
              {r.duplicate && (ru ? ' · дубль→⚙' : ' · dup→⚙')}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed p-2.5" style={{ borderColor: DINER.chrome }}>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wide">{ru ? 'Обменник' : 'Exchange'}</span>
          <span data-testid="prize-scrap-balance" className="tabular-nums opacity-70">
            ⚙ {scrap}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SCRAP_EXCHANGE_PRICE) as PrizeRarity[]).map((rarity) => (
            <button
              key={rarity}
              type="button"
              data-testid={`prize-exchange-${rarity}`}
              onClick={() => void exchange(rarity)}
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white"
              style={{ background: RARITY_COLOR[rarity] }}
            >
              {RARITY_LABEL[rarity][locale]} · ⚙{SCRAP_EXCHANGE_PRICE[rarity]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs tabular-nums opacity-50">
        {ru ? 'Баланс' : 'Balance'}: {dimes(dimesBalance)}
      </p>
      <Dialog />
    </section>
  )
}
