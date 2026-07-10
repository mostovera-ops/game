/**
 * engine/fair/sales.ts — ЧИСТЫЕ формулы пассивных продаж прилавка (09-fair §3.3).
 *
 * Ядро пассива:
 *   SellRate(ед/ч) = R_base(tier) × D_cat × P_price × Q_quality × S_sat × L_stall × Staff
 *
 * ГРАНИЦА/АНТИ-ЧИТ (AGENTS.md §0.3): ноль сети/three/store, детерминированные функции.
 * Это ТОЛЬКО предсказание для UI («продастся ≈ N/окно», ползунок цены) и для локального
 * catch-up-досчёта офлайн-игрока — НИКОГДА не источник начисления: серверный fair-tick
 * (Edge/cron 15 мин) считает истину, клиент лишь зеркалит (09-fair §6, 20-backend).
 *
 * Все коэффициенты — из `./constants.ts` (числа спеки), формулы — из §3.3/§4.x дословно.
 */

import type { Tier } from '@/types/common'

import {
  DEMAND_MAX,
  DEMAND_MIN,
  P_REF,
  PRICE_ELASTICITY,
  PRICE_MAX_MULT,
  PRICE_MIN_MULT,
  QUALITY_MAX_STARS,
  QUALITY_PER_STAR,
  BLUE_PLATE_PRICE_BONUS,
  R_BASE,
  SAT_CEIL,
  SAT_EXPONENT,
  SAT_FLOOR,
  STACK_CAP,
  TICK_HOURS,
} from './constants'

// ════════════════════════════════════════════════════════════════════════════
// Отдельные множители SellRate (§3.3)
// ════════════════════════════════════════════════════════════════════════════

/** Референс-цена блюда тира (§4.1). */
export function refPrice(tier: Tier): number {
  return P_REF[tier]
}

/** Допустимый коридор цены лота [0.70×…1.50× p_ref] (§3.3). */
export function priceBounds(tier: Tier): { min: number; max: number } {
  const p = P_REF[tier]
  return { min: p * PRICE_MIN_MULT, max: p * PRICE_MAX_MULT }
}

/** Клампит выставляемую цену в допустимый коридор тира (§3.3, ползунок). */
export function clampPrice(tier: Tier, priceSet: number): number {
  const { min, max } = priceBounds(tier)
  return Math.min(max, Math.max(min, priceSet))
}

/**
 * Ценовая эластичность `P_price = (p_ref / p_set)^ε`, ε=1.8 (§3.3/§4.3).
 * Дороже → медленнее (P<1), дешевле → быстрее (P>1). При p_set=p_ref → 1.0.
 * Цена клампится в коридор ДО расчёта (жадность 2× физически недоступна, §3.3).
 */
export function pricePressure(tier: Tier, priceSet: number): number {
  const pRef = P_REF[tier]
  const pSet = clampPrice(tier, priceSet)
  if (pSet <= 0) return Math.pow(pRef / (pRef * PRICE_MIN_MULT), PRICE_ELASTICITY)
  return Math.pow(pRef / pSet, PRICE_ELASTICITY)
}

/** Качество от Mastery ★: `Q = 1 + 0.08 × stars`, stars клампится 0..5 (§3.3/§4.4). */
export function qualityFactor(stars: number): number {
  const s = Math.min(QUALITY_MAX_STARS, Math.max(0, stars))
  return 1 + QUALITY_PER_STAR * s
}

/** Спрос категории D_cat клампится в коридор Demand Board [0.70…1.30] (§3.3/§4.2). */
export function clampDemand(demand: number): number {
  return Math.min(DEMAND_MAX, Math.max(DEMAND_MIN, demand))
}

/**
 * Городское насыщение категории (анти-флуд E7, §3.3):
 *   S = clamp( (Demand_units / max(Listed_units,1))^0.5 , 0.40 , 1.15 )
 * Пустая категория (Listed=0) → знаменатель 1 → бонус за дефицит (стремится к 1.15).
 * Все залили одну мету (Listed≫Demand) → пол 0.40 (мягко дешевеет, не в ноль).
 */
export function saturation(demandUnits: number, listedUnits: number): number {
  const listed = Math.max(1, listedUnits)
  const ratio = Math.max(0, demandUnits) / listed
  const s = Math.pow(ratio, SAT_EXPONENT)
  return Math.min(SAT_CEIL, Math.max(SAT_FLOOR, s))
}

/**
 * `Demand_units_cat = D_cat × N_active × base_appetite_cat` (§3.3).
 * N_active — активные фермы города; base_appetite_cat — референс-потребление
 * категории на ферму (калибровка 14-economy, приходит параметром — не выдумано здесь).
 */
export function demandUnits(dCat: number, nActiveFarms: number, baseAppetite: number): number {
  return clampDemand(dCat) * Math.max(0, nActiveFarms) * Math.max(0, baseAppetite)
}

// ════════════════════════════════════════════════════════════════════════════
// SellRate — сборка ядра (§3.3)
// ════════════════════════════════════════════════════════════════════════════

/** Входы формулы скорости продаж лота (§3.3). Все множители независимы. */
export interface SellRateInput {
  tier: Tier
  /** Множитель спроса категории с Demand Board (0.70…1.30). */
  demand: number
  /** Выставленная цена лота ($); клампится в коридор тира. */
  priceSet: number
  /** Mastery ★ блюда (0..5). */
  stars: number
  /** Городское насыщение S_sat (см. `saturation`). По умолчанию 1.0 (нет данных города). */
  sat?: number
  /** Бонус вместимости/уровня палатки L_stall (1.00…1.20, §3.6). */
  lStall?: number
  /** Произведение множителей активного Counter-стаффа на скорость (§3.9). По умолчанию 1.0. */
  staff?: number
}

/**
 * §3.3: SellRate(ед/ч) = R_base × D_cat × P_price × Q_quality × S_sat × L_stall × Staff.
 * Пример спеки (Cherry Pie T3, ★3, D=1.25, 1.1×, S=0.9, L=1.10) → ≈1.56 ед/ч.
 */
export function sellRate({
  tier,
  demand,
  priceSet,
  stars,
  sat = 1,
  lStall = 1,
  staff = 1,
}: SellRateInput): number {
  return (
    R_BASE[tier] *
    clampDemand(demand) *
    pricePressure(tier, priceSet) *
    qualityFactor(stars) *
    Math.max(0, sat) *
    Math.max(0, lStall) *
    Math.max(0, staff)
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Catch-up: интеграл продаж по тикам (§3.3 — офлайн-досчёт «при заходе»)
// ════════════════════════════════════════════════════════════════════════════

/** cap стека лота по тиру (§3.2). */
export function stackCap(tier: Tier): number {
  return STACK_CAP[tier]
}

export interface LotSaleResult {
  /** Продано единиц за период. */
  unitsSold: number
  /** Выручка ($) = unitsSold × p_set. */
  revenue: number
  /** Остаток лота после продаж. */
  remaining: number
  /**
   * Дробный «хвост» накопителя единиц [0,1): недопроданная за целые тики доля.
   * Копится между заходами, чтобы медленные T4–T5 (0.4 ед/ч) всё же продавались (§3.3).
   */
  accumulator: number
}

/**
 * Досчёт продаж лота за `ticks` тиков (15 мин каждый) с дробным накопителем.
 * §3.3: за тик = floor(SellRate × 0.25 ч + accumulator) единиц, но не больше остатка.
 * Каждая единица приносит p_set (клампленный в коридор). Возвращает и остаток аккумулятора.
 */
export function simulateLotSales(input: {
  rate: SellRateInput
  remaining: number
  priceSet: number
  ticks: number
  /** Ранее накопленный дробный хвост (0..1). */
  accumulator?: number
  /** F10 Grand Opening ×2 к доходу (не к скорости) — множитель выручки, по умолч. 1. */
  revenueMult?: number
}): LotSaleResult {
  const { rate, ticks, revenueMult = 1 } = input
  const perTick = sellRate(rate) * TICK_HOURS
  const price = clampPrice(rate.tier, input.priceSet)

  let remaining = Math.max(0, Math.floor(input.remaining))
  let acc = Math.max(0, input.accumulator ?? 0)
  let sold = 0

  // Эпсилон гасит дрейф float (напр. 0.1×10 = 0.999…), чтобы «последняя единица» §3.3
  // надёжно продавалась ровно на целевом тике; 1e-9 ≪ 1 — не создаёт ложной продажи.
  const ACC_EPS = 1e-9
  const wholeTicks = Math.max(0, Math.floor(ticks))
  for (let t = 0; t < wholeTicks && remaining > 0; t++) {
    acc += perTick
    const whole = Math.floor(acc + ACC_EPS)
    const take = Math.min(whole, remaining)
    sold += take
    remaining -= take
    acc -= take // сохраняем дробный хвост, целую проданную часть списываем
  }
  // Если сток кончился — дальнейший аккумулятор не копим (нечего продавать).
  if (remaining === 0) acc = 0

  return {
    unitsSold: sold,
    revenue: Math.round(sold * price * Math.max(0, revenueMult)),
    remaining,
    accumulator: acc,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Blue Plate Special — сет (§4.5)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Цена сета Blue Plate: +15% к сумме p_ref компонентов (§4.5). Занимает 1 слот,
 * продаётся единым лотом. `componentRefPrices` — p_ref каждого из 3 компонентов.
 */
export function bluePlatePrice(componentRefPrices: number[]): number {
  const sum = componentRefPrices.reduce((a, b) => a + Math.max(0, b), 0)
  return Math.round(sum * (1 + BLUE_PLATE_PRICE_BONUS))
}
