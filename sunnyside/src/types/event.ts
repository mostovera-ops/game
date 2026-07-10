/**
 * event.ts — серверный уикенд-ивент, Appetite Meter (10-server-event, canon §3.5).
 * Подключается в v0.4. Лиги — по историческому вкладу, НЕ по спенду (canon гардрейл).
 */

import type { UUID, EpochMs } from './common'
import type { ProductKey } from './ingredients'

/** Темы ивента (ротация, canon §3.5). */
export type EventKey =
  | 'ev_glutton' // Приехал Обжора (Boss, Гримсби)
  | 'ev_big_festival' // Большой фестиваль (Category)
  | 'ev_harvest_homecoming' // Праздник урожая (Seasonal)
  | 'ev_drivein_night' // Ночь автокино (Seasonal)
  | 'ev_state_fair_showdown' // Ярмарка штата (Versus, город vs город)

export const EVENT_KEYS: readonly EventKey[] = [
  'ev_glutton',
  'ev_big_festival',
  'ev_harvest_homecoming',
  'ev_drivein_night',
  'ev_state_fair_showdown',
] as const

/**
 * Веха Appetite Meter (canon §3.5): 25% семена T3 / 50% декор+тикеты /
 * 75% буст недели / 100% парад+рамка.
 */
export interface EventMilestone {
  pct: 25 | 50 | 75 | 100
  reward: string
  hit: boolean
}

/**
 * Appetite Meter (ui_appetite_meter). Realtime `town:{id}:event`.
 * event_contribute атомарно инкрементит meter_fp и ловит пересечение вех (EV8).
 */
export interface AppetiteMeter {
  eventKey: EventKey
  meterPct: number // 0..100
  meterFp: number // абсолютные Feed Points города
  goalFp: number
  milestones: EventMilestone[]
  window: { opensAt: EpochMs; closesAt: EpochMs }
  finalAt: EpochMs // Вс 20:00
}

/** Фаза-каприз Гримсби (ev_glutton): «сейчас хочу сладкое ×2!». */
export interface GrimsbyCraving {
  category: string
  multiplier: number
  untilAt: EpochMs
}

/** Личный вклад в котёл (event_contributions). Канал: донат/пассив. */
export interface EventContribution {
  playerId: UUID
  itemKey: ProductKey
  qty: number
  fp: number
  channel: 'donate' | 'passive'
  at: EpochMs
}

/** Снапшот ивента (event-слайс). */
export interface EventSnapshot {
  meter: AppetiteMeter
  craving?: GrimsbyCraving
  personalFp: number
  streetPennant?: boolean // вклад стрита → вымпел на площади
  myContribHist: EventContribution[]
}
