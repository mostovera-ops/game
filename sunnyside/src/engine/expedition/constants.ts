/**
 * engine/expedition/constants.ts — мастер-числа роуд-трипа грузовика (07-expeditions).
 *
 * Все значения — ИЗ СПЕКИ `docs/specs/07-expeditions.md` (раздел указан у каждой
 * группы). Спека помечает большинство чисел `(гипотеза)` до финальной калибровки
 * `14-economy.md` — здесь они воспроизведены дословно как источник для формул;
 * при расхождении спека/`14-economy.md` — истина, эти константы обновляются,
 * но НЕ формулы (см. `duration.ts`/`upgrades.ts`).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net/state — чистые данные, node-тестируемо.
 */

import type { StateKey } from '@/types'

export const HOUR_MS = 3_600_000

/**
 * Базовая длительность рейса по стопу, часы (§3.2 «Маршруты и тайминги»).
 *
 * `st_illinois`/`st_tennessee` — явно «ближние T3» (6ч). `st_georgia`/`st_texas` —
 * явно «ближний»/«дальний T4» (10ч/16ч); `st_louisiana` не отнесена спекой ни к
 * «ближним», ни к «дальним» T4 — интерполирована линейно между стопами тира T4
 * по порядку лестницы (10, 13, 16 → среднее 13ч точно совпадает с §4.5 «T4 среднее
 * 13ч»), задокументировано как решение этого модуля, не как число из спеки дословно.
 * `st_maine`/`st_california` — явно «ближний T5»/«край карты» (18ч/24ч).
 */
export const BASE_DURATION_HOURS: Record<StateKey, number> = {
  st_home: 4, // T1–T2, фикс. обучающий рейс (§3.2)
  st_illinois: 6,
  st_tennessee: 6,
  st_georgia: 10,
  st_louisiana: 13, // интерполяция, см. комментарий выше
  st_texas: 16,
  st_maine: 18,
  st_california: 24,
}

// ── Апгрейды скорости (§3.4.1) ────────────────────────────────────────────────
/** Индекс = уровень Speed (0 база .. 5 макс). Доля сокращения времени экспедиции. */
export const SPEED_REDUCTION_BY_LEVEL: readonly number[] = [0, 0.10, 0.18, 0.25, 0.32, 0.40]
export const SPEED_UPGRADE_COST: readonly number[] = [0, 800, 2_500, 7_000, 18_000, 45_000]
/** Уровень 5 требует, помимо `$`, ещё ◉200 (гипотеза, §3.4.1). */
export const SPEED_UPGRADE_COST_DIMES: readonly number[] = [0, 0, 0, 0, 0, 200]
export const MAX_SPEED_LEVEL = 5

/** `staff_gus` (Mechanic Gus) — −15% времени, складывается аддитивно (§3.4.1). */
export const STAFF_GUS_REDUCTION = 0.15

/** Кап суммарной скидки времени — включает все три терма формулы (§4.1, O7). */
export const MAX_TOTAL_DURATION_REDUCTION = 0.55

/** Бонус региона за полный сет открыток — 5%/регион, аддитивно (§3.7/§4.1). */
export const REGION_SET_BONUS_PER_REGION = 0.05

/** Множитель Truck Contract — рейс «экспресс» (§3.6/§4.1). */
export const TRUCK_CONTRACT_DURATION_MULT = 0.5

// ── Апгрейды вместимости (§3.4.2) ─────────────────────────────────────────────
export interface CapacityLevel {
  slots: number
  multiplier: number
  cost: number
}
/** Индекс = уровень Capacity (0 база .. 5 макс). */
export const CAPACITY_LEVELS: readonly CapacityLevel[] = [
  { slots: 2, multiplier: 1.0, cost: 0 },
  { slots: 3, multiplier: 1.2, cost: 1_000 },
  { slots: 3, multiplier: 1.5, cost: 3_200 },
  { slots: 4, multiplier: 1.8, cost: 9_000 },
  { slots: 4, multiplier: 2.2, cost: 22_000 },
  { slots: 5, multiplier: 2.5, cost: 50_000 },
]
export const MAX_CAPACITY_LEVEL = 5

// ── Слоты маршрутов (§3.4.3) ──────────────────────────────────────────────────
/** Индекс 0 = уровень 1 (база, 1 слот). */
export const ROUTE_SLOTS_BY_LEVEL: readonly number[] = [1, 2, 3]
export const ROUTE_SLOTS_UPGRADE_COST: readonly number[] = [0, 15_000, 60_000]
export const ROUTE_SLOTS_UPGRADE_COST_DIMES: readonly number[] = [0, 0, 300]
export const MAX_ROUTE_SLOTS_LEVEL = 3
/** `staff_buck` (Trucker Buck) — +1 слот сверх макс. уровня апгрейда (§3.4.3). */
export const STAFF_BUCK_BONUS_SLOTS = 1
/** Практический потолок MVP: Route Slots 3 + staff_buck (§3.4.3). */
export const MAX_PRACTICAL_ROUTE_SLOTS = ROUTE_SLOTS_BY_LEVEL[MAX_ROUTE_SLOTS_LEVEL - 1]! + STAFF_BUCK_BONUS_SLOTS

// ── Send Cost (§3.5) ──────────────────────────────────────────────────────────
export interface SendCostRange {
  min: number
  max: number
  /** ◉1 = 30 мин оставшегося времени (единый курс, §3.5/O6). */
  dimesPerHalfHour: number
  /** Кап ◉ на полное ускорение рейса до мгновенного (§3.5). */
  dimesCap: number
}
export const SEND_COST_BY_TIER: Record<'T1_T2' | 'T3' | 'T4' | 'T5', SendCostRange> = {
  T1_T2: { min: 0, max: 0, dimesPerHalfHour: 0, dimesCap: 0 },
  T3: { min: 150, max: 250, dimesPerHalfHour: 1, dimesCap: 40 },
  T4: { min: 400, max: 700, dimesPerHalfHour: 1, dimesCap: 90 },
  T5: { min: 900, max: 1_400, dimesPerHalfHour: 1, dimesCap: 150 },
}

// ── Truck Contract (§3.6) ─────────────────────────────────────────────────────
export const TRUCK_CONTRACT_COST_DIMES = 60
/** 1 активация/день, ключ дедупликации бэкенда — (player_id, day) UTC (§3.6). */
export const TRUCK_CONTRACT_DAILY_CAP = 1

// ── Дубликат-открытка (§3.3/§3.7) ─────────────────────────────────────────────
/** Повторная открытка → 15 `$` × тир лута стопа (гипотеза, §3.3). */
export const DUPLICATE_POSTCARD_BUCKS_PER_TIER = 15
/** `road_local_fair` удваивает конвертацию дубликат-открытки (§3.8). */
export const LOCAL_FAIR_POSTCARD_MULT = 2

// ── Дорожные события (§3.8/§4.4) — веса суммируются в 100 ────────────────────
export type RoadEventKey =
  | 'road_bonus_stand'
  | 'road_hitchhiker'
  | 'road_scenic_detour'
  | 'road_local_fair'
  | 'road_new_friend'
  | 'road_quiet_trip'

export interface RoadEventDef {
  key: RoadEventKey
  weight: number
}
export const ROAD_EVENTS: readonly RoadEventDef[] = [
  { key: 'road_bonus_stand', weight: 30 },
  { key: 'road_hitchhiker', weight: 15 },
  { key: 'road_scenic_detour', weight: 20 },
  { key: 'road_local_fair', weight: 15 },
  { key: 'road_new_friend', weight: 10 },
  { key: 'road_quiet_trip', weight: 10 },
]
export const ROAD_EVENT_WEIGHT_TOTAL = ROAD_EVENTS.reduce((sum, e) => sum + e.weight, 0)

/** `road_bonus_stand` — +20% к количеству регионалки этого рейса (§3.8). */
export const BONUS_STAND_QTY_MULT = 1.2
/** `road_hitchhiker` — гарантированный фрагмент рецепта на этот рейс (§3.8/§4.3). */
export const HITCHHIKER_FRAGMENT_CHANCE = 1
/** `road_scenic_detour` — +1 доп. слот лута сверх Capacity на этот рейс (§3.8). */
export const SCENIC_DETOUR_EXTRA_SLOTS = 1
/** `road_new_friend` — +1 🎟 Tickets (символическая капля, §3.8). */
export const NEW_FRIEND_TICKETS = 1
