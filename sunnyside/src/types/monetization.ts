/**
 * monetization.ts — покупки Dimes, IAP, Prize Machine (15-monetization, canon §4 гардрейлы).
 * Платят за время/удобство/самовыражение. Прямой продажи силы НЕТ (D11).
 */

import type { ISOTimestamp } from './common'
import type { ToySeriesKey } from './collections'

/** SKU покупки Dimes/косметики (Winnie/каталог). */
export interface DimeSku {
  sku: string
  dimes: number
  priceUsd: number
  bonusPct?: number
}

/** Провайдер оплаты (iap-verify дедуп provider_txn_id). */
export type IapProvider = 'apple' | 'google' | 'stripe' | 'web'

/** Покупка (purchases, unique (provider, provider_txn_id)). */
export interface Purchase {
  id: string
  provider: IapProvider
  sku: string
  dimesGranted: number
  at: ISOTimestamp
}

/**
 * Prize Machine (ui_prize_machine, prize_pull). ОТКРЫТЫЙ pity (цифра видна):
 * Rare ≤10, Chase ≤40; дроп 68/24/6.5/1.5% (canon §4, мастер — 15-monetization).
 * pity считает СЕРВЕР; клиент лишь анимирует (анти-чит §3.7).
 */
export interface PrizePity {
  series: ToySeriesKey
  pullsSinceRare: number
  pullsSinceChase: number
  rareCap: number // ≤10
  chaseCap: number // ≤40
}

export type PrizeRarity = 'common' | 'uncommon' | 'rare' | 'chase'

export interface PrizeResult {
  toyKey: string
  rarity: PrizeRarity
  duplicate: boolean
}

export interface PrizePullOutcome {
  results: PrizeResult[]
  pityAfter: PrizePity
}
