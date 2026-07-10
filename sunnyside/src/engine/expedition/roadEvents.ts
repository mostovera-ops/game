/**
 * engine/expedition/roadEvents.ts — дорожные события в пути (§3.8/§4.4).
 *
 * Канон-пилларс P3: «риск» здесь — только вариативность ИСХОДА В ПЛЮС, никогда потеря
 * груза. Один независимый ролл на возврате рейса (кроме контрактных — те всегда
 * `road_quiet_trip`, §4.4). Веса суммируются в 100 (`ROAD_EVENT_WEIGHT_TOTAL`).
 *
 * PRNG — `seededRng` из `@/engine/econ` (mulberry32, детерминированно от seed сервера).
 */
import { seededRng } from '@/engine/econ'
import { ROAD_EVENTS, ROAD_EVENT_WEIGHT_TOTAL, type RoadEventKey } from './constants'

/** Взвешенный ролл события по таблице §3.8 (детерминированный от `seed`). */
export function rollRoadEvent(seed: number): RoadEventKey {
  const rng = seededRng(seed)
  const roll = rng.next() * ROAD_EVENT_WEIGHT_TOTAL
  let acc = 0
  for (const event of ROAD_EVENTS) {
    acc += event.weight
    if (roll < acc) return event.key
  }
  // Защита от плавающей точки на самой границе — последний элемент таблицы.
  return ROAD_EVENTS[ROAD_EVENTS.length - 1]!.key
}

/** Контрактный рейс — всегда «экспресс без сюрпризов», без ролла (§3.6/§4.4). */
export function rollRoadEventForTrip(seed: number, isTruckContract: boolean): RoadEventKey {
  return isTruckContract ? 'road_quiet_trip' : rollRoadEvent(seed)
}
