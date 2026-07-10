/**
 * common.ts — базовые примитивы домена Sunnyside.
 *
 * ГРАНИЦА: этот файл (и весь src/types) НЕ импортирует three / @react-three / net / state.
 * Только чистые типы. Node-тестируемо (21-client §3.1).
 */

/** UUID строки (серверные идентификаторы). */
export type UUID = string

/** Абсолютное серверное время в мс от эпохи (см. clock.serverNow, 21-client §3.6). */
export type EpochMs = number

/** ISO-8601 timestamptz (как приходит из Postgres). */
export type ISOTimestamp = string

/**
 * Качество продукта/предмета (canon: quality от affection/housing/mastery).
 * Гипотеза шкалы — 5 ступеней; мастер-числа в 05-ingredients / 14-economy.
 */
export type Quality = 1 | 2 | 3 | 4 | 5

/** Тиры продуктов T1–T5 (canon §2.2). */
export type Tier = 1 | 2 | 3 | 4 | 5

/** Двуязычная подпись (canon §5 — RU/EN словарь). Ключ канона всегда английский snake_case. */
export interface Bilingual {
  en: string
  ru: string
}

/**
 * Серверный объект несёт version (bump на каждый write) — основа reconcile при
 * конфликте (21-client §3.5 «сервер-побеждает»).
 */
export interface Versioned {
  version: number
}

/**
 * Единый контракт ответа RPC/Edge (20-backend §3.4): { ok, data?, error? }.
 * Discriminated union — сужается по `ok`.
 */
export type RpcResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: RpcError }

export interface RpcError {
  code: RpcErrorCode
  message: string
}

/** Коды ошибок RPC (гипотеза; согласуется с 20-backend). */
export type RpcErrorCode =
  | 'conflict' // серверная version > base / слот занят / состояние изменилось
  | 'insufficient_funds' // не хватает валюты/ресурса
  | 'insufficient_stock' // не хватает стока/входа рецепта
  | 'not_ready' // now() < ready_at
  | 'window_closed' // вне окна (ярмарка/ивент/кооп-дедлайн)
  | 'rate_limited' // rate_limits bucket (20-backend §3.7)
  | 'forbidden' // RLS / не владелец / смурф-фильтр
  | 'cap_reached' // дневной кэп / лимит склада
  | 'not_found'
  | 'invalid_payload'
  | 'offline' // адаптер оффлайн, мутация в очереди
  | 'unknown'

/** Хелпер для чистых функций-редьюсеров: локальный Result без сети. */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Запись «ключ канона → количество» (склад, вклады, требования рецептов). */
export type CountMap<K extends string = string> = Partial<Record<K, number>>
