/**
 * economy.ts — спрос, прайсинг, farm value (14-economy, canon §2.2).
 * Формулы живут в src/engine/econ/ как ЧИСТЫЕ функции (≥90% покрытия, 21-client §3.10).
 * Клиент НИКОГДА не считает награду сам — только показывает; истина серверная.
 */

import type { Tier } from './common'

/**
 * Категория спроса (Demand Board делит категории между стритом, canon §2.3).
 * Точный набор — в 14-economy; держим как строку + известные константы.
 */
export type DemandCategory =
  | 'garden'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'drinks'
  | 'preserves'
  | 'sweets'
  | 'seafood'
  | string

/**
 * Demand Board (ui_demand_board, Realtime). Множители ±15–30% (canon §2.3).
 * Детерминирован seed hash(town,week,config_version) — клиент не влияет (анти-чит).
 */
export interface DemandBoard {
  weekIndex: number
  seed: number
  /** category → множитель цены (напр. 1.15, 0.85). */
  board: Record<DemandCategory, number>
  /** Ностальгия-категории (нарратив бонусов). */
  nostalgia: DemandCategory[]
}

/**
 * Вход формулы перенасыщения S_sat (14-economy): чем больше продал стрит категории,
 * тем ниже маржа. Чистая функция в engine/econ.
 */
export interface SaturationInput {
  category: DemandCategory
  soldQty: number
  demandMultiplier: number
}

/** Опорные эконом-цифры тира (canon §2.2, стартовые гипотезы). */
export interface TierEconRef {
  tier: Tier
  dishPrice: number // $
  cycleMin: number // минут на цикл блюда
  priceMultToT1: number
}

/**
 * Прайсинг Dimes-ускорения: ceil(0.41 · t^0.53), t в минутах (21-client §3.10, 14-economy).
 * Вход чистой функции.
 */
export interface DimeSpeedupInput {
  remainingMin: number
}

/** Снапшот экономики для UI (демоборд + опорные цифры). */
export interface EconConfigSnapshot {
  demand: DemandBoard
  tierRefs: TierEconRef[]
}
