/**
 * engine/fair/scoring.ts — ЧИСТЫЕ формулы активной смены (09-fair §3.5/§3.6/§4.6).
 *
 * Три канала выхода смены (§3.6):
 *   FairScore  = Σ_orders [ base_pts(order) × Q_quality × combo_mult × vip_mult ]
 *   ShiftBucks = Σ_served [ p_ref(dish) × served_qty ]
 *   ShiftTips  = Σ_served [ 0.12 × p_ref(dish) × combo_mult × staff_tip ]
 *
 * ПРОВАЛА НЕТ (E4/P3, §4.6): таймаут → House Special (флэт-очки, чек ×0.5, чаевые 0,
 * Combo сброс), без штрафа сверх упущенной выгоды.
 *
 * АНТИ-ЧИТ (§3.6, contracts.ts ShiftSystem): клиентские Tips/Score — ТОЛЬКО показ;
 * сервер реконструирует итог из фактически списанного стока на shift_submit. Эти
 * функции — зеркало для UI/итогового экрана, не источник начисления.
 */

import type { Tier } from '@/types/common'

import {
  BASE_PTS,
  BLUE_PLATE_COMBO_BONUS,
  BLUE_PLATE_PTS_MULT,
  COMBO_TIERS,
  HOUSE_SPECIAL_CHECK_MULT,
  HOUSE_SPECIAL_PTS,
  P_REF,
  PEGGY_TIPS_MULT,
  TENT_FAIR_SCORE_BONUS_AT_L4,
  TICKETS_PER_SCORE,
  TICKETS_WEEKLY_CAP,
  TIPS_BASE_PCT,
  VIP_MULT,
  type TentLevel,
} from './constants'
import { qualityFactor } from './sales'

// ════════════════════════════════════════════════════════════════════════════
// Combo-серия и множитель чаевых (§3.5)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Множитель Combo по текущему стрику (§3.5):
 * 0–2 → ×1.0 · 3–5 → ×1.25 · 6–9 → ×1.5 · 10+ → ×2.0.
 */
export function comboMultiplier(streak: number): number {
  const s = Math.max(0, Math.floor(streak))
  for (const tier of COMBO_TIERS) {
    if (s >= tier.minStreak) return tier.mult
  }
  return 1.0
}

/**
 * Следующий стрик после подачи (§3.5): успех +1 (Blue Plate +2, т.е. +1 базовый +2 бонус=+3? —
 * спека: «Blue Plate даёт +2 к Combo» сверх обычного +1); таймаут → сброс в 0.
 */
export function nextCombo(streak: number, outcome: 'success' | 'blue_plate' | 'timeout'): number {
  const s = Math.max(0, Math.floor(streak))
  if (outcome === 'timeout') return 0
  if (outcome === 'blue_plate') return s + 1 + BLUE_PLATE_COMBO_BONUS
  return s + 1
}

// ════════════════════════════════════════════════════════════════════════════
// Очки заказа (§3.6, §4.6)
// ════════════════════════════════════════════════════════════════════════════

/** Тип поданного заказа (§3.5/§3.6). */
export type OrderKind = 'normal' | 'blue_plate' | 'house_special'

/** Один поданный заказ смены. */
export interface ServedOrder {
  kind: OrderKind
  /** Тиры всех блюд заказа (для мульти-блюдного — массив; House Special игнорит). */
  dishTiers: Tier[]
  /** Mastery ★ (усреднённое/главного блюда) для Q_quality. */
  stars: number
  /** Combo-стрик НА МОМЕНТ этой подачи (до инкремента). */
  comboStreak: number
  /** VIP-гость (чек/очки/чаевые ×1.5). */
  vip?: boolean
}

/**
 * Базовые очки заказа (§3.6): сумма base_pts по блюдам; Blue Plate — 1.5× главного
 * (макс. тира) блюда; House Special — флэт 2 (§4.6).
 */
export function baseOrderPoints(order: ServedOrder): number {
  if (order.kind === 'house_special') return HOUSE_SPECIAL_PTS
  if (order.dishTiers.length === 0) return 0
  if (order.kind === 'blue_plate') {
    const mainTier = order.dishTiers.reduce((a, b) => (BASE_PTS[b] > BASE_PTS[a] ? b : a))
    return BASE_PTS[mainTier] * BLUE_PLATE_PTS_MULT
  }
  return order.dishTiers.reduce((sum, t) => sum + BASE_PTS[t], 0)
}

/**
 * Итоговые очки одного заказа (§3.6):
 *   base_pts × Q_quality × combo_mult × vip_mult.
 * House Special — только флэт base_pts (Q/combo/vip НЕ применяются, Combo уже сброшен, §4.6).
 */
export function orderScore(order: ServedOrder): number {
  const base = baseOrderPoints(order)
  if (order.kind === 'house_special') return base
  const q = qualityFactor(order.stars)
  const combo = comboMultiplier(order.comboStreak)
  const vip = order.vip ? VIP_MULT : 1
  return base * q * combo * vip
}

// ════════════════════════════════════════════════════════════════════════════
// Bucks и Tips (§3.5/§3.6)
// ════════════════════════════════════════════════════════════════════════════

/** p_ref блюда тира ($). */
function dishRefPrice(tier: Tier): number {
  return P_REF[tier]
}

/**
 * Bucks за заказ (§3.6): Σ p_ref(dish) по блюдам. House Special — чек ×0.5 от p_ref
 * усреднённого блюда заказа (§4.6), сток НЕ списывается.
 */
export function orderBucks(order: ServedOrder): number {
  if (order.dishTiers.length === 0) return 0
  const sum = order.dishTiers.reduce((s, t) => s + dishRefPrice(t), 0)
  if (order.kind === 'house_special') {
    const avg = sum / order.dishTiers.length
    return avg * HOUSE_SPECIAL_CHECK_MULT
  }
  const vip = order.vip ? VIP_MULT : 1
  return sum * vip
}

/**
 * Чаевые за заказ (§3.5/§3.6): 0.12 × Σp_ref × combo_mult × staff_tip × vip_mult.
 * House Special — 0 чаевых (§4.6). `peggy` = назначен Carhop Peggy (+15%, §3.9).
 */
export function orderTips(order: ServedOrder, opts: { peggy?: boolean } = {}): number {
  if (order.kind === 'house_special' || order.dishTiers.length === 0) return 0
  const sum = order.dishTiers.reduce((s, t) => s + dishRefPrice(t), 0)
  const combo = comboMultiplier(order.comboStreak)
  const staffTip = opts.peggy ? PEGGY_TIPS_MULT : 1
  const vip = order.vip ? VIP_MULT : 1
  return TIPS_BASE_PCT * sum * combo * staffTip * vip
}

// ════════════════════════════════════════════════════════════════════════════
// Итог смены (§3.6) — агрегат для итогового экрана / shift_submit-предпросмотра
// ════════════════════════════════════════════════════════════════════════════

export interface ShiftScoreResult {
  fairScore: number
  bucks: number
  tips: number
  /** 🎟 за эту смену от порога Fair Score (кэп применяется на недельном уровне). */
  ticketsRaw: number
  /** Число успешных (не House Special) подач. */
  served: number
}

export interface ShiftScoreOpts {
  peggy?: boolean
  /** Уровень палатки — ур.4+ даёт +10% Fair Score (§3.6). */
  tentLevel?: TentLevel
  /** §3.9 Ada +5% Bucks — множитель на итоговые Bucks (передаётся вызывающим). */
  bucksMult?: number
}

/**
 * Итог смены: суммирует очки/деньги/чаевые по всем поданным заказам (§3.6).
 * Порядок заказов задаёт `comboStreak` каждого — вызывающий обязан их проставить
 * согласованно (используй `nextCombo` при прогоне очереди). Возвращает и «сырые»
 * тикеты (без недельного кэпа) — кэп 5/неделя суммируется по всем сменам окна (R10).
 */
export function scoreShift(orders: ServedOrder[], opts: ShiftScoreOpts = {}): ShiftScoreResult {
  let fairScore = 0
  let bucks = 0
  let tips = 0
  let served = 0

  for (const order of orders) {
    fairScore += orderScore(order)
    bucks += orderBucks(order)
    tips += orderTips(order, { peggy: opts.peggy })
    if (order.kind !== 'house_special') served++
  }

  const tentBonus = opts.tentLevel && opts.tentLevel >= 4 ? 1 + TENT_FAIR_SCORE_BONUS_AT_L4 : 1
  fairScore *= tentBonus
  bucks *= Math.max(0, opts.bucksMult ?? 1)

  return {
    fairScore: Math.round(fairScore),
    bucks: Math.round(bucks),
    tips: Math.round(tips),
    ticketsRaw: Math.floor(Math.round(fairScore) / TICKETS_PER_SCORE),
    served,
  }
}

/**
 * 🎟 Tickets от накопленного за НЕДЕЛЮ Fair Score (§3.6/R10): +1 за 500 очков,
 * жёсткий кэп 5/неделя (суммарно по всем сменам окна, не за смену).
 */
export function weeklyTickets(weeklyFairScore: number): number {
  const raw = Math.floor(Math.max(0, weeklyFairScore) / TICKETS_PER_SCORE)
  return Math.min(TICKETS_WEEKLY_CAP, raw)
}
