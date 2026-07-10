/**
 * engine/mail-foraging/delivery.ts — ЧЕСТНАЯ доставка Каталога почтой
 * (08-mail-foraging §3.1.3). Чистые функции тайминга: задержка по категории и цена
 * ускорения за ◉. Заменяет прежний хардкод `deliverAt = t + 8ч` / фикс-5◉ в адаптере.
 *
 *   • Задержка доставки: `DELIVERY_DELAY_HOURS_BY_CATEGORY` (Rare 20ч / Decor 16ч / Tools 8ч).
 *   • Ускорение: `◉1` за КАЖДЫЕ НАЧАТЫЕ 4ч оставшегося времени, потолок `◉5`/заказ.
 *
 * Время — аргументом (`serverNow()` у вызывающего, AGENTS.md §0.4), не `Date.now()`.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net/state — чистая арифметика, node-тестируемо.
 */

import type { EpochMs } from '@/types'
import {
  HOUR_MS,
  DELIVERY_DELAY_HOURS_BY_CATEGORY,
  DIMES_PER_STARTED_HOURS,
  MAIL_SPEEDUP_DIMES_CAP,
  type CatalogCategory,
} from './constants'

/** Задержка доставки категории в мс (§3.1.3). */
export function deliveryDelayMs(category: CatalogCategory): number {
  return DELIVERY_DELAY_HOURS_BY_CATEGORY[category] * HOUR_MS
}

/** Момент готовности заказа: `orderedAt` + задержка категории. */
export function deliverAtFor(category: CatalogCategory, orderedAt: EpochMs): EpochMs {
  return orderedAt + deliveryDelayMs(category)
}

/**
 * Цена мгновенной доставки в ◉: `1` за каждые НАЧАТЫЕ 4ч оставшегося времени, кап `5`.
 * Уже доставленный (или готовый) заказ — `0` (ускорять нечего).
 */
export function speedupCostDimes(deliverAt: EpochMs, now: EpochMs): number {
  const remaining = deliverAt - now
  if (remaining <= 0) return 0
  const startedBlocks = Math.ceil(remaining / (DIMES_PER_STARTED_HOURS * HOUR_MS))
  return Math.min(startedBlocks, MAIL_SPEEDUP_DIMES_CAP)
}

/** Доля пройденного пути доставки [0..1] для прогресс-бара UI (§3.1.7). */
export function deliveryProgress(orderedAt: EpochMs, deliverAt: EpochMs, now: EpochMs): number {
  const total = deliverAt - orderedAt
  if (total <= 0) return 1
  const done = (now - orderedAt) / total
  return done < 0 ? 0 : done > 1 ? 1 : done
}
