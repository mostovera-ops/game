/**
 * engine/fair/constants.ts — мастер-числа Ярмарки (docs/specs/09-fair.md).
 *
 * Все значения — ИЗ СПЕКИ 09-fair.md (раздел указан у каждой группы), не выдуманы.
 * Спека помечает часть чисел `(гипотеза)` до финальной калибровки в 14-economy —
 * здесь они воспроизведены дословно как источник для формул; при расхождении
 * канон/14-economy — истина, эти константы обновляются, но НЕ формулы.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net — чистые данные, node-тестируемо.
 */

import type { Tier } from '@/types/common'
import {
  TIER_ECON_REF,
  PRICE_ELASTICITY as ECON_PRICE_ELASTICITY,
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  QUALITY_PER_STAR as ECON_QUALITY_PER_STAR,
  S_SAT_EXP,
  S_SAT_FLOOR,
  S_SAT_CEIL,
  D_CAT_FLOOR,
  D_CAT_CEIL,
  GRAND_OPENING_MULT as ECON_GRAND_OPENING_MULT,
} from '@/engine/econ/constants'

// ════════════════════════════════════════════════════════════════════════════
// Fair Stall — пассивный прилавок (§3.3, §4.1, §4.3)
// ════════════════════════════════════════════════════════════════════════════
//
// ДЕДУП (ENG-3): общие эконом-числа (R_base/p_ref-кривая, эластичность, качество,
// насыщение, коридор спроса) — из мастер-таблицы `@/engine/econ/constants`
// (14-economy). Здесь они лишь пере-экспортируются под fair-именами, чтобы устранить
// класс дрейфа (ENG-1). Fair-специфичное (STACK_CAP, палатка, смена, конкурсы) — ниже.

/** §4.1: базовая скорость продаж по тиру (ед/ч при p_ref, ★0, D=1). Из TIER_ECON_REF. */
export const R_BASE: Record<Tier, number> = Object.fromEntries(
  TIER_ECON_REF.map((r) => [r.tier, r.rBase]),
) as Record<Tier, number>

/** §4.1: референс-цена блюда по тиру ($, канон §2.2). Из TIER_ECON_REF. */
export const P_REF: Record<Tier, number> = Object.fromEntries(
  TIER_ECON_REF.map((r) => [r.tier, r.pRef]),
) as Record<Tier, number>

/** §3.3/§4.3: эластичность цены ε в `P = (p_ref/p_set)^ε`. */
export const PRICE_ELASTICITY = ECON_PRICE_ELASTICITY

/** §3.3: допустимый коридор ползунка цены относительно p_ref. */
export const PRICE_MIN_MULT = PRICE_SLIDER_MIN
export const PRICE_MAX_MULT = PRICE_SLIDER_MAX

/** §3.3/§4.4: качество от Mastery ★ — `Q = 1 + 0.08 × stars` (★0→1.0 … ★5→1.40). */
export const QUALITY_PER_STAR = ECON_QUALITY_PER_STAR
/** Fair-specific: потолок ★ для клампа качества (★0..5). */
export const QUALITY_MAX_STARS = 5

/** §3.3: городское насыщение `S = clamp((Demand/max(Listed,1))^0.5, 0.40, 1.15)`. */
export const SAT_EXPONENT = S_SAT_EXP
export const SAT_FLOOR = S_SAT_FLOOR
export const SAT_CEIL = S_SAT_CEIL

/** §3.3: границы множителя спроса категории D_cat с Demand Board (±15–30%). */
export const DEMAND_MIN = D_CAT_FLOOR
export const DEMAND_MAX = D_CAT_CEIL

/** §3.2: cap стека в слоте по тиру (единиц). */
export const STACK_CAP: Record<Tier, number> = {
  1: 200,
  2: 80,
  3: 30,
  4: 12,
  5: 5,
}

/** §3.3: тик симуляции продаж = 15 мин = 0.25 ч. */
export const TICK_MINUTES = 15
export const TICK_HOURS = TICK_MINUTES / 60

/** §4.5: ценовой бонус Blue Plate Special к сумме p_ref компонентов. */
export const BLUE_PLATE_PRICE_BONUS = 0.15

/** F10: Grand Opening — ×2 к доходу прилавка первую неделю новичка (из econ-мастера). */
export const GRAND_OPENING_MULT = ECON_GRAND_OPENING_MULT

// ════════════════════════════════════════════════════════════════════════════
// Fair Tent — апгрейды палатки (§3.6). 5 уровней, качают пассив и смену.
// ════════════════════════════════════════════════════════════════════════════

export type TentLevel = 1 | 2 | 3 | 4 | 5

export interface TentTier {
  readonly displaySlots: number // §3.2 — слоты выкладки (пассив)
  readonly lStall: number // §3.3 — множитель L_stall
  readonly queueLen: number // §3.5 — длина очереди (смена)
  readonly timerSec: number // §3.4 — таймер смены (660 базово, +15/ур, потолок 720)
  readonly cost: number // $ Bucks-синк (ур.1 — старт, 0)
}

/** §3.6 таблица апгрейдов палатки (числа дословно). */
export const TENT_TIERS: Record<TentLevel, TentTier> = {
  1: { displaySlots: 6, lStall: 1.0, queueLen: 4, timerSec: 660, cost: 0 },
  2: { displaySlots: 8, lStall: 1.05, queueLen: 5, timerSec: 675, cost: 3000 },
  3: { displaySlots: 9, lStall: 1.1, queueLen: 6, timerSec: 690, cost: 9000 },
  4: { displaySlots: 11, lStall: 1.15, queueLen: 7, timerSec: 705, cost: 26000 },
  5: { displaySlots: 12, lStall: 1.2, queueLen: 8, timerSec: 720, cost: 70000 },
}

/** §3.2: базовая/максимальная вместимость слотов. */
export const DISPLAY_SLOTS_BASE = 6
export const DISPLAY_SLOTS_MAX = 12

/** §3.6 бонусы уровней палатки (сверх базовых множителей). */
export const TENT_TIPS_BONUS_AT_L2 = 0.05 // +5% чаевые с ур.2
export const TENT_PATIENCE_BONUS_SEC_AT_L3 = 2 // +2 с терпения с ур.3
export const TENT_FAIR_SCORE_BONUS_AT_L4 = 0.1 // +10% Fair Score с ур.4
export const TENT_VIP_CHANCE_BONUS_AT_L5 = 0.05 // +5% VIP-шанс с ур.5

// ════════════════════════════════════════════════════════════════════════════
// Counter Shift — активная смена (§3.4, §3.5, §3.6, §4.6)
// ════════════════════════════════════════════════════════════════════════════

/** §3.6: базовые очки заказа по тиру поданного блюда. */
export const BASE_PTS: Record<Tier, number> = {
  1: 10,
  2: 20,
  3: 35,
  4: 60,
  5: 100,
}

/** §3.6/§4.5: Blue Plate — 1.5 × base_pts главного блюда, +2 к Combo. */
export const BLUE_PLATE_PTS_MULT = 1.5
export const BLUE_PLATE_COMBO_BONUS = 2

/** §4.6: House Special (fallback таймаута) — флэт очки, чек ×0.5, чаевые 0, Combo сброс. */
export const HOUSE_SPECIAL_PTS = 2
export const HOUSE_SPECIAL_CHECK_MULT = 0.5

/** §3.5: множитель чаевых по Combo-стрику (порог → множитель). */
export interface ComboTier {
  readonly minStreak: number
  readonly mult: number
}
export const COMBO_TIERS: readonly ComboTier[] = [
  { minStreak: 10, mult: 2.0 }, // «×2 TIPS!»
  { minStreak: 6, mult: 1.5 },
  { minStreak: 3, mult: 1.25 },
  { minStreak: 0, mult: 1.0 },
] as const

/** §3.5: VIP-гость — чек и чаевые ×1.5, +5 с терпения. */
export const VIP_MULT = 1.5
export const VIP_PATIENCE_BONUS_SEC = 5

/** §3.5/§3.6: чаевые = 12% цены × combo × стафф. */
export const TIPS_BASE_PCT = 0.12
/** §3.9: Carhop Peggy (`staff_peggy`) — +15% к чаевым (множитель 1.15). */
export const PEGGY_TIPS_MULT = 1.15

/** §3.6/R10: +1 🎟 за каждые 500 очков Fair Score, кэп 5 🎟/неделя. */
export const TICKETS_PER_SCORE = 500
export const TICKETS_WEEKLY_CAP = 5

/** §3.9: Bookkeeper Ada (`staff_ada`) — +5% Bucks со всех продаж (пассив+смена). */
export const ADA_BUCKS_MULT = 1.05

/** §3.5: фазы смены (сек от старта) и их параметры генерации. */
export type ShiftPhase = 'warmup' | 'rush' | 'last_call'

export interface PhaseParams {
  readonly spawnIntervalSec: number // §3.5 интервал спавна
  readonly patienceSec: number // §3.5 таймер терпения
  readonly minOrderDishes: number
  readonly maxOrderDishes: number
  readonly vipChance: number // §3.5 шанс VIP
}

/** §3.5 таблица генерации посетителей по фазам (таблица — истина над прозой §3.4). */
export const PHASE_PARAMS: Record<ShiftPhase, PhaseParams> = {
  warmup: { spawnIntervalSec: 8.0, patienceSec: 25, minOrderDishes: 1, maxOrderDishes: 1, vipChance: 0 },
  rush: { spawnIntervalSec: 4.0, patienceSec: 18, minOrderDishes: 1, maxOrderDishes: 3, vipChance: 0 },
  last_call: { spawnIntervalSec: 2.5, patienceSec: 15, minOrderDishes: 2, maxOrderDishes: 3, vipChance: 0.2 },
}

/** §3.4: границы фаз (сек). Warm-up 0–60, Rush 60–480, Last Call 480–конец. */
export const WARMUP_END_SEC = 60
export const RUSH_END_SEC = 480

/** §3.4: до 3 смен за окно, кулдаун 2 ч между сменами. */
export const MAX_SHIFTS_PER_WINDOW = 3
export const SHIFT_COOLDOWN_MS = 2 * 60 * 60 * 1000

// ════════════════════════════════════════════════════════════════════════════
// Contests — конкурсы (§3.7, §3.8, §4.7)
// ════════════════════════════════════════════════════════════════════════════

/** §3.8: веса судейства ContestScore = W_npc·NPC + W_vote·VoteShare. */
export interface ContestWeights {
  readonly npc: number
  readonly vote: number
}
export const CONTEST_WEIGHTS = {
  ct_pie_week: { npc: 0.5, vote: 0.5 },
  ct_giant_veg: { npc: 1.0, vote: 0.0 },
  ct_best_window: { npc: 0.0, vote: 1.0 },
} as const satisfies Record<string, ContestWeights>

/** §3.8: диапазон NPC-метрики Miss Maybelle. */
export const NPC_SCORE_MAX = 100

/** §3.7: минимум заявок в дивизионе, иначе схлопывание вверх (F8). */
export const MIN_ENTRIES_PER_DIVISION = 6

/** §4.7: Giant Vegetable — базовый вес и жёсткий потолок культуры (у.е.). */
export type GiantVegCrop = 'pumpkin' | 'watermelon' | 'zucchini'
export const GIANT_VEG_W_BASE: Record<GiantVegCrop, number> = {
  pumpkin: 8.0,
  watermelon: 6.0,
  zucchini: 3.0,
}
export const GIANT_VEG_W_CAP: Record<GiantVegCrop, number> = {
  pumpkin: 20,
  watermelon: 15,
  zucchini: 8,
}

/** §4.7: вклад одного цикла удобрения в вес (+0.15) и потолок циклов. */
export const FERTILIZER_TICK_BONUS = 0.15
export const FERTILIZER_TICKS_MAX = 6

/** §4.7: границы качества грядки и бонуса агрономии (kh_agronomy). */
export const QUALITY_MULT_MIN = 1.0
export const QUALITY_MULT_MAX = 1.5
export const AGRONOMY_BONUS_MIN = 1.0
export const AGRONOMY_BONUS_MAX = 1.25
