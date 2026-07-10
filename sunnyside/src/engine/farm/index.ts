/**
 * engine/farm/index.ts — публичный барьер системы «Ферма» (02-farm.md).
 *
 * Скоуп владения (AGENTS.md §2, задача агента «Farm»): слоты грядок, расширение
 * земли (Land Expansion, ×1.18/слот), тиры грядки, цикл посев→уход→сбор (полив/
 * прополка/вороны), формула качества `P(Select)`. Реализует `FarmSystem` из
 * `engine/contracts.ts`. Данные культур — `data/catalogs/crops.ts`.
 *
 * ВНЕ скоупа этого модуля (соседние системы, см. 02-farm §6):
 *  - Склад Silo/Icehouse, буфер перелива → `InventorySystem` (engine/contracts.ts).
 *  - Стафф `staff_hank`, ветка `kh_agronomy` (прогресс очков) → 13-progression.
 *  - Овертайм-стоимость Dimes (`dimeSpeedupCost`) → `engine/econ` (EconSystem),
 *    здесь не дублируется — импортируй оттуда при необходимости UI-предсказания.
 *
 * ГРАНИЦА: чистая логика, ноль three/react/net (AGENTS.md §0.2).
 */

export {
  FREE_FIELD_PLOTS,
  MAX_FIELD_PLOTS,
  MAX_ORCHARD_PLOTS,
  LAND_EXPANSION_BLOCK_SIZE,
  fieldPlotCost,
  totalFieldExpansionCost,
  orchardPlotCost,
  blockIndexForSlot,
} from './land'

export { PLOT_TIER_DEFS, plotTierDef } from './plotTier'
export type { PlotTier, PlotTierDef } from './plotTier'

export {
  effectiveGrowMs,
  computeReadyAt,
  weedIgnorePenaltyMs,
  isWithinWateringWindow,
} from './growth'

export {
  WEED_EVENT_CHANCE,
  CROW_EVENT_CHANCE,
  weedingGraceMs,
  crowWindowMs,
  applyCrowPenalty,
  isCropSusceptibleToCrows,
} from './care'

export {
  SELECT_CHANCE_BASE,
  SELECT_CHANCE_CAP,
  CARE_BONUS_MAX,
  FERTILIZER_QUALITY_BONUS,
  AGRONOMY_BONUS_BY_LEVEL,
  selectChance,
} from './quality'
export type { SelectChanceInput } from './quality'

export { createFarmSystem } from './system'
