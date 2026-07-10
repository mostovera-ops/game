/**
 * currency.ts — валюты (canon §2.1). Ровно ЧЕТЫРЕ, символы и роли неизменны.
 * Know-How и Staff Tokens — НЕ валюты (state-таблицы игрока), см. progression.ts.
 */

/** Ключи 4 каноничных валют. Новых валют без апдейта канона не вводить. */
export type CurrencyKey = 'bucks' | 'dimes' | 'tickets' | 'ribbons'

export interface CurrencyMeta {
  key: CurrencyKey
  symbol: string
  type: 'soft' | 'premium' | 'event' | 'prestige'
}

/** Реестр валют (canon §2.1) — значение, доступное рантайму для форматтеров. */
export const CURRENCIES: Record<CurrencyKey, CurrencyMeta> = {
  bucks: { key: 'bucks', symbol: '$', type: 'soft' },
  dimes: { key: 'dimes', symbol: '◉', type: 'premium' },
  tickets: { key: 'tickets', symbol: '🎟', type: 'event' },
  ribbons: { key: 'ribbons', symbol: '🎀', type: 'prestige' },
} as const

/** Баланс кошелька. НИКОГДА не персистится на клиенте (21-client §3.4 — анти-подмена). */
export interface Wallet {
  bucks: number
  dimes: number
  tickets: number
  ribbons: number
}

/**
 * Запись двойного леджера (append-only, 20-backend §3.7). Баланс = проекция леджера.
 * Клиент читает, но не пишет.
 */
export interface LedgerEntry {
  id: string
  currency: CurrencyKey
  delta: number
  balanceAfter: number
  reason: string
  /** idempotency_key = (player, week_index, reward_key) для наградных начислений. */
  idempotencyKey?: string
  at: import('./common').ISOTimestamp
}
