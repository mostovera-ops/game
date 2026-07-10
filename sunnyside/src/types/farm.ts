/**
 * farm.ts — грядки, слоты, постройки, состояние фермы (02-farm, canon §3.8).
 * Планировка MVP — модульные A-слоты (D2). Ферма полностью играбельна офлайн (21-client §3.3).
 */

import type { UUID, EpochMs, Versioned, Quality } from './common'
import type { ProductKey } from './ingredients'
import type { MachineInstance } from './machines'
import type { Animal } from './animals'

/** Постройки фермы (canon §3.8). 9 построек волны 1. */
export type BuildingKey =
  | 'bld_house' // база, уровень фермы
  | 'bld_barn' // слоты животных
  | 'bld_coop' // куры/птица
  | 'bld_kitchen' // слоты станков, рецепты
  | 'bld_diner' // прилавок, гости, чаевые
  | 'bld_garage' // грузовик, экспедиции
  | 'bld_silo' // лимит хранения (зерно/корм)
  | 'bld_icehouse' // лимит хранения (скоропорт)
  | 'bld_apiary' // ульи/мёд/воск (9-я постройка)

export const BUILDING_KEYS: readonly BuildingKey[] = [
  'bld_house',
  'bld_barn',
  'bld_coop',
  'bld_kitchen',
  'bld_diner',
  'bld_garage',
  'bld_silo',
  'bld_icehouse',
  'bld_apiary',
] as const

/** Экземпляр постройки. House-гейт лимитирует апгрейды прочих (13-progression). */
export interface Building extends Versioned {
  key: BuildingKey
  level: number
  /** Активен таймер апгрейда (building_upgrade). */
  upgradeReadyAt?: EpochMs
  assetKey?: string
}

/** Стадия роста грядки (наследие прототипа: посажено→растёт→созрело). */
export type PlotState = 'empty' | 'growing' | 'ready' | 'withered'

/**
 * Грядка/слот (plots, 20-backend §3.2.2). Модель таймера — дедлайн (readyAt).
 * Полив (water) продлевает watered_until; без полива рост тормозит (02-farm).
 */
export interface Plot extends Versioned {
  id: UUID
  /** Индекс слота в сетке фермы (A-слоты, D2). */
  slot: number
  state: PlotState
  seedKey?: ProductKey
  cropKey?: ProductKey
  quality?: Quality
  plantedAt?: EpochMs
  readyAt?: EpochMs
  wateredUntil?: EpochMs
}

/** Оси Farm Value (mech_farm_value, 13/14). Σ(косметика+коллекции) капится 15%. */
export interface FarmValueAxes {
  production: number
  buildings: number
  collections: number
  cosmetics: number
  total: number
}

/** Снапшот фермы (farm-слайс). Кэш; истина серверная, применяется оптимистично. */
export interface FarmSnapshot {
  farmId: UUID
  farmLevel: number
  plots: Plot[]
  buildings: Partial<Record<BuildingKey, Building>>
  machines: MachineInstance[]
  animals: Animal[]
  farmValue: FarmValueAxes
  /** Отпуск-режим (mech_gone_fishin). Offset-таймеры (B7). */
  vacationUntil?: EpochMs
}
