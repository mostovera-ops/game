/**
 * engine/craft/levels.ts — кривая апгрейда станка (docs/specs/04-machines.md §3.4/§4.3).
 *
 * Станок имеет 5 уровней; апгрейд даёт 4 независимых эффекта (§4.3, таблица «сводно,
 * применимо к любому станку»): −время цикла, +слоты очереди, +размер батча, +цена
 * выхода (Station Quality). Инкременты НЕ равномерны по уровням (слоты — на Ур.2/4/5,
 * батч — на Ур.3/5, см. §3.4), поэтому таблицы ниже — явные lookup, не формула.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net, только чистые функции + `@/types`.
 */
import type { MachineKey } from '@/types'

/** Станок — 5 уровней апгрейда (§3.4 «Апгрейды станков (5 уровней на станок)»). */
export const MACHINE_MAX_LEVEL = 5

/**
 * Слотов ОЖИДАНИЯ (сверх всегда-1 активного) по уровню — §3.4: «+1 на Ур.2, +1 на Ур.4,
 * +1 на Ур.5» (три инкремента), сведено в §4.3 как кумулятивная таблица per-level.
 */
const WAITING_SLOTS_BY_LEVEL: Readonly<Record<number, number>> = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 }

/** Прирост максимального батча СВЕРХ базового батча станка (Ур.1) — §3.4/§4.3: +1 на Ур.3, +1 на Ур.5. */
const BATCH_BONUS_BY_LEVEL: Readonly<Record<number, number>> = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 }

/** −Время цикла кумулятивно, доля (0.08 = −8%) — §4.3: −8%/уровень до −32% на Ур.5. */
const TIME_REDUCTION_BY_LEVEL: Readonly<Record<number, number>> = { 1: 0, 2: 0.08, 3: 0.16, 4: 0.24, 5: 0.32 }

/**
 * +Цена продукта станка (Station Quality) кумулятивно, доля (0.02 = +2%) — §4.3.
 * ВНИМАНИЕ: это модификатор ЦЕНЫ (складывается с `mech_mastery`, §4.3/§6), НЕ значение
 * `Quality` (1..5) выхода партии — то отдельная шкала (`RecipeMastery.qualityBonus`).
 */
const STATION_QUALITY_BONUS_BY_LEVEL: Readonly<Record<number, number>> = { 1: 0, 2: 0.02, 3: 0.04, 4: 0.06, 5: 0.08 }

function clampLevel(level: number): number {
  return Math.min(MACHINE_MAX_LEVEL, Math.max(1, Math.round(level)))
}

/** Слоты ожидания на уровне станка (0..3). */
export function waitingSlots(level: number): number {
  return WAITING_SLOTS_BY_LEVEL[clampLevel(level)] ?? 0
}

/** Ёмкость очереди станка (активный слот + ожидание) — §3.3: до 4 партий на Ур.5. */
export function queueCapacity(level: number): number {
  return 1 + waitingSlots(level)
}

/** Прирост максимального батча над базой станка на данном уровне. */
export function batchBonus(level: number): number {
  return BATCH_BONUS_BY_LEVEL[clampLevel(level)] ?? 0
}

/** Множитель времени цикла (1 = без изменений, 0.68 = −32% на Ур.5). */
export function timeMultiplier(level: number): number {
  return 1 - (TIME_REDUCTION_BY_LEVEL[clampLevel(level)] ?? 0)
}

/** Эффективное время цикла в секундах с учётом уровня станка (округление до целой секунды). */
export function effectiveCraftSec(baseCraftSec: number, level: number): number {
  return Math.max(1, Math.round(baseCraftSec * timeMultiplier(level)))
}

/** Бонус к цене выхода станка (Station Quality), доля — 0.08 = +8% на Ур.5. */
export function stationQualityBonus(level: number): number {
  return STATION_QUALITY_BONUS_BY_LEVEL[clampLevel(level)] ?? 0
}

/**
 * Базовый батч станка на Ур.1 (04-machines.md §4.1 «Базовый батч (Ур.1)»), независим
 * от рецепта — сколько единиц можно поставить в одну постановку очереди по умолчанию.
 * Mill (`mch_mill`) — 4 уже на Ур.1: «эффективный помол... мука партиями ×4» (§3.2/§4.1).
 */
const MACHINE_BASE_BATCH: Readonly<Record<string, number>> = {
  mch_grill: 2,
  mch_oven: 1,
  mch_churn: 3,
  mch_soda_fountain: 2,
  mch_ice_cream: 2,
  mch_coffee: 3,
  mch_fryer: 3,
  mch_mill: 4,
  mch_smoker: 1,
  mch_steam_kettle: 2,
}

/** Базовый батч станка на Ур.1. Незнакомый ключ (вне реестра §3.2) — консервативный дефолт 1. */
export function machineBaseBatch(machineKey: MachineKey): number {
  return MACHINE_BASE_BATCH[machineKey] ?? 1
}

/** Максимальный батч станка на уровне (база станка + бонус уровня, §4.3). */
export function maxBatch(machineKey: MachineKey, level: number): number {
  return machineBaseBatch(machineKey) + batchBonus(level)
}
