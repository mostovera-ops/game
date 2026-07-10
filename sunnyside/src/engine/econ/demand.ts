/**
 * engine/econ/demand.ts — генерация недельного спроса Demand Board (§3.6) и
 * ностальгия-бонусов T1–T2 (§3.7).
 *
 * Детерминизм: всё от `seed = hash(week, town)` (§3.6) — весь город видит одну доску,
 * стрит делит категории заранее. Зеро-сумность (Σ отклонений ≈ 0) — анти-инфляция §3.11.
 *
 * ГРАНИЦА: чистые функции, ноль сети/three. Пул продуктов для ностальгии передаётся
 * снаружи (каталог) — модуль не импортирует src/data напрямую, остаётся тестируемым.
 */

import {
  DEMAND_METAS,
  DEMAND_SPREAD_GAIN,
  DEMAND_SPREAD_MAX,
  DEMAND_SPREAD_MIN,
  D_CAT_CEIL,
  D_CAT_FLOOR,
  NOSTALGIA_EFFECTIVE_CAP,
  NOSTALGIA_MULT,
  type DemandMeta,
} from './constants'
import { hashSeed, seededRng, type SeededRng } from './rng'

/** Одна ностальгия-цель недели: продукт T1–T2 с ×2 спросом (§3.7). */
export interface NostalgiaPick {
  productKey: string
  mult: number
}

/** Результат недельной генерации спроса. */
export interface WeeklyDemand {
  weekIndex: number
  townId: string
  seed: number
  /** D_cat по 4 метам, каждый в [0.70, 1.30], Σ(D−1) ≈ 0. */
  dCat: Record<DemandMeta, number>
  /** 1–2 продукта T1–T2 с точечным ×2 (пусто, если пул не передан). */
  nostalgia: NostalgiaPick[]
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const average = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length

/**
 * Ре-нормировка к зеро-сумме после клипа (§3.6 шаг 4): клип в [0.70,1.30] мог нарушить
 * Σ(D−1)=0. Распределяем остаток пропорционально НЕ-зажатым категориям, повторяя до
 * сходимости (или до лимита итераций — защита от зацикливания на всех-зажатых).
 */
function renormalizeZeroSum(d: number[]): number[] {
  const out = d.slice()
  for (let iter = 0; iter < 24; iter++) {
    const residual = out.length - out.reduce((s, x) => s + x, 0) // цель Σ = N (mean 1)
    if (Math.abs(residual) < 1e-9) break
    const free = out
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v > D_CAT_FLOOR + 1e-9 && v < D_CAT_CEIL - 1e-9)
    if (free.length === 0) break
    const share = residual / free.length
    for (const { i } of free) out[i] = clamp(out[i]! + share, D_CAT_FLOOR, D_CAT_CEIL)
  }
  return out
}

/** Строит D_cat по 4 метам из готового RNG (§3.6 шаги 1–4). */
export function computeDCat(rng: SeededRng): Record<DemandMeta, number> {
  // 1. Сырые тяготения
  const raw = DEMAND_METAS.map(() => rng.uniform(-1, 1))
  // 2. Зеро-сумная нормировка (центрируем к 0)
  const mean = average(raw)
  const centered = raw.map((r) => r - mean)
  // 3. Масштаб в ±15…30% (усиление ×1.7) и клип
  const clipped = centered.map((c) => {
    const spread = rng.uniform(DEMAND_SPREAD_MIN, DEMAND_SPREAD_MAX)
    return clamp(1 + c * spread * DEMAND_SPREAD_GAIN, D_CAT_FLOOR, D_CAT_CEIL)
  })
  // 4. Ре-нормировка после клипа
  const renorm = renormalizeZeroSum(clipped)
  const dCat = {} as Record<DemandMeta, number>
  DEMAND_METAS.forEach((meta, i) => {
    dCat[meta] = renorm[i]!
  })
  return dCat
}

/**
 * Ностальгия-выборка (§3.7): 1 или 2 продукта T1–T2 из пула, каждый ×2. Кол-во —
 * `1 + (rng<0.5 ? 1 : 0)`.
 */
export function pickNostalgia(rng: SeededRng, pool: readonly string[]): NostalgiaPick[] {
  if (pool.length === 0) return []
  const count = 1 + (rng.next() < 0.5 ? 1 : 0)
  return rng.sample(pool, count).map((productKey) => ({ productKey, mult: NOSTALGIA_MULT }))
}

/**
 * Полная генерация недельного спроса. `nostalgiaPool` — ключи продуктов T1–T2 (из
 * каталога); передаётся вызывающим (сцена/система), чтобы demand.ts не тянул src/data.
 */
export function generateWeeklyDemand(
  weekIndex: number,
  townId: string,
  nostalgiaPool: readonly string[] = [],
): WeeklyDemand {
  const seed = hashSeed(weekIndex, townId)
  const rng = seededRng(seed)
  const dCat = computeDCat(rng)
  const nostalgia = pickNostalgia(rng, nostalgiaPool)
  return { weekIndex, townId, seed, dCat, nostalgia }
}

/**
 * Эффективный множитель спроса на конкретный продукт: D_cat его меты × ностальгия (§3.7).
 * Стэк мультипликативен; потолок эффективного спроса — `NOSTALGIA_EFFECTIVE_CAP` (2.6).
 */
export function effectiveDemand(dCat: number, nostalgiaMult = 1): number {
  const raw = dCat * nostalgiaMult
  return Math.min(raw, NOSTALGIA_EFFECTIVE_CAP)
}
