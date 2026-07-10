/**
 * engine/econ/rng.ts — детерминированный ГПСЧ для недельного спроса (§3.6).
 *
 * Требование спеки: `seed = hash(week_number, town_id)` — одинаковый спрос для всего
 * города, разный по городам/неделям. Значит нужен ЧИСТЫЙ, воспроизводимый RNG без
 * `Math.random`. Реализация: FNV-1a хеш строки `${week}:${town}` → mulberry32.
 *
 * ГРАНИЦА: ноль сети/three. Полностью детерминирован от входа.
 */

/** FNV-1a 32-бит хеш строки → беззнаковое 32-битное число. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // h *= 16777619 (в 32-битной арифметике через сложение сдвигов)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Сид недели: `hash(week_number, town_id)` (§3.6). `townId` — произвольная строка/uuid.
 * Разные (week, town) → разные сиды; один и тот же вход → один сид (детерминизм).
 */
export function hashSeed(weekNumber: number, townId: string): number {
  return hashString(`${weekNumber}:${townId}`)
}

/** Источник равномерных чисел [0,1) + производные. */
export interface SeededRng {
  /** Следующее число в [0, 1). */
  next(): number
  /** Равномерно в [min, max). */
  uniform(min: number, max: number): number
  /** `n` уникальных элементов из массива (без повторов, детерминированно). */
  sample<T>(pool: readonly T[], n: number): T[]
}

/**
 * mulberry32 — быстрый детерминированный ГПСЧ с хорошим распределением на 32-битном сиде.
 */
export function seededRng(seed: number): SeededRng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const uniform = (min: number, max: number): number => min + (max - min) * next()
  const sample = <T>(pool: readonly T[], n: number): T[] => {
    const copy = pool.slice()
    const take = Math.max(0, Math.min(n, copy.length))
    const out: T[] = []
    for (let i = 0; i < take; i++) {
      const idx = Math.floor(next() * copy.length)
      out.push(copy[idx]!)
      copy.splice(idx, 1)
    }
    return out
  }
  return { next, uniform, sample }
}
