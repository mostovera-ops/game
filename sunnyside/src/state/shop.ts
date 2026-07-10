/**
 * shop.ts — кэш зоны `ui-shop-pass` (15-monetization): Prize Machine pity/scrap-оценка,
 * дневные счётчики бустеров. Дополняет `collections`/`progression` (владеют toys/routePass
 * снапшотом с сервера) UI-только состоянием, для которого пока нет серверного зеркала.
 *
 * ВАЖНО (AGENTS.md §0.3 анти-чит): ничего здесь не является источником истины наград.
 * - `prizePity` — превью счётчика открытого pity (canon §4 «цифра видна»); ЗАМЕЩАЕТСЯ
 *   `pityAfter` из ответа `BackendAdapter.prizePull` при каждом пулле (сервер решает).
 *   До первого пулла серии — дефолт `engine/collections.initialPity` (тоже 0, просто
 *   чтобы UI не показывал "undefined" при первом заходе).
 * - `scrap` — ⚙ Scrap НЕ валюта (canon §2.1/K11) и пока нет в `CollectionsSnapshot`
 *   (`player_prize_scrap` — открытый пункт бэкенда, 15-monetization.md §3.3.2). Это
 *   ЛОКАЛЬНАЯ ОПТИМИСТИЧНАЯ ОЦЕНКА, посчитанная из `duplicate`-флагов в ответах
 *   `prizePull` — заметно менее авторитетна, чем `Wallet` (валюты), сознательно НЕ
 *   персистится вместе с остальным (см. `state/index.ts` partialize).
 * - `boosterUsageToday` — витринный счётчик "сегодня осталось N/K" (canon §4 G3);
 *   реальный дневной кэп/анти-чит — серверная валидация мутации (пока нет отдельного
 *   RPC для бустеров, см. `ui/shop/Boosters.tsx` докстринг).
 *
 * НЕ персистится (как `econ`/`fair`) — обнуляется при перезагрузке, это ОЖИДАЕМО для
 * dev-стаба (сервер, когда появится, — единственный источник pity/scrap/кэпов).
 */

import type { PrizePity, PrizeRarity } from '@/types'
import type { ToySeriesKey } from '@/types'
import { initialPity } from '@/engine/collections'
import type { SliceCreator } from './types'

/** ⚙ Scrap-выход дубля по редкости (15-monetization.md §3.3.2 таблица). Только для
 *  локальной оценки — сервер (`player_prize_scrap`) будет источником истины (§3.3.2). */
export const SCRAP_ON_DUPLICATE: Readonly<Record<PrizeRarity, number>> = {
  common: 2,
  uncommon: 6,
  rare: 20,
  chase: 80,
} as const

export interface ShopSlice {
  shop: {
    prizePity: Partial<Record<ToySeriesKey, PrizePity>>
    /** Локальная оценка ⚙ Scrap — см. докстринг файла. */
    scrap: number
    /** `${boosterKey}:${YYYY-MM-DD server}` → сколько раз куплено сегодня (превью кэпа). */
    boosterUsageToday: Record<string, number>
  }
  /** Сливает `pityAfter` от сервера (ответ `prizePull`) — сервер побеждает. */
  setPrizePity: (pity: PrizePity) => void
  /** Оценка scrap-прироста от дублей одного пулл-батча (сумма по `SCRAP_ON_DUPLICATE`). */
  addScrapFromDuplicates: (rarities: PrizeRarity[]) => void
  /** Локальный дебет scrap при обмене (`ui_prize_machine` Exchange, §3.3.4). `false`, если не хватает. */
  trySpendScrap: (amount: number) => boolean
  /** Инкремент дневного счётчика бустера (превью кэпа, ключ уже включает день). */
  recordBoosterUse: (dayKey: string) => void
}

const initial: ShopSlice['shop'] = {
  prizePity: {},
  scrap: 0,
  boosterUsageToday: {},
}

export const createShopSlice: SliceCreator<ShopSlice> = (set, get) => ({
  shop: initial,
  setPrizePity: (pity) =>
    set((s) => ({ shop: { ...s.shop, prizePity: { ...s.shop.prizePity, [pity.series]: pity } } })),
  addScrapFromDuplicates: (rarities) =>
    set((s) => ({
      shop: {
        ...s.shop,
        scrap: s.shop.scrap + rarities.reduce((sum, r) => sum + SCRAP_ON_DUPLICATE[r], 0),
      },
    })),
  trySpendScrap: (amount) => {
    if (get().shop.scrap < amount) return false
    set((s) => ({ shop: { ...s.shop, scrap: s.shop.scrap - amount } }))
    return true
  },
  recordBoosterUse: (dayKey) =>
    set((s) => ({
      shop: {
        ...s.shop,
        boosterUsageToday: { ...s.shop.boosterUsageToday, [dayKey]: (s.shop.boosterUsageToday[dayKey] ?? 0) + 1 },
      },
    })),
})

/** Pity серии с безопасным дефолтом (первый заход — нули, `engine/collections.initialPity`). */
export function pityOrDefault(
  pityMap: Partial<Record<ToySeriesKey, PrizePity>>,
  series: ToySeriesKey,
): PrizePity {
  return pityMap[series] ?? initialPity(series)
}
