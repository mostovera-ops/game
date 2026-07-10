/**
 * engine/inventory/limits.ts — формулы ёмкости и апгрейда склада (02-farm §4.4, мастер).
 *
 * Cap(level)  = base + step · (level − 1)
 * Cost(level) = round(200 · 1.32^(level−1), −10); level 1 — старт, стоимость 0.
 *
 * Числа — ИЗ СПЕКИ (docs/specs/02-farm.md §4.4), не выдуманы:
 *   Silo:     base=500,  step=280  (Ур.1..10 → 500/780/1060/…/3020)
 *   Icehouse: base=200,  step=140  (Ур.1..10 → 200/340/480/…/1460)
 *   Upgrade:  base=200, growth=1.32, округление до десятка (round(x, −10))
 *             (Ур.2..10 → 260/350/460/610/800/1060/1400/1840/2430)
 *
 * ГРАНИЦА: ноль three/react/net — чистые функции, node-тестируемо.
 */

const SILO_BASE = 500
const SILO_STEP = 280
const ICEHOUSE_BASE = 200
const ICEHOUSE_STEP = 140

const UPGRADE_BASE_COST = 200
const UPGRADE_GROWTH = 1.32

/** round(x, −10) — округление до ближайшего десятка (§4.4 «round(…, −10)»). */
export function roundToTen(x: number): number {
  return Math.round(x / 10) * 10
}

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`inventory/limits: уровень склада должен быть целым ≥1, получено ${level}`)
  }
}

/** Ёмкость Силоса на уровне `level` (§4.4, base=500, step=280). */
export function siloCapacity(level: number): number {
  assertLevel(level)
  return SILO_BASE + SILO_STEP * (level - 1)
}

/** Ёмкость Ледника на уровне `level` (§4.4, base=200, step=140). */
export function icehouseCapacity(level: number): number {
  assertLevel(level)
  return ICEHOUSE_BASE + ICEHOUSE_STEP * (level - 1)
}

/**
 * Стоимость апгрейда склада ДО уровня `level` (§4.4: round(200·1.32^(level−1), −10)).
 * Один и тот же вход применим к Silo и Icehouse — формула апгрейда в спеке не различает
 * здание, только уровень (§4.4 — единая таблица «Стоимость апгрейда»).
 * Уровень 1 — стартовый (бесплатный).
 */
export function storageUpgradeCost(level: number): number {
  assertLevel(level)
  if (level === 1) return 0
  return roundToTen(UPGRADE_BASE_COST * Math.pow(UPGRADE_GROWTH, level - 1))
}
