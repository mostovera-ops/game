/**
 * calendar.ts — серверный календарь и фазы недели (canon §2.3, 01-core-loop).
 * Клиент НЕ вычисляет фазу от локального времени — берёт серверную (21-client §3.6).
 */

import type { EpochMs, UUID } from './common'

/** Фазы недели (роли дней, canon §2.3). Игровая неделя = реальная, Пн 00:00 UTC. */
export type WeekPhase =
  | 'mon_plan' // Demand Board объявляет спрос
  | 'tue_produce' // крафт; Co-op Orders открываются
  | 'wed_expedition' // грузовики возвращаются
  | 'thu_push' // дедлайн Co-op Чт 23:59; Potluck открыт
  | 'fri_prep' // финальный сток
  | 'sat_fair' // ярмарка (окно 36 ч: Сб 00:00 → Вс 12:00)
  | 'sun_event' // общий котёл; финал Вс 20:00; ролловер Вс 23:59

export const WEEK_PHASES: readonly WeekPhase[] = [
  'mon_plan',
  'tue_produce',
  'wed_expedition',
  'thu_push',
  'fri_prep',
  'sat_fair',
  'sun_event',
] as const

/** Окно (напр. ярмарка 36 ч, ивент). Абсолютные серверные времена. */
export interface TimeWindow {
  opensAt: EpochMs
  closesAt: EpochMs
}

/**
 * Снапшот серверного календаря города (Realtime `town:{id}:calendar`).
 * Все якоря — абсолютные серверные EpochMs.
 */
export interface ServerCalendar {
  townId: UUID
  weekIndex: number
  phase: WeekPhase
  /** Ролловер недели Вс 23:59. */
  rolloverAt: EpochMs
  /** Окно ярмарки (Сб 00:00 → Вс 12:00). */
  fairWindow: TimeWindow
  /** Дедлайн кооп-заказов (Чт 23:59). */
  coopDeadlineAt: EpochMs
  /** Финал серверного ивента (Вс 20:00). */
  eventFinalAt: EpochMs
}

/**
 * Состояние клиентских часов (clock-слайс, 21-client §3.6).
 * serverNow() = Date.now() + serverOffset — единственный источник игрового времени.
 */
export interface ClockState {
  /** t_server − Date.now(), медиана 3 замеров минус RTT/2. */
  serverOffset: number
  /** Был ли успешный get_server_time. До него логика готовности блокируется (C4). */
  synced: boolean
  lastSyncAt: EpochMs | null
}
