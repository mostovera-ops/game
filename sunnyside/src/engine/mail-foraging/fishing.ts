/**
 * engine/mail-foraging/fishing.ts — чистая логика мини-игры рыбалки (Fishing Spot,
 * 08-mail-foraging §3.2.4, BACKLOG BL-1). Catch Bar: маркер осциллирует треугольной волной
 * по полосе `[0,1]`, игрок жмёт «Тяни!» в момент прохода — попадание, если маркер внутри
 * зелёной зоны, центрированной на середине полосы. 3 попытки на заброс (`FISHING_ATTEMPTS_
 * PER_CAST`), результат — по числу попаданий.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net/state — чистые функции, node-тестируемо.
 * Таймеры/DOM/клики — в `ui/fishing/FishingQte.tsx` (эта панель — контекстный оверлей,
 * зовёт только функции отсюда).
 *
 * АНТИ-ЧИТ (РЕШЕНИЕ, документируется по требованию задачи fishing-qte): спека (§3.2.4 п.5)
 * описывает ДЕТЕРМИНИРОВАННОЕ соответствие «число попаданий → редкость» (0→Common,
 * 1→Good, 2–3→Prime) — это годится как читаемое ПРАВИЛО ДИЗАЙНА для UI/тултипа
 * (`rarityByHitsHypothesis`), но НЕ как источник истины начисления: `hits` считает и
 * присылает клиент, а честно проверить на сервере, что игрок ДЕЙСТВИТЕЛЬНО поймал тайминг
 * (а не подставил число), невозможно — сервер не видит кадров анимации, только итоговое
 * число. Формула AGENTS.md §0.3 «клиент не считает награду сам» здесь решена так: `hits`
 * используется ТОЛЬКО как вероятностный МОДИФИКАТОР (`rollCatchRarity`/`CATCH_ODDS_BY_HITS`)
 * — больше попаданий двигает шансы в пользу Good/Prime, но не гарантирует их; финальный
 * бросок ВСЕГДА делает вызывающий (adapter local/supabase — тот же контракт, что и everywhere
 * else в игре: истина после ответа адаптера, не оптимистичное клиентское число). Legend Fish
 * (`rollLegendFish`) — независимый ролл 2%, не подменяется/не блокируется основным уловом
 * (§3.2.4 п.5), тоже целиком на стороне вызывающего (сервер/local, не эта чистая функция —
 * она принимает `rng` инъекцией для детерминированных тестов и симметрии local↔supabase).
 */

import {
  CATCH_BAR_GREEN_ZONE_WIDTH_BASE,
  CATCH_RARITY_BY_HITS,
  FISHING_ATTEMPTS_PER_CAST,
  FISHING_ROD_ZONE_BONUS,
  LEGEND_FISH_CHANCE,
  type CatchRarity,
} from './constants'

export type { CatchRarity }

/** Генератор случайного числа в `[0,1)` — по умолчанию `Math.random`, инъекция для тестов. */
export type Rng = () => number

// ── Catch Bar: чистая математика маркера/попадания ──────────────────────────────────

/** Ширина зелёной зоны с бонусом удочки (§3.2.7), зажата в `(0,1]`. Неизвестный/отрицательный
 *  `rodTier` → базовая ширина (Bamboo, без бонуса) — не даём чужому мусорному индексу сломать
 *  мини-игру (P3, тёплый фолбэк, не исключение). */
export function greenZoneWidth(rodTier: number): number {
  const bonus = Number.isFinite(rodTier) ? (FISHING_ROD_ZONE_BONUS[rodTier] ?? 0) : 0
  return Math.min(1, CATCH_BAR_GREEN_ZONE_WIDTH_BASE + bonus)
}

/**
 * Позиция маркера Catch Bar в `[0,1]` в момент `elapsedMs` от начала прохода — треугольная
 * волна периодом `periodMs` (§3.2.4 п.3 — интервал прохода ~1.2с, гипотеза, `periodMs`
 * default 1200): растёт 0→1 первую половину периода, падает 1→0 вторую.
 */
export function catchBarMarkerPosition(elapsedMs: number, periodMs = 1200): number {
  if (periodMs <= 0) return 0
  const t = ((elapsedMs % periodMs) + periodMs) % periodMs
  const half = periodMs / 2
  return t < half ? t / half : 2 - t / half
}

/** Попадание: маркер внутри зелёной зоны, центрированной на середине полосы (0.5). */
export function isHit(markerPos: number, zoneWidth: number): boolean {
  const half = zoneWidth / 2
  return markerPos >= 0.5 - half && markerPos <= 0.5 + half
}

// ── Редкость по числу попаданий ──────────────────────────────────────────────────────

/** Кламп `hits` в валидный диапазон попыток `[0, FISHING_ATTEMPTS_PER_CAST]` (защита от
 *  мусорного/отрицательного/дробного клиентского значения — используется и local, и
 *  (гипотетически) серверной валидацией p_hits). */
export function clampHits(hits: number): number {
  if (!Number.isFinite(hits)) return 0
  return Math.max(0, Math.min(FISHING_ATTEMPTS_PER_CAST, Math.round(hits)))
}

/**
 * Спека §3.2.4 п.5 — ДЕТЕРМИНИРОВАННОЕ «что видит дизайнер»: 0→common, 1→good, 2–3→prime.
 * Используется как читаемая подсказка UI ("почти поймал(а) Prime!") и опорная точка тестов
 * `hitsToOdds` ниже — НЕ вызывается напрямую для начисления награды (см. докстринг файла).
 */
export function rarityByHitsHypothesis(hits: number): CatchRarity {
  const clamped = clampHits(hits)
  return CATCH_RARITY_BY_HITS[clamped] ?? 'common'
}

/** Вероятности исхода (common/good/prime, без учёта Legend) по числу попаданий — АНТИ-ЧИТ
 *  модификатор (см. докстринг файла), калибровка не из спеки (спека даёт только
 *  детерминированный маппинг) — реализационная гипотеза, помечена явно, подлежит
 *  калибровке вместе с `14-economy.md`, как и остальные проценты этого модуля. Растёт к
 *  Good/Prime с числом попаданий, никогда не даёт 100% гарантии ни одного исхода. */
export const CATCH_ODDS_BY_HITS: Record<number, { common: number; good: number; prime: number }> = {
  0: { common: 0.70, good: 0.25, prime: 0.05 },
  1: { common: 0.40, good: 0.45, prime: 0.15 },
  2: { common: 0.15, good: 0.45, prime: 0.40 },
  3: { common: 0.05, good: 0.25, prime: 0.70 },
}

/**
 * Бросок редкости по `hits` (АНТИ-ЧИТ модификатор, не гарантия — см. докстринг файла).
 * `rng()` вызывается один раз, детерминированно мапится на `common`/`good`/`prime` по
 * кумулятивным порогам `CATCH_ODDS_BY_HITS[clampHits(hits)]`.
 */
export function rollCatchRarity(hits: number, rng: Rng = Math.random): CatchRarity {
  const odds = CATCH_ODDS_BY_HITS[clampHits(hits)] ?? CATCH_ODDS_BY_HITS[0]!
  const roll = rng()
  if (roll < odds.common) return 'common'
  if (roll < odds.common + odds.good) return 'good'
  return 'prime'
}

/** Независимый ролл Legend Fish (§3.2.4 п.5) — 2% (`LEGEND_FISH_CHANCE`), не зависит от
 *  `hits`/тайминга: чистая удача, косметический трофей. */
export function rollLegendFish(rng: Rng = Math.random): boolean {
  return rng() < LEGEND_FISH_CHANCE
}

/** Итог одного заброса (`FishCatch`-совместимая форма без `itemKey` — тот подставляет
 *  вызывающий из каталога ингредиентов). Legend Fish подменяет обычный улов целиком
 *  (§3.2.4 п.5 — «вместо», не поверх). */
export interface FishCastOutcome {
  rarity: CatchRarity | 'legendary'
  legend: boolean
}

/**
 * Полный ролл заброса: независимый Legend-ролл первым (подменяет исход при срабатывании),
 * иначе — `rollCatchRarity` по `hits`. Один и тот же `rng` не переиспользуется между
 * роллами (Legend и redkость — независимые события, §3.2.4 п.5) — вызывающий передаёт
 * функцию, которая при каждом вызове возвращает новое случайное число (как `Math.random`).
 */
export function resolveFishCast(hits: number, rng: Rng = Math.random): FishCastOutcome {
  if (rollLegendFish(rng)) return { rarity: 'legendary', legend: true }
  return { rarity: rollCatchRarity(hits, rng), legend: false }
}
