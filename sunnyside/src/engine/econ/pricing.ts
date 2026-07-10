/**
 * engine/econ/pricing.ts — цена продажи и множители формулы SellRate (§4.5).
 *
 * SellRate(units/h) = R_base × D_cat × D_item × P_price × Q_quality × S_sat × L_stall × Staff
 * (§4.5, двусторонний контракт с 09-fair). Здесь — числа-истина входных множителей.
 *
 * ВАЖНО (анти-чит): всё это ТОЛЬКО предсказание для UI («продастся ≈N», «примерно $N»),
 * НИКОГДА не источник начисления — сервер считает сам.
 *
 * ГРАНИЦА: чистые функции, ноль сети/three.
 */

import {
  PRICE_ELASTICITY,
  PRICE_SLIDER_MAX,
  PRICE_SLIDER_MIN,
  QUALITY_MAX,
  QUALITY_PER_STAR,
} from './constants'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/**
 * Q_quality = 1 + 0.08×★, потолок 1.40 (§4.5). `stars` — число закрашенных ★ (0..5).
 * Значения вне [0,5] мягко зажимаются.
 */
export function qualityFactor(stars: number): number {
  return clamp(1 + QUALITY_PER_STAR * clamp(stars, 0, 5), 1, QUALITY_MAX)
}

/**
 * P_price = (p_ref / p_set)^ε, ε=1.8 (§4.5, 09-fair §4.3). Дешевле выставил (p_set<p_ref)
 * → продаётся быстрее (>1), дороже → медленнее (<1). Ползунок зажат 0.70×…1.50× p_ref.
 */
export function pricePressure(pRef: number, pSet: number): number {
  const lo = pRef * PRICE_SLIDER_MIN
  const hi = pRef * PRICE_SLIDER_MAX
  const clampedSet = clamp(pSet, lo, hi)
  if (clampedSet <= 0) return 0
  return Math.pow(pRef / clampedSet, PRICE_ELASTICITY)
}

/**
 * Итоговая цена продажи (метод `EconSystem.salePrice`): base × demand × saturation ×
 * quality. `quality` — число ★ (0..5), Q = 1 + 0.08×★ (§4.5). Не уходит ниже нуля.
 */
export function salePrice(
  basePrice: number,
  demandMult: number,
  saturationMult: number,
  quality: number,
): number {
  const raw = basePrice * demandMult * saturationMult * qualityFactor(quality)
  return Math.max(0, Math.round(raw))
}

/** Аргументы SellRate (§4.5). Необязательные множители по умолчанию нейтральны (1). */
export interface SellRateInput {
  /** R_base(tier) — базовая скорость units/h (§4.5). */
  rBase: number
  /** D_cat — недельный множитель категории (§3.6). */
  dCat?: number
  /** D_item — ностальгия ×2 или 1 (§3.7). */
  dItem?: number
  /** P_price — ценовое давление (§4.5). */
  pPrice?: number
  /** Q_quality — множитель качества (§4.5). */
  qQuality?: number
  /** S_sat — перенасыщение (§4.6). */
  sSat?: number
  /** L_stall — уровень палатки 1.00…1.30 (09-fair §3.6). */
  lStall?: number
  /** Staff — множитель постов Counter. */
  staff?: number
}

/**
 * Скорость продаж units/h (§4.5). Прогноз для `ui_fair_stall` («продастся ≈N/окно»).
 */
export function sellRate({
  rBase,
  dCat = 1,
  dItem = 1,
  pPrice = 1,
  qQuality = 1,
  sSat = 1,
  lStall = 1,
  staff = 1,
}: SellRateInput): number {
  return Math.max(0, rBase * dCat * dItem * pPrice * qQuality * sSat * lStall * staff)
}
