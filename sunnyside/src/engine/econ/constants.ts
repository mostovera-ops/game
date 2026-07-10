/**
 * engine/econ/constants.ts — мастер-числа экономики из спеки 14-economy.
 *
 * ВСЕ значения здесь — дословно из `docs/specs/14-economy.md` (прошедшей ревью Фазы B),
 * canon §2.2/§2.3. Ничего не выдумано: каждая константа помечена ссылкой на раздел.
 * Формулы, использующие эти числа, живут в соседних файлах (saturation/dimes/pricing/…).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three / react / сети. Чистые данные + типы.
 */

import type { Tier } from '@/types'

// ── Опорная кривая тиров (14-economy §4.1 / §3.2, canon §2.2) ─────────────────
// «×150 ценность/клик, ×2.5 доход/час» T1→T5 — центральный дизайн-контракт.

export interface TierEconRefRow {
  tier: Tier
  /** Опорная цена блюда `$` (p_ref). */
  pRef: number
  /** Полный цикл блюда, минут. */
  cycleMin: number
  /** Валовый `$`/час на 1 слот (= pRef / (cycleMin/60)). */
  grossPerHour: number
  /** R_base(tier) — базовая скорость продаж units/h (§4.5). */
  rBase: number
}

/** Таблица §4.1 (финал canon §2.2). Источник истины для валидации каталогов. */
export const TIER_ECON_REF: readonly TierEconRefRow[] = [
  { tier: 1, pRef: 6, cycleMin: 5, grossPerHour: 72, rBase: 8.0 },
  { tier: 2, pRef: 22, cycleMin: 15, grossPerHour: 88, rBase: 3.0 },
  { tier: 3, pRef: 75, cycleMin: 45, grossPerHour: 100, rBase: 1.2 },
  { tier: 4, pRef: 260, cycleMin: 120, grossPerHour: 130, rBase: 0.4 },
  { tier: 5, pRef: 900, cycleMin: 300, grossPerHour: 180, rBase: 0.133 },
] as const

/** Дизайн-цель отношений T1→T5 (canon §2.2). */
export const CURVE_TARGET = {
  /** ценность за клик ×150 (p_ref T5/T1). */
  valuePerClickRatio: 150,
  /** доход/час ×2.5 (gross/h T5/T1). */
  grossPerHourRatio: 2.5,
} as const

// ── Demand Board: генерация недельного спроса (§3.6, §3.11) ────────────────────

/** 4 меты спроса (§3.6). Порядок фиксирован — влияет на детерминизм RNG-выборки. */
export const DEMAND_METAS = ['cat_grill', 'cat_bakery', 'cat_drinks', 'cat_produce'] as const
export type DemandMeta = (typeof DEMAND_METAS)[number]

/** Пол/потолок множителя категории D_cat (canon §2.3, §3.11). */
export const D_CAT_FLOOR = 0.7
export const D_CAT_CEIL = 1.3

/** Амплитуда недели: spread ∈ [0.15, 0.30], усиление ×1.7 перед клипом (§3.6 шаг 3). */
export const DEMAND_SPREAD_MIN = 0.15
export const DEMAND_SPREAD_MAX = 0.3
export const DEMAND_SPREAD_GAIN = 1.7

// ── Ностальгия-бонусы T1–T2 (§3.7) ────────────────────────────────────────────

/** Точечный множитель спроса на продукт (×2 к p_ref). */
export const NOSTALGIA_MULT = 2.0
/** Эффективный потолок спроса после стэка с D_cat (§3.7). */
export const NOSTALGIA_EFFECTIVE_CAP = 2.6

// ── Перенасыщение S_sat (§4.6) ────────────────────────────────────────────────

export const S_SAT_FLOOR = 0.4
export const S_SAT_CEIL = 1.15
/** Показатель эластичности: sqrt(Demand/Listed). */
export const S_SAT_EXP = 0.5

// ── Прайсинг Dimes-ускорений (§3.8) ───────────────────────────────────────────

/** dimes = ceil(DIME_A × t_min^DIME_B). */
export const DIME_A = 0.41
export const DIME_B = 0.53
/** Последняя минута (t ≤ 1) — бесплатно. */
export const DIME_FREE_MIN = 1

// ── Grand Opening (§3.10) ─────────────────────────────────────────────────────

export const GRAND_OPENING_MULT = 2.0
/** Стандартный триггер (старт/мердж/караван): 7×24 ч. */
export const GRAND_OPENING_MS = 7 * 24 * 60 * 60 * 1000
/** Win-back (реактивация): 48 ч. */
export const GRAND_OPENING_WINBACK_MS = 48 * 60 * 60 * 1000

// ── Формула продаж прилавка (§4.5) ────────────────────────────────────────────

/** Эластичность ценового ползунка P_price = (pRef/pSet)^ε (§4.5, 09-fair §4.3). */
export const PRICE_ELASTICITY = 1.8
/** Границы ценового ползунка прилавка 0.70×…1.50× p_ref (§3.11). */
export const PRICE_SLIDER_MIN = 0.7
export const PRICE_SLIDER_MAX = 1.5
/** Q_quality = 1 + 0.08×★, потолок 1.40 (§4.5, 09-fair §4.4). */
export const QUALITY_PER_STAR = 0.08
export const QUALITY_MAX = 1.4

// ── Farm Value (§3.5) ─────────────────────────────────────────────────────────

/** Σ(косметика+коллекции) ≤ 15% итогового FarmValue (§3.5, canon §2.4). */
export const FARM_VALUE_SOFT_CAP = 0.15
