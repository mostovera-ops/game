/**
 * engine/econ — ЧИСТЫЕ эконом-формулы «econ-market» (14-economy). Ноль сети, ноль three,
 * детерминизм. Кривые цен, недельный спрос (сид week+town), эластичность S_sat,
 * ностальгия-бонусы, катч-ап Grand Opening, прайсинг Dimes, Farm Value.
 *
 * ВАЖНО (анти-чит): это ТОЛЬКО предсказание для UI («примерно $N», «продастся ≈N»),
 * НИКОГДА не источник начисления — сервер считает сам. Гейт покрытия ≥90% строк
 * (21-client §3.10, vite.config). Все числа — из спеки 14-economy (constants.ts).
 *
 * Экспортирует фабрику `createEconSystem()` (реализация `EconSystem` из contracts.ts) +
 * расширенный набор чистых функций рыночной логики.
 */

import type { EconSystem } from '@/engine/contracts'
import { dimeSpeedupCost } from './dimes'
import { farmValue } from './farmValue'
import { salePrice } from './pricing'
import { saturation } from './saturation'

// ── Ре-экспорт всей публичной поверхности модуля ──────────────────────────────
export * from './constants'
export * from './rng'
export * from './demand'
export * from './saturation'
export * from './dimes'
export * from './pricing'
export * from './grandOpening'
export * from './farmValue'
export * from './curve'
export * from './boostCaps'

/**
 * Фабрика системы (AGENTS.md §2 — «Экспортируй фабрику системы»). Возвращает объект,
 * реализующий контракт `EconSystem` из engine/contracts.ts. Богаче контракта (демоборд,
 * grand opening, sellRate …) доступно через прямые именованные экспорты выше.
 */
export function createEconSystem(): EconSystem {
  return { saturation, dimeSpeedupCost, salePrice, farmValue }
}

/** Готовый синглтон системы (для внедрения без вызова фабрики). */
export const econSystem: EconSystem = createEconSystem()
