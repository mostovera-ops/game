/**
 * engine/econ/saturation.ts — эластичность перенасыщения S_sat (§4.6, E7).
 *
 * Каноничная формула (§4.6):
 *     S_sat = clamp( (Demand_units / Listed_units)^0.5 , 0.40 , 1.15 )
 * — избыточно выставленная категория дешевеет (пол 0.40, самокоррекция), дефицитная
 * получает бонус (потолок 1.15). Считается city-wide по 4 метам, не по игроку.
 *
 * ГРАНИЦА: чистая функция, ноль сети/three.
 */

import type { SaturationInput } from '@/types'
import { S_SAT_CEIL, S_SAT_EXP, S_SAT_FLOOR } from './constants'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/**
 * Каноничный S_sat (§4.6). ПЕРВИЧНЫЙ API рыночной логики.
 * @param demandUnits целевой городской спрос категории (units/нед)
 * @param listedUnits суммарно выставленный городом сток категории
 *
 * Калибровка §4.6: listed/demand 0.5×→1.15, 1×→1.00, 2×→0.71, 4×→0.50, ≥6.25×→0.40.
 */
export function sSat(demandUnits: number, listedUnits: number): number {
  // Ничего не выставлено → чистый дефицит → потолок бонуса.
  if (listedUnits <= 0) return S_SAT_CEIL
  const ratio = Math.max(0, demandUnits) / listedUnits
  return clamp(Math.pow(ratio, S_SAT_EXP), S_SAT_FLOOR, S_SAT_CEIL)
}

/**
 * Реализация метода `EconSystem.saturation(input: SaturationInput)` (contracts.ts).
 *
 * TODO(architecture): форма `SaturationInput { category, soldQty, demandMultiplier }`
 * недоописана под каноничную §4.6 (нужны Demand_units и Listed_units). Здесь трактуем
 * `soldQty` = Listed_units (город выставил), `demandMultiplier` = Demand_units (целевой
 * спрос категории). Предлагаю переименовать тип в `{ demandUnits, listedUnits }` —
 * тогда обёртка станет тривиальной. До согласования — этот документированный маппинг.
 */
export function saturation({ soldQty, demandMultiplier }: SaturationInput): number {
  return sSat(demandMultiplier, soldQty)
}
