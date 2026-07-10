/**
 * engine/animals/formulas.ts — ЧИСТЫЕ формулы системы животных (docs/specs/03-animals.md).
 *
 * Ноль сети, ноль three, ноль доступа к store — детерминированные функции числа→число.
 * Используются и системой (`./system.ts`), и UI (для мгновенного предсказания «текущий тир
 * до сбора», §3.5) — но НИКОГДА не источник начисления (анти-чит, AGENTS.md §0.3): сервер
 * реконструирует qualityTier/продукт сам, эти функции — только зеркало для клиента.
 *
 * Числа — из спеки (не выдуманы):
 * - §3.2 / §3.2.2 — вторичный шанс дропа по видам.
 * - §3.3 / §4.2 — привязанность → очки → звёзды → тир качества.
 * - §3.5 — 4 тира качества и множитель цены.
 * - §4.4 — Storage Cap (Sleepy Pen) по видам.
 * - §4.5 — вклад животного в Farm Value.
 */

import type { AnimalKind } from '@/types/animals'
import type { Quality, Tier } from '@/types/common'

// ════════════════════════════════════════════════════════════════════════════
// Тир качества (1..4) — квартет из §3.5. Не путать с `Quality` (1..5, общий тип
// для крафта/мастерства) — животные используют только 4 ступени этой спеки.
// ════════════════════════════════════════════════════════════════════════════
export type AnimalQualityTier = 1 | 2 | 3 | 4

/** §3.5: множитель цены продукта по тиру качества. */
export const QUALITY_PRICE_MULTIPLIER: Record<AnimalQualityTier, number> = {
  1: 1.0, // Common
  2: 1.3, // Good
  3: 1.7, // Prime
  4: 2.5, // Blue Ribbon
}

// ════════════════════════════════════════════════════════════════════════════
// Привязанность (§3.3, формула §4.2)
// ════════════════════════════════════════════════════════════════════════════

/** Очки за своевременное кормление (гипотеза §4.2). */
export const TIMELY_FEED_POINTS = 2
/** Очки за подкормку любимым кормом (разово, §3.3). */
export const FAVORITE_FEED_BONUS_POINTS = 5
/** Очки за подарок с Toy Shelf (разово, максимум 1/неделю/животное, §3.3). */
export const GIFT_POINTS = 10
/** 100 очков = 1★ (гипотеза, §4.2). */
export const POINTS_PER_STAR = 100

export interface AffectionEvents {
  timelyFeeds?: number
  favoriteFeedBonuses?: number
  gifts?: number
}

/** Σ очков привязанности (§4.2, `affection_points(t)`). Нет верхнего клампа — клампится в звезду. */
export function affectionPoints(events: AffectionEvents): number {
  const { timelyFeeds = 0, favoriteFeedBonuses = 0, gifts = 0 } = events
  return (
    Math.max(0, timelyFeeds) * TIMELY_FEED_POINTS +
    Math.max(0, favoriteFeedBonuses) * FAVORITE_FEED_BONUS_POINTS +
    Math.max(0, gifts) * GIFT_POINTS
  )
}

/**
 * Звезда привязанности 1..5 (§4.2: `clamp(floor(points/100), 1, 5)`).
 * Привязанность никогда не падает (P3) — вызывающая сторона обязана монотонно
 * накапливать `points`, эта функция сама по себе не хранит состояние.
 */
export function affectionStar(points: number): 1 | 2 | 3 | 4 | 5 {
  const star = Math.floor(Math.max(0, points) / POINTS_PER_STAR)
  return Math.min(5, Math.max(1, star)) as 1 | 2 | 3 | 4 | 5
}

export interface QualityTierInput {
  affectionStar: 1 | 2 | 3 | 4 | 5
  /** Уровень жилья (1..10, `13-progression.md` мастер-рамка). */
  housingLevel: number
  /** Field-стафф назначен на группу жилья этого животного (§3.6). */
  staffAssignedToGroup?: boolean
}

/**
 * Тир качества продукта (§4.2, дословная формула — условия ИЛИ, не аддитивные термы):
 * Blue Ribbon требует ОБА максимума одновременно, остальные тиры — любое из условий.
 */
export function qualityTier({ affectionStar: star, housingLevel, staffAssignedToGroup }: QualityTierInput): AnimalQualityTier {
  if (star >= 5 && housingLevel >= 10) return 4
  if (star >= 4 || housingLevel >= 4 || staffAssignedToGroup) return 3
  if (star >= 2 || housingLevel >= 2) return 2
  return 1
}

/** Цена продукта с учётом тира качества (§3.5). */
export function qualityAdjustedPrice(basePrice: number, tier: AnimalQualityTier): number {
  return basePrice * QUALITY_PRICE_MULTIPLIER[tier]
}

// ════════════════════════════════════════════════════════════════════════════
// Вторичный продукт (§3.2 таблица + §3.3 веха 2★ +5%)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Базовый шанс вторичного дропа по виду (§3.2 таблица «Вторичный продукт»).
 * `sheep` не описан в 03-animals.md (расхождение контракта AnimalKind vs спеки,
 * см. TODO(architecture) в `data/catalogs/animals.ts`) — 0 как безопасный дефолт,
 * не выдумка числа, до решения архитектуры.
 */
export const SECONDARY_DROP_BASE_CHANCE: Record<AnimalKind, number> = {
  chicken: 0.08, // Feather
  cow: 0, // молоко не имеет прямого вторичного дропа — масло/сыр крафтятся на кухне
  pig: 0.15, // Lard
  bee: 0.2, // Beeswax
  goat: 0.1, // Chèvre Curd
  sheep: 0, // TODO(architecture): нет в спеке, см. data/catalogs/animals.ts
}

/** +5% к шансу вторичного продукта при привязанности 2★+ (§3.3 таблица вех). */
export const AFFECTION_SECONDARY_BONUS_AT_2_STAR = 0.05

/** Итоговый шанс вторичного дропа: базовый по виду + бонус привязанности 2★+. */
export function secondaryDropChance(kind: AnimalKind, star: 1 | 2 | 3 | 4 | 5): number {
  const base = SECONDARY_DROP_BASE_CHANCE[kind]
  return base + (star >= 2 ? AFFECTION_SECONDARY_BONUS_AT_2_STAR : 0)
}

// ════════════════════════════════════════════════════════════════════════════
// Storage Cap / Sleepy Pen (§4.4)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Порог склада (штук до Sleepy Pen), §4.4. `sheep` не в спеке — используется тот же
 * безопасный дефолт (4, как у goat/bee — консервативная оценка), см. TODO выше.
 */
export const STORAGE_CAP: Record<AnimalKind, number> = {
  chicken: 12,
  cow: 6,
  pig: 5,
  bee: 4,
  goat: 4,
  sheep: 4, // TODO(architecture): нет в спеке, см. data/catalogs/animals.ts
}

/** Животное уходит в Sleepy Pen, когда несобранный запас достиг капа (§4.4, без наказания — не падает, просто пауза). */
export function isSleepyPen(pendingQty: number, kind: AnimalKind): boolean {
  return pendingQty >= STORAGE_CAP[kind]
}

// ════════════════════════════════════════════════════════════════════════════
// Цикл кормления (§3.2) — housing/staff бонусы к скорости считаются вне этой
// системы (владение постройками/стаффом — `13-progression.md`, не моя зона);
// эта функция принимает уже готовый суммарный % сокращения цикла.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Эффективная длительность цикла в мс: `baseCycleMin` из каталога (03-animals §4.1),
 * `reductionPct` — суммарный бонус жилья/стаффа (0..1, например 0.15 = −15% Clara §3.6).
 * Клампится снизу на 20% исходной длительности — защита от отрицательного/нулевого таймера.
 */
export function effectiveCycleMs(baseCycleMin: number, reductionPct = 0): number {
  const clampedReduction = Math.min(0.8, Math.max(0, reductionPct))
  return Math.round(baseCycleMin * 60_000 * (1 - clampedReduction))
}

// ════════════════════════════════════════════════════════════════════════════
// Farm Value вклад животного (§4.5 — эта спека источник истины для терма)
// ════════════════════════════════════════════════════════════════════════════

/** §4.5: `base_fv(species_tier)`. Спека определяет T1..T4; T5 не описан — используем T4 как дефолт (нет данных, не выдумка выше макс. тира). */
export const BASE_FV_BY_TIER: Record<Tier, number> = {
  1: 15,
  2: 35,
  3: 60,
  4: 100,
  5: 100, // TODO: спека 03-animals §4.5 не определяет T5; экстраполяция не введена намеренно
}

/** §4.5: `housing_quality_mult` — 1.0 (1–3) / 1.1 (4–6) / 1.2 (7–10). */
export function housingQualityMult(housingLevel: number): number {
  if (housingLevel >= 7) return 1.2
  if (housingLevel >= 4) return 1.1
  return 1.0
}

/** §4.5: `animal_fv(animal) = base_fv(tier) × (1 + 0.15 × affection_star) × housing_quality_mult`. */
export function animalFarmValue(tier: Tier, star: 1 | 2 | 3 | 4 | 5, housingLevel: number): number {
  return BASE_FV_BY_TIER[tier] * (1 + 0.15 * star) * housingQualityMult(housingLevel)
}

/** Утилита: пересчёт общего Quality (1..5, ingest-совместимый тип) из 4-ступенчатого AnimalQualityTier — 1:1 маппинг для интеграции с CollectedItem.quality (rpc.ts). */
export function toIngestQuality(tier: AnimalQualityTier): Quality {
  return tier as Quality
}
