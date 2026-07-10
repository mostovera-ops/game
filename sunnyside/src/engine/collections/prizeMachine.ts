/**
 * engine/collections/prizeMachine.ts — Prize Machine ЧИСТАЯ логика (17-collections.md
 * §3.4, мастер-числа `15-monetization.md` §3.3, DECISIONS-B K2 — только числа,
 * реализация pity здесь принадлежит нашей зоне владения — collections).
 *
 * АНТИ-ЧИТ (AGENTS.md §0.3): этот модуль НЕ является источником истины при реальном
 * пулле — сервер считает pity/дроп и возвращает `PrizePullOutcome` через
 * `BackendAdapter.prizePull`. Этот код служит:
 *  (а) детерминированному предпросмотру UI/анимации ("что примерно выпадет"),
 *  (б) серверной реализации той же формулы (общий модуль, если сервер — тоже TS),
 *  (в) юнит-тестам на 10k симуляций (pity гарантии, AGENTS.md §4 требование задачи).
 *
 * Дроп-шансы (17-collections §3.4 таблица, ссылка на 15-monetization §3.3):
 *   Common 68% · Uncommon 24% · Rare 6.5% · Chase 1.5%.
 * Открытый pity (счётчик виден игроку постоянно — гардрейл канона §4, «никакого
 * скрытого RNG-давления»):
 *   - Rare: гарантия Rare ИЛИ ЛУЧШЕ (т.е. Rare/Chase) каждые ≤10 пуллов без Rare+.
 *   - Chase: гарантия Chase на ≤40-м пулле без Chase.
 *   - Pity НЕ переносится между сериями — счётчик per-series (17-collections §3.4).
 *
 * C4 (17-collections.md Edge cases): если оба pity триггерятся одновременно
 * (счётчик Rare и Chase оба достигли капа на одном пулле — возможно только если
 * ни Rare, ни Chase не выпадали 40 пуллов подряд), приоритет — Chase (он
 * закрывает условие «Rare+» тоже), оба счётчика обнуляются.
 */

import type { PrizeRarity, PrizePity } from '@/types/monetization'
import type { ToySeriesKey } from '@/types/collections'
import { toys } from '@/data/catalogs/toys'
import type { ToyDef } from '@/data/schema'

/** Дроп-шансы за пулл (17-collections §3.4 / 15-monetization §3.3). Сумма = 1. */
export const DROP_RATES: Readonly<Record<PrizeRarity, number>> = {
  common: 0.68,
  uncommon: 0.24,
  rare: 0.065,
  chase: 0.015,
} as const

export const PITY_RARE_CAP = 10
export const PITY_CHASE_CAP = 40

/** Детерминированный ГПСЧ (Result может быть заменён на серверный source of truth). */
export type Rng = () => number // ∈ [0, 1)

/** Начальный pity нулевого игрока для данной серии. */
export function initialPity(series: ToySeriesKey): PrizePity {
  return { series, pullsSinceRare: 0, pullsSinceChase: 0, rareCap: PITY_RARE_CAP, chaseCap: PITY_CHASE_CAP }
}

/** Роллит редкость по кумулятивным порогам `DROP_RATES` (без учёта pity). */
export function rollRarity(rng: Rng): PrizeRarity {
  const r = rng()
  const cCommon = DROP_RATES.common
  const cUncommon = cCommon + DROP_RATES.uncommon
  const cRare = cUncommon + DROP_RATES.rare
  if (r < cCommon) return 'common'
  if (r < cUncommon) return 'uncommon'
  if (r < cRare) return 'rare'
  return 'chase'
}

export interface PitySingleResult {
  rarity: PrizeRarity
  /** Pity форсировал исход (а не честный ролл) — для UI-подсветки «гарантия сработала». */
  forcedBy: 'chase' | 'rare' | null
  pityAfter: PrizePity
}

/** Один пулл с учётом открытого pity (см. докстринг файла — приоритет Chase, C4). */
export function pullOnce(pity: PrizePity, rng: Rng): PitySingleResult {
  const pullsSinceRare = pity.pullsSinceRare + 1
  const pullsSinceChase = pity.pullsSinceChase + 1

  const chaseForced = pullsSinceChase >= pity.chaseCap
  const rareForced = !chaseForced && pullsSinceRare >= pity.rareCap

  let rarity: PrizeRarity
  let forcedBy: 'chase' | 'rare' | null
  if (chaseForced) {
    rarity = 'chase'
    forcedBy = 'chase'
  } else if (rareForced) {
    rarity = 'rare'
    forcedBy = 'rare'
  } else {
    rarity = rollRarity(rng)
    forcedBy = null
  }

  // Chase удовлетворяет условию «Rare+» тоже — сбрасывает оба счётчика.
  const nextPullsSinceRare = rarity === 'rare' || rarity === 'chase' ? 0 : pullsSinceRare
  const nextPullsSinceChase = rarity === 'chase' ? 0 : pullsSinceChase

  return {
    rarity,
    forcedBy,
    pityAfter: { ...pity, pullsSinceRare: nextPullsSinceRare, pullsSinceChase: nextPullsSinceChase },
  }
}

const toysBySeriesRarity = new Map<string, ToyDef[]>()
for (const toy of toys as ToyDef[]) {
  const k = `${toy.series}:${toy.rarity}`
  const list = toysBySeriesRarity.get(k)
  if (list) list.push(toy)
  else toysBySeriesRarity.set(k, [toy])
}

/** Фигурки данной серии+редкости (каталог `@/data/catalogs/toys.ts`, 8/серию, 4 редкости). */
export function toysOf(series: ToySeriesKey, rarity: PrizeRarity): ToyDef[] {
  return toysBySeriesRarity.get(`${series}:${rarity}`) ?? []
}

/** Выбирает конкретную фигурку данной редкости в серии равновероятно. */
export function pickToy(series: ToySeriesKey, rarity: PrizeRarity, rng: Rng): ToyDef {
  const pool = toysOf(series, rarity)
  if (pool.length === 0) throw new Error(`prizeMachine: нет фигурок ${rarity} в серии ${series} (каталог toys.ts)`)
  const idx = Math.floor(rng() * pool.length) % pool.length
  const toy = pool[idx]
  if (!toy) throw new Error(`prizeMachine: индекс ${idx} вне диапазона пула ${series}/${rarity}`)
  return toy
}

export interface PrizePullResultItem {
  toyKey: string
  rarity: PrizeRarity
  duplicate: boolean
}

export interface PrizePullSimOutcome {
  results: PrizePullResultItem[]
  pityAfter: PrizePity
}

/**
 * Симулирует `count` пуллов подряд для серии, обновляя pity и учитывая дубликаты
 * относительно уже имеющихся у игрока фигурок (`ownedToyKeys`) + дублей внутри
 * самого батча. Чистая функция — вызывается и клиентом (превью), и тестами.
 */
export function simulatePulls(
  pity: PrizePity,
  count: number,
  rng: Rng,
  ownedToyKeys: ReadonlySet<string> = new Set(),
): PrizePullSimOutcome {
  let current = pity
  const seenThisBatch = new Set<string>()
  const results: PrizePullResultItem[] = []
  for (let i = 0; i < count; i++) {
    const step = pullOnce(current, rng)
    current = step.pityAfter
    const toy = pickToy(pity.series, step.rarity, rng)
    const duplicate = ownedToyKeys.has(toy.key) || seenThisBatch.has(toy.key)
    seenThisBatch.add(toy.key)
    results.push({ toyKey: toy.key, rarity: step.rarity, duplicate })
  }
  return { results, pityAfter: current }
}
