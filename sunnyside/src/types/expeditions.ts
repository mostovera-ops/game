/**
 * expeditions.ts — роуд-трип грузовика (07-expeditions, canon §3.4).
 * Стержень открытия мира (D7). Возврат — асинхронный (Realtime inbox).
 */

import type { UUID, EpochMs, Versioned, Tier } from './common'
import type { ProductKey } from './ingredients'

/** Штаты волны 1 (canon §3.4). Порядок = лестница роуд-трипа. */
export type StateKey =
  | 'st_home' // Родной округ (старт, T1–T2)
  | 'st_illinois' // Чикаго (T3, говядина, кофе)
  | 'st_tennessee' // Нэшвилл (T3, мёд, пекан)
  | 'st_georgia' // (T4, персики)
  | 'st_louisiana' // Новый Орлеан (T4, креветки, каджун)
  | 'st_texas' // (T4, брискет)
  | 'st_maine' // (T5, лобстер)
  | 'st_california' // (T5, цитрусы, ваниль)

export const STATE_KEYS: readonly StateKey[] = [
  'st_home',
  'st_illinois',
  'st_tennessee',
  'st_georgia',
  'st_louisiana',
  'st_texas',
  'st_maine',
  'st_california',
] as const

export interface StateDef {
  key: StateKey
  tier: Tier
  /** Хайлайт-продукты, что открывает штат. */
  highlights: ProductKey[]
}

export type ExpeditionState = 'en_route' | 'returned' | 'collected'

/**
 * Экспедиция (expeditions, 20-backend §3.4.1).
 * expedition_start — payload детерминирован seed'ом; expedition_collect ≥1 строка лута (P3).
 */
export interface Expedition extends Versioned {
  id: UUID
  stateKey: StateKey
  routeSlot: number
  state: ExpeditionState
  startedAt: EpochMs
  /** Серверное время возврата грузовика (Route Truck, veh_route_truck). */
  returnAt: EpochMs
  loot?: { key: ProductKey; qty: number }[]
}

/**
 * Снапшот роуд-трипа для экрана `ui_expeditions` (07-expeditions §5). Истина — сервер:
 * активные/вернувшиеся рейсы + текущие уровни апгрейдов грузовика + число слотов маршрута.
 *
 * Апгрейд-ветки (Speed/Capacity/Route Slots, §3.4) в MVP отдаются как есть (покупка —
 * отдельная ветка вне UI-задачи); снапшот несёт `speedLevel`/`hasStaffGus`, чтобы превью
 * длительности рейса (§4.1) в UI совпадало с тем, что посчитает сервер на `expedition_start`.
 */
export interface ExpeditionsSnapshot {
  /** Активные (`en_route`) и вернувшиеся-несобранные рейсы (собранные сервер отсеивает). */
  expeditions: Expedition[]
  /** Уровень апгрейда Speed 0..5 (§3.4.1) — вход превью длительности. */
  speedLevel: number
  /** Всего слотов маршрута = апгрейд Route Slots + `staff_buck` (§3.4.3). */
  routeSlots: number
  /** Пост Yard занят Mechanic Gus — −15% времени рейса (§3.4.1). */
  hasStaffGus: boolean
}
