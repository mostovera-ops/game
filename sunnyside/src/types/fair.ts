/**
 * fair.ts — ярмарка: прилавок, лоты, конкурсы, активная смена (09-fair, canon §3.6).
 * Прилавок пассивен для всех (D6, провала нет). Смена — соло (D4), тикает локально,
 * но итог валидируется сервером (21-client §3.6 shift, анти-чит).
 */

import type { UUID, EpochMs, Versioned, Quality } from './common'
import type { ProductKey } from './ingredients'

/** Прилавок игрока (fair_open ставит opened_at → старт пассива). */
export interface Stall extends Versioned {
  id: UUID
  level: number // fair_tent_upgrade → display_slots
  displaySlots: number
  openedAt?: EpochMs
  lots: FairLot[]
}

/**
 * Лот на витрине (fair_list резервирует сток из inventory).
 * Цена — в допустимом ±% коридоре; пассив (fair-tick) продаёт зарезервированное.
 */
export interface FairLot {
  id: UUID
  itemKey: ProductKey
  qty: number
  remaining: number
  quality: Quality
  price: number
}

/** Лог пассивной продажи (fair_sales, Realtime `town:{id}:fair`). */
export interface FairSale {
  lotId: UUID
  itemKey: ProductKey
  qty: number
  revenue: number
  tickAt: EpochMs
}

/** Конкурсы ярмарки (canon §3.6). 3 штуки. */
export type ContestKey =
  | 'ct_pie_week' // Пирог недели (Maybelle + голоса)
  | 'ct_giant_veg' // Гигантский овощ (метрика веса/качества)
  | 'ct_best_window' // Лучшая витрина (голоса игроков)

export const CONTEST_KEYS: readonly ContestKey[] = [
  'ct_pie_week',
  'ct_giant_veg',
  'ct_best_window',
] as const

export type ContestPhase = 'entry' | 'voting' | 'judged'

/** Состояние конкурса. entry_close Пт 23:59 → voting → judge Вс 12:00 (canon §2.3). */
export interface Contest {
  id: UUID
  key: ContestKey
  phase: ContestPhase
  entryWindow: { opensAt: EpochMs; closesAt: EpochMs }
  votingWindow: { opensAt: EpochMs; closesAt: EpochMs }
  myEntry?: ContestEntry
  entries: ContestEntry[]
}

/** Заявка в конкурс (contest_enter). 1 заявка/игрок; contest_vote — 1 голос/игрок. */
export interface ContestEntry {
  id: UUID
  playerId: UUID
  payload: Record<string, unknown> // предмет/витрина/метрика
  votes: number
  npcScore?: number
  finalScore?: number
  rank?: number
  blueRibbon?: boolean
}

// ── Активная смена у прилавка (ShiftScene, mech ui_shift) ──────────────────────

export type GuestPatience = number // 0..1, тикает локально

/** Гость в очереди. Очередь ДЕТЕРМИНИРОВАНА от серверного seed (анти-чит §3.6). */
export interface ShiftGuest {
  id: string
  wants: RecipeOrder
  patience: GuestPatience
  spawnAtMs: number // от startedAt, из seed
}

export interface RecipeOrder {
  dishKey: ProductKey
  qty: number
}

/**
 * Локальное состояние смены (fair.shift). Тикает локально ради отзывчивости,
 * но старт (shift.start) и итог (shift_submit) — серверные. Клиентские Tips/Score
 * сервер игнорит и реконструирует из фактически списанного стока.
 */
export interface ShiftState {
  active: boolean
  seed: number
  startedAt: EpochMs
  durationSec: number
  queue: ShiftGuest[]
  tray: RecipeOrder[]
  served: number
  tips: number // локальный расчёт ТОЛЬКО для показа
}

/** Итог смены, отправляемый на shift_submit (сервер реконструирует). */
export interface ShiftLog {
  seed: number
  startedAt: EpochMs
  served: number
  tips: number
  soldStock: { itemKey: ProductKey; qty: number }[]
}
