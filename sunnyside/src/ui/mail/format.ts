/**
 * ui/mail/format.ts — презентационные форматтеры Каталога почтой. Только представление
 * готовых чисел (цена/таймер), НИКАКИХ игровых расчётов (AGENTS.md §0.3 — считает движок).
 */

import type { CurrencyKey, Locale } from '@/types'

/** Цена позиции: `$120` для bucks, `◉ 25` для dimes. */
export function priceLabel(price: number, currency: CurrencyKey): string {
  if (currency === 'dimes') return `◉ ${Math.round(price).toLocaleString('en-US')}`
  if (currency === 'tickets') return `🎟 ${Math.round(price)}`
  return `$${Math.round(price).toLocaleString('en-US')}`
}

/** Обратный отсчёт `Чч Мм` / `Мм Сс` из миллисекунд (ETA доставки/Last Call). */
export function countdown(ms: number, locale: Locale): string {
  const clamped = Math.max(0, ms)
  const totalSec = Math.floor(clamped / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const ru = locale === 'ru'
  if (h > 0) return ru ? `${h} ч ${m} мин` : `${h}h ${m}m`
  if (m > 0) return ru ? `${m} мин ${s} с` : `${m}m ${s}s`
  return ru ? `${s} с` : `${s}s`
}
