/**
 * engine/progression/xp.ts — кривая XP уровня фермы 1–60 (13-progression §3.5.1/§4.6).
 *
 * Мастер-формула: `XP_to_next(L) = round(80 × L^1.8)` — XP для перехода с L на L+1.
 * `Cumulative(L) = Σ_{i=1..L−1} XP_to_next(i)` — накоплено к началу уровня L.
 * Кап L=60 (§3.5.1): на капе XP_to_next=0, лишний XP не даёт уровней (P6 —
 * конвертация в bucks-бонус считается серверно, не здесь).
 *
 * ВАЖНО (анти-чит, AGENTS.md §0.3): это ТОЛЬКО предсказание/отображение для UI
 * (полоса XP, «до след. уровня»), НИКОГДА не источник начисления — серверная истина.
 *
 * ГРАНИЦА: чистые детерминированные функции, ноль сети/three.
 */

import { FARM_LEVEL_CAP, XP_CURVE_BASE, XP_CURVE_EXPONENT } from './constants'

/**
 * XP для перехода с уровня `level` на `level+1` (§3.5.1). На капе (level ≥ 60) — 0.
 * Некорректный уровень (< 1) трактуется как 1 (защита границы, не бросает).
 */
export function xpToNext(level: number): number {
  const L = Math.max(1, Math.floor(level))
  if (L >= FARM_LEVEL_CAP) return 0
  return Math.round(XP_CURVE_BASE * Math.pow(L, XP_CURVE_EXPONENT))
}

/**
 * Накопленный XP к НАЧАЛУ уровня `level` (сумма стоимостей всех предыдущих переходов).
 * `cumulativeXp(1) = 0`. Для `level > cap` — как для капа (переходов сверх 60 нет).
 */
export function cumulativeXp(level: number): number {
  const L = Math.min(FARM_LEVEL_CAP, Math.max(1, Math.floor(level)))
  let sum = 0
  for (let i = 1; i < L; i++) sum += xpToNext(i)
  return sum
}

/** Разбор общего XP на уровень (§3.5.1). */
export interface LevelProgress {
  /** Текущий уровень (1..60). */
  level: number
  /** XP, набранный внутри текущего уровня. */
  xpIntoLevel: number
  /** XP до следующего уровня (0 на капе). */
  xpToNext: number
  /** Достигнут ли кап (level === 60). */
  capped: boolean
}

/**
 * Уровень по суммарному XP (§3.5.1). Обратна `cumulativeXp`. Отрицательный XP → уровень 1.
 * На капе `xpIntoLevel` аккумулирует «переполнение» (лишний XP), `xpToNext = 0`.
 */
export function levelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (level < FARM_LEVEL_CAP) {
    const need = xpToNext(level)
    if (xp < cumulativeXp(level) + need) break
    level++
  }
  const base = cumulativeXp(level)
  const capped = level >= FARM_LEVEL_CAP
  return {
    level,
    xpIntoLevel: xp - base,
    xpToNext: capped ? 0 : xpToNext(level),
    capped,
  }
}
