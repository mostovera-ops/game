/**
 * engine/farm/plotTier.ts — тиры грядки (Basic → Tilled → Raised → Irrigated),
 * 02-farm §3.3 / §4.3. Апгрейд применяется на конкретный слот (не на всю ферму).
 *
 * ГРАНИЦА: чистые данные + чистая функция-геттер. Ноль three/react/net.
 */

export type PlotTier = 0 | 1 | 2 | 3

export interface PlotTierDef {
  tier: PlotTier
  key: 'basic' | 'tilled' | 'raised' | 'irrigated'
  name: { en: string; ru: string }
  /** Множитель к базовому времени роста (1 = без изменений, 0.92 = −8%). */
  growTimeMult: number
  /** Добавка к P(Select), доля 0..1 (0.05 = +5%), см. quality.ts. */
  selectChanceBonus: number
  /** Irrigated Bed даёт «бесплатный» авто-полив раз в цикл (02-farm §3.3/§3.9). */
  autoWaterPerCycle: boolean
  /** Требование ветки Know-How (02-farm §3.3). */
  requiresKnowHow?: { branch: 'kh_agronomy'; level: number }
}

/** Таблица тиров — числа дословно из 02-farm §3.3. */
export const PLOT_TIER_DEFS: readonly PlotTierDef[] = [
  {
    tier: 0,
    key: 'basic',
    name: { en: 'Basic Plot', ru: 'Простая грядка' },
    growTimeMult: 1,
    selectChanceBonus: 0,
    autoWaterPerCycle: false,
  },
  {
    tier: 1,
    key: 'tilled',
    name: { en: 'Tilled Plot', ru: 'Вспаханная грядка' },
    growTimeMult: 0.92, // −8% время роста
    selectChanceBonus: 0.05, // +5% шанс Select
    autoWaterPerCycle: false,
    requiresKnowHow: { branch: 'kh_agronomy', level: 1 },
  },
  {
    tier: 2,
    key: 'raised',
    name: { en: 'Raised Bed', ru: 'Приподнятая грядка' },
    growTimeMult: 0.85, // −15% время роста
    selectChanceBonus: 0.1, // +10% шанс Select
    autoWaterPerCycle: false,
    requiresKnowHow: { branch: 'kh_agronomy', level: 3 },
  },
  {
    tier: 3,
    key: 'irrigated',
    name: { en: 'Irrigated Bed', ru: 'Орошаемая грядка' },
    growTimeMult: 0.78, // −22% время роста
    selectChanceBonus: 0.15, // +15% шанс Select
    autoWaterPerCycle: true,
    requiresKnowHow: { branch: 'kh_agronomy', level: 5 },
  },
]

/** Геттер тира с валидацией диапазона (0..3). */
export function plotTierDef(tier: PlotTier): PlotTierDef {
  const def = PLOT_TIER_DEFS[tier]
  if (!def) throw new RangeError(`plotTierDef: unknown tier ${tier}`)
  return def
}
