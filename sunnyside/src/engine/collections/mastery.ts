/**
 * engine/collections/mastery.ts — Recipe Box mastery-прогресс (17-collections §2.1/§3.1,
 * 06-recipes.md R18 §3.3). ЧИСТАЯ логика: считает текущую ★-звезду и модификаторы
 * времени/цены по счётчику «готовили N раз» (`timesCooked`).
 *
 * Источник истины по кривой — `RECIPE_MASTERY_CURVE` (`@/data/catalogs/recipes.ts`,
 * контент-каталог, уже прошедший ревью — числа НЕ дублируются/не переопределяются
 * здесь). Сервер инкрементит `timesCooked` при `craft_collect` (AGENTS.md §0.3 —
 * клиент не начисляет); эта система только читает счётчик и выводит производную.
 */

import { RECIPE_MASTERY_CURVE, type MasteryTier } from '@/data/catalogs/recipes'

/** Кривая отсортирована по возрастанию `requiredCrafts` — гарантия каталога (не проверяем на рантайме лишний раз в hot-path). */
const CURVE: readonly MasteryTier[] = RECIPE_MASTERY_CURVE

/** Текущий тир mastery по кумулятивному счётчику приготовлений. */
export function masteryTierFor(timesCooked: number): MasteryTier {
  const first = CURVE[0]
  if (!first) throw new Error('mastery.ts: RECIPE_MASTERY_CURVE пуст')
  let current: MasteryTier = first
  for (const tier of CURVE) {
    if (timesCooked >= tier.requiredCrafts) current = tier
    else break
  }
  return current
}

/** Следующий тир (или `null`, если уже ★★★★★ — максимум). */
export function nextMasteryTier(timesCooked: number): MasteryTier | null {
  const current = masteryTierFor(timesCooked)
  const idx = CURVE.findIndex((t) => t.stars === current.stars)
  return CURVE[idx + 1] ?? null
}

/** Сколько приготовлений осталось до следующей звезды (0, если максимум достигнут). */
export function craftsToNextStar(timesCooked: number): number {
  const next = nextMasteryTier(timesCooked)
  if (!next) return 0
  return Math.max(0, next.requiredCrafts - timesCooked)
}

export interface MasteryProgress {
  tier: MasteryTier
  next: MasteryTier | null
  craftsToNext: number
  /** 0..1, для прогресс-бара UI (1, если максимум). */
  fraction: number
}

/** Полная сводка для карточки рецепта (Recipe Box §2.1). */
export function masteryProgress(timesCooked: number): MasteryProgress {
  const tier = masteryTierFor(timesCooked)
  const next = nextMasteryTier(timesCooked)
  const craftsToNext = craftsToNextStar(timesCooked)
  if (!next) return { tier, next, craftsToNext, fraction: 1 }
  const span = next.requiredCrafts - tier.requiredCrafts
  const done = timesCooked - tier.requiredCrafts
  const fraction = span > 0 ? Math.min(1, Math.max(0, done / span)) : 1
  return { tier, next, craftsToNext, fraction }
}

/** Применяет модификаторы mastery к базовому времени готовки (сек) — для UI-предпросмотра. */
export function applyMasteryTime(baseCraftSec: number, timesCooked: number): number {
  const tier = masteryTierFor(timesCooked)
  return Math.max(0, baseCraftSec * (1 + tier.timeBonusPct / 100))
}

/** Применяет модификаторы mastery к базовой цене продажи — для UI-предпросмотра. */
export function applyMasteryPrice(basePrice: number, timesCooked: number): number {
  const tier = masteryTierFor(timesCooked)
  return Math.max(0, basePrice * (1 + tier.priceBonusPct / 100))
}

export { RECIPE_MASTERY_CURVE }
export type { MasteryTier }
