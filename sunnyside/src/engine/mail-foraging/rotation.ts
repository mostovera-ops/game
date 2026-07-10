/**
 * engine/mail-foraging/rotation.ts — ДВИЖОК недельной ротации Каталога почтой
 * (08-mail-foraging §3.1.2/§3.1.6). Чистая детерминированная функция: одна и та же
 * неделя → одна и та же витрина для всех игроков Города (единая ротация на Town,
 * не персональная, §3.1.2). Никакого рантайм-состояния, ноль RNG-из-Date.
 *
 * Правила выборки (§3.1.6), реализованные здесь:
 *   • 12 позиций: 5 rare_seeds / 4 decor / 3 tools (`CATALOG_POSITIONS_BY_CATEGORY`).
 *   • anti-repeat: позиция прошлой недели не повторяется (кулдаун ≥1 неделя) —
 *     при нехватке кандидатов правило мягко отступает (иначе пул пуст).
 *   • гарантия тиров rare_seeds: ≥1 T3 и ≥1 T4–T5 (`RARE_SEEDS_MIN_*`).
 *   • Last Call: 2 позиции недели помечаются флагом (таймер 48ч UI считает от `weekEnd`).
 *
 * Детерминизм — от абсолютного индекса недели (`weekNumberOf`, тот же якорь Пн 00:00
 * UTC, что и календарь), а не от локальных часов клиента (21-client §3.6).
 *
 * ГРАНИЦА (AGENTS.md §3): импортирует только `@/types` + собственные константы/пул +
 * чистый календарь недель. Ноль three/react/net/state.
 */

import type { EpochMs } from '@/types'
import { weekNumberOf, weekStartOfIndex } from '@/engine/clock'
import {
  CATALOG_POSITIONS_TOTAL,
  CATALOG_POSITIONS_BY_CATEGORY,
  RARE_SEEDS_MIN_T3,
  RARE_SEEDS_MIN_T4_T5,
  LAST_CALL_POSITIONS,
  type CatalogCategory,
} from './constants'
import { MAIL_CATALOG_POOL, type MailCatalogItem } from './pool'

/** Одна позиция витрины недели. `slot` — 0..11 (порядок плитки 4×3 UI, §3.1.7). */
export interface CatalogPosition {
  slot: number
  item: MailCatalogItem
  /** «Last Call» (§3.1.2): UI рисует обратный отсчёт в последние 48ч недели. */
  lastCall: boolean
}

/** Полная недельная витрина (12 позиций) + границы недельного окна. */
export interface WeeklyCatalog {
  weekIndex: number
  weekStart: EpochMs
  /** Конец недели = начало следующей (эксклюзивная граница окна заказов/Last Call). */
  weekEnd: EpochMs
  positions: CatalogPosition[]
}

// ── Детерминированный PRNG (mulberry32) от целочисленного сида ────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Сид ротации: индекс недели + смещение категории (разные потоки на категорию). */
function seedFor(weekIndex: number, salt: number): number {
  // xmur3-подобное перемешивание, чтобы соседние недели не давали похожих потоков.
  let h = 2166136261 ^ (weekIndex * 0x9e3779b1) ^ (salt * 0x85ebca77)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

/** Детерминированный Fisher–Yates (не мутирует вход). */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

const CATEGORY_SALT: Record<CatalogCategory, number> = { rare_seeds: 1, decor: 2, tools: 3 }

/**
 * Выборка позиций одной категории: anti-repeat (кулдаун ≥1 неделя) + добор из полного
 * пула при нехватке кандидатов. Возвращает ровно `count` позиций (пул заведомо шире).
 */
function pickCategory(
  category: CatalogCategory,
  count: number,
  prevKeys: ReadonlySet<string>,
  rng: () => number,
): MailCatalogItem[] {
  const all = MAIL_CATALOG_POOL.filter((it) => it.category === category)
  const fresh = all.filter((it) => !prevKeys.has(it.key))
  // Anti-repeat приоритетен: сначала «свежие», хвостом — на прошлой неделе показанные.
  const ordered = [...shuffle(fresh, rng), ...shuffle(all.filter((it) => prevKeys.has(it.key)), rng)]
  return ordered.slice(0, count)
}

/**
 * Гарантия тиров rare_seeds (§3.1.6): среди выбранных ≥`minT3` T3 и ≥`minHigh` T4–T5.
 * Если не хватает — подменяем «лишние» позиции кандидатами нужного тира из полного пула.
 */
function ensureRareTiers(
  picked: MailCatalogItem[],
  prevKeys: ReadonlySet<string>,
  rng: () => number,
): MailCatalogItem[] {
  const result = picked.slice()
  const rarePool = MAIL_CATALOG_POOL.filter((it) => it.category === 'rare_seeds')

  const need = (pred: (t: MailCatalogItem) => boolean, min: number): void => {
    let have = result.filter(pred).length
    while (have < min) {
      // Кандидат нужного тира, ещё не в выборке. Anti-repeat — мягкий (сперва свежие).
      const candidates = rarePool.filter((it) => pred(it) && !result.some((r) => r.key === it.key))
      if (candidates.length === 0) break
      const fresh = candidates.filter((it) => !prevKeys.has(it.key))
      const pool = fresh.length > 0 ? fresh : candidates
      const add = shuffle(pool, rng)[0]!
      // Выкинуть «лишнюю» позицию, НЕ нарушая уже удовлетворённые гарантии.
      const dropIdx = result.findIndex(
        (r) => !pred(r) && !isEssential(result, r),
      )
      const idx = dropIdx >= 0 ? dropIdx : result.length - 1
      result[idx] = add
      have = result.filter(pred).length
    }
  }

  const isT3 = (t: MailCatalogItem) => t.tier === 3
  const isHigh = (t: MailCatalogItem) => t.tier === 4 || t.tier === 5
  // Позиция «незаменима», если её удаление сломало бы ДРУГУЮ уже выполненную гарантию.
  function isEssential(list: MailCatalogItem[], item: MailCatalogItem): boolean {
    if (isT3(item) && list.filter(isT3).length <= RARE_SEEDS_MIN_T3) return true
    if (isHigh(item) && list.filter(isHigh).length <= RARE_SEEDS_MIN_T4_T5) return true
    return false
  }

  need(isT3, RARE_SEEDS_MIN_T3)
  need(isHigh, RARE_SEEDS_MIN_T4_T5)
  return result
}

/**
 * Построить недельную витрину. `prevKeys` — ключи позиций ПРОШЛОЙ недели (для anti-repeat);
 * пустой массив = ограничение снято (первая неделя/тест).
 */
export function buildWeeklyCatalog(weekIndex: number, prevKeys: readonly string[] = []): WeeklyCatalog {
  const prev = new Set(prevKeys)

  let rare = pickCategory('rare_seeds', CATALOG_POSITIONS_BY_CATEGORY.rare_seeds, prev, mulberry32(seedFor(weekIndex, CATEGORY_SALT.rare_seeds)))
  rare = ensureRareTiers(rare, prev, mulberry32(seedFor(weekIndex, CATEGORY_SALT.rare_seeds + 100)))
  const decor = pickCategory('decor', CATALOG_POSITIONS_BY_CATEGORY.decor, prev, mulberry32(seedFor(weekIndex, CATEGORY_SALT.decor)))
  const tools = pickCategory('tools', CATALOG_POSITIONS_BY_CATEGORY.tools, prev, mulberry32(seedFor(weekIndex, CATEGORY_SALT.tools)))

  // Порядок плитки (§3.1.7): по категориям — rare_seeds, decor, tools.
  const items = [...rare, ...decor, ...tools].slice(0, CATALOG_POSITIONS_TOTAL)

  // 2 позиции Last Call — детерминированный выбор слотов недели.
  const lastCallRng = mulberry32(seedFor(weekIndex, 999))
  const lastCallSlots = new Set(
    shuffle(
      items.map((_, i) => i),
      lastCallRng,
    ).slice(0, LAST_CALL_POSITIONS),
  )

  const positions: CatalogPosition[] = items.map((item, slot) => ({
    slot,
    item,
    lastCall: lastCallSlots.has(slot),
  }))

  return {
    weekIndex,
    weekStart: weekStartOfIndex(weekIndex),
    weekEnd: weekStartOfIndex(weekIndex + 1),
    positions,
  }
}

/**
 * Витрина, актуальная на момент `now`. Anti-repeat берётся против ПРОШЛОЙ недели,
 * посчитанной с пустым `prevKeys` (детерминированно, без бесконечной рекурсии).
 */
export function catalogAt(now: EpochMs): WeeklyCatalog {
  const wk = weekNumberOf(now)
  const prevKeys = buildWeeklyCatalog(wk - 1).positions.map((p) => p.item.key)
  return buildWeeklyCatalog(wk, prevKeys)
}
