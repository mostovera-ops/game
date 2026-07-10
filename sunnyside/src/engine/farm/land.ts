/**
 * engine/farm/land.ts — расширение земли (Land Expansion), 02-farm §3.2/§4.1.
 *
 * Мастер-формула поштучных `field_plot` (K10, R4 DECISIONS-B):
 *   Cost(n) = round(100 × 1.18^(n−6), −10)  для n > 6; слоты 1–6 бесплатны (старт).
 * Канон §2.2 приведён к этой формуле («×1.18/слот», C5) — расхождения нет.
 *
 * Орчард-слоты (`orchard_plot`) — отдельная точечная шкала (не формула), взята
 * дословно из таблицы §4.1: батч-культуры дороже и не подчиняются той же кривой.
 *
 * ГРАНИЦА: чистые функции, ноль three/react/net. Числа — из спеки, не выдуманы.
 */

/** Стартовые бесплатные `field_plot` (02-farm §3.2). */
export const FREE_FIELD_PLOTS = 6

/** MVP-потолок сетки (02-farm §3.2, гипотеза-баланс). */
export const MAX_FIELD_PLOTS = 40
export const MAX_ORCHARD_PLOTS = 8

/** round(x, −10) — округление до десятков (half-up), как в формуле спеки. */
function roundToTens(value: number): number {
  return Math.round(value / 10) * 10
}

/**
 * Стоимость покупки слота №`slotNumber` (1-индексация, включая бесплатные 1–6).
 * `Cost(n) = round(100 × 1.18^(n−6), −10)` для n > `FREE_FIELD_PLOTS`; иначе 0.
 * Мастер-формула — 02-farm §4.1 (K10/R4 DECISIONS-B).
 */
export function fieldPlotCost(slotNumber: number): number {
  if (!Number.isInteger(slotNumber) || slotNumber < 1) {
    throw new RangeError(`fieldPlotCost: slotNumber must be a positive integer, got ${slotNumber}`)
  }
  if (slotNumber <= FREE_FIELD_PLOTS) return 0
  const raw = 100 * Math.pow(1.18, slotNumber - FREE_FIELD_PLOTS)
  return roundToTens(raw)
}

/**
 * Суммарная стоимость открытия всех слотов от `FREE_FIELD_PLOTS + 1` до `uptoSlot`
 * включительно (напр. для превью «открыть весь следующий блок из 5»).
 */
export function totalFieldExpansionCost(uptoSlot: number): number {
  if (!Number.isInteger(uptoSlot) || uptoSlot < FREE_FIELD_PLOTS) return 0
  let sum = 0
  for (let n = FREE_FIELD_PLOTS + 1; n <= uptoSlot; n++) sum += fieldPlotCost(n)
  return sum
}

/**
 * Орчард-слоты — точечная шкала, индекс 1..8 (02-farm §4.1 таблица, без формулы).
 * [900, 2200, 5000, 11000, 24000, 50000, 100000, 200000] Bucks.
 */
const ORCHARD_PLOT_COSTS: readonly number[] = [
  900, 2200, 5000, 11000, 24000, 50000, 100000, 200000,
]

/** Стоимость покупки орчард-слота №`slotNumber` (1..MAX_ORCHARD_PLOTS). */
export function orchardPlotCost(slotNumber: number): number {
  const cost = Number.isInteger(slotNumber) ? ORCHARD_PLOT_COSTS[slotNumber - 1] : undefined
  if (cost === undefined) {
    throw new RangeError(
      `orchardPlotCost: slotNumber out of range 1..${ORCHARD_PLOT_COSTS.length}, got ${slotNumber}`,
    )
  }
  return cost
}

/** Блоки открываются по 5 слотов сразу (02-farm §3.2) — вспомогательный хелпер для UI. */
export const LAND_EXPANSION_BLOCK_SIZE = 5

/** Номер блока (1-индексация), которому принадлежит слот №`slotNumber` среди платных. */
export function blockIndexForSlot(slotNumber: number): number {
  if (!Number.isInteger(slotNumber) || slotNumber <= FREE_FIELD_PLOTS) return 0
  return Math.ceil((slotNumber - FREE_FIELD_PLOTS) / LAND_EXPANSION_BLOCK_SIZE)
}
