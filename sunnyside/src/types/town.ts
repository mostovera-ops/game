/**
 * town.ts — город, стриты, town projects, кооп, potluck, переезды (11-town, 12-migration).
 * Городской слой — v0.3. TownScene рендерится LOD/имперостерами (21-client §3.9).
 */

import type { UUID, EpochMs, Versioned } from './common'
import type { ProductKey } from './ingredients'

/** Town Projects (canon §3.7). 6 коллективных построек. */
export type TownProjectKey =
  | 'tp_drive_in' // Автокино
  | 'tp_ferris_wheel' // Колесо обозрения
  | 'tp_radio_wsun' // Радиостанция WSUN
  | 'tp_bandstand' // Городская эстрада
  | 'tp_water_tower' // Водонапорная башня
  | 'tp_welcome_arch' // Приветственная арка шоссе

export const TOWN_PROJECT_KEYS: readonly TownProjectKey[] = [
  'tp_drive_in',
  'tp_ferris_wheel',
  'tp_radio_wsun',
  'tp_bandstand',
  'tp_water_tower',
  'tp_welcome_arch',
] as const

/** Прогресс town-проекта (Realtime `town:{id}:projects`). */
export interface TownProject extends Versioned {
  key: TownProjectKey
  progress: number
  goal: number
  built: boolean
  myContribution: number
}

/** Стрит (10–20 ферм, canon §2.4). */
export interface Street {
  id: UUID
  name: string // из пула 20 названий (canon §3.3)
  memberCount: number
  farmIds: UUID[]
}

/**
 * Кооп-заказ (coop_contribute). Дедлайн Чт 23:59. Пул на уровне стрита;
 * ≤10 участников на заказ (canon C11).
 */
export interface CoopOrder extends Versioned {
  id: UUID
  requirements: { itemKey: ProductKey; qty: number; filled: number }[]
  deadlineAt: EpochMs
  myContribution: Record<ProductKey, number>
  reward: string
}

/** Potluck-стол стрита (mech_potluck, potluck_contribute). Бафф стриту на субботу. */
export interface Potluck {
  weekIndex: number
  totalScore: number
  myScore: number
  buffActive: boolean
}

/** Предложение переезда (migration_propose/vote, 12-migration). Без скипа за ◉ (12-O1). */
export type MigrationKind = 'moving_van' | 'street_caravan' | 'town_merge'

export interface MigrationProposal extends Versioned {
  id: UUID
  kind: MigrationKind
  targetTownId: UUID
  votingWindow: { opensAt: EpochMs; closesAt: EpochMs }
  tally: { yes: number; no: number; quorum: number }
  myVote?: 'yes' | 'no'
  /** Стрит-инициатор (только `street_caravan`, 12-migration §3.2.1) — кворум считается от него. */
  streetId?: UUID
}

/**
 * Карточка города в Town Browser (`ui_town_browser`, нейминг-кандидат — 12-migration §3.1.3).
 * Только для навигации/выбора цели переезда — не путать с `TownSnapshot` (истина текущего
 * города игрока). Список выдаёт `BackendAdapter.listTowns()`, не персистится.
 */
export interface TownListing {
  townId: UUID
  name: string
  residents: number
  capacity: number
  freeStreets: number
  totalStreets: number
  /** 7-дневный средний DAU (12-migration §4.7 — зелёная/жёлтая/красная зона). */
  dauAvg: number
  languageTag?: string
  /** Есть ли в этом городе кто-то из френд-листа игрока (фильтр «Где мои друзья», §3.1.3). */
  hasFriends: boolean
  /** Рекомендован алгоритмом (≥3 своб. улицы, активность выше среднего, §3.1.3). */
  recommended: boolean
}

/**
 * Статус личного Moving Van (`ui_moving_truck`, 12-migration §3.1.2). Аккаунт-широкий, но
 * кэшируется вместе со снапшотом текущего города — тот же паттерн, что и roster/coopOrders.
 */
export interface MovingVanStatus {
  /** До какого момента переезд недоступен (мин. 3 дня в городе ИЛИ 14 дней кулдауна после переезда). */
  cooldownUntil: EpochMs
}

/** Баннер Grand Reopening (`ui_grand_reopening`, нейминг-кандидат — 12-migration §3.3.4/§4.3). */
export interface GrandReopeningState {
  active: boolean
  endsAt: EpochMs
}

/** Снапшот города (town-слайс). Кэш; требует свежих серверных данных (не офлайн). */
export interface TownSnapshot {
  townId: UUID
  streets: Street[]
  projects: Partial<Record<TownProjectKey, TownProject>>
  /** Ростер соседей (для визитов). */
  roster: { userId: UUID; farmId: UUID; displayName: string; streetId: UUID }[]
  coopOrders: CoopOrder[]
  potluck?: Potluck
  migrations: MigrationProposal[]
  movingVan: MovingVanStatus
  grandReopening?: GrandReopeningState
}
