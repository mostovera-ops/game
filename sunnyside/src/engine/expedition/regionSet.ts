/**
 * engine/expedition/regionSet.ts — регионы открыток и бонус полного сета (§3.7, O5).
 *
 * Канон/спека фиксируют только один явный пример деления на регионы («Юг: Теннесси
 * + Джорджия + Луизиана + Техас», §3.7) и оставляют границы остальных регионов
 * открытым вопросом (O5 — «по волнам? по географии?»). Это модуль вводит рабочее
 * деление ПО ГЕОГРАФИЧЕСКОЙ СМЕЖНОСТИ волны 1 (гипотеза этого модуля, требует
 * канон-решения по O5, аналогично прочим `нейминг-кандидат`ам спеки): «Юг» — как
 * задано спекой дословно; `st_illinois`/`st_maine`/`st_california` — одиночные
 * регионы-стопы (не сгруппированы, недостаточно контекста для группировки без
 * канона); `st_home` вне системы регионов (обучающий стоп, не «регион»).
 */
import type { StateKey } from '@/types'
import { REGION_SET_BONUS_PER_REGION } from './constants'

export type RegionKey = 'region_south' | 'region_illinois' | 'region_maine' | 'region_california'

export const REGIONS: Record<RegionKey, StateKey[]> = {
  region_south: ['st_tennessee', 'st_georgia', 'st_louisiana', 'st_texas'], // §3.7, пример спеки дословно
  region_illinois: ['st_illinois'],
  region_maine: ['st_maine'],
  region_california: ['st_california'],
}

/** Регион(ы), покрывающие данный стоп (обычно один; `st_home` — ни один). */
export function regionsForState(stateKey: StateKey): RegionKey[] {
  return (Object.keys(REGIONS) as RegionKey[]).filter((region) => REGIONS[region].includes(stateKey))
}

/** Регион полностью собран, если открытки всех его стопов есть у игрока. */
export function isRegionComplete(region: RegionKey, ownedPostcardStates: ReadonlySet<StateKey>): boolean {
  return REGIONS[region].every((stateKey) => ownedPostcardStates.has(stateKey))
}

/** Число полностью собранных регионов, покрывающих `stateKey` (§4.1 — суммируется, не капается отдельно). */
export function closedRegionsCoveringStop(stateKey: StateKey, ownedPostcardStates: ReadonlySet<StateKey>): number {
  return regionsForState(stateKey).filter((region) => isRegionComplete(region, ownedPostcardStates)).length
}

/** Скидка времени экспедиций от собранных регионов, покрывающих стоп (0.05/регион, §3.7/§4.1). */
export function regionSetBonusReduction(stateKey: StateKey, ownedPostcardStates: ReadonlySet<StateKey>): number {
  return closedRegionsCoveringStop(stateKey, ownedPostcardStates) * REGION_SET_BONUS_PER_REGION
}
