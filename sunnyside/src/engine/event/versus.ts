/**
 * engine/event/versus.ts — State Fair Showdown: скоринг город-против-города (§3.12).
 *
 * Per-capita, чтобы больший город не выигрывал автоматом. Тон — дружеское
 * соперничество: награды ОБОИМ (win / good-sport), потерь нет (пиллар P3).
 * Матчмейкинг — по агрегату league_score и DAU (по вкладу, не спенду, гардрейл §4).
 *
 * ЧИСТАЯ логика: ноль сети/three/state.
 */

/** Пол делителя TownScore (§3.12): max(active_players, 30). */
export const VERSUS_ACTIVE_FLOOR = 30

/** TownScore (§3.12): Σ FP_города / max(active_players, 30). */
export function townScore(sumFp: number, activePlayers: number): number {
  const divisor = Math.max(activePlayers, VERSUS_ACTIVE_FLOOR)
  return Math.max(0, sumFp) / divisor
}

export type VersusOutcome = 'versus_win' | 'versus_lose'

/**
 * Исход versus по per-capita скорам (§3.12). Выше TownScore → winner. Ничья
 * трактуется как win обоим (позитив-сум: штрафа проигравшему нет).
 */
export function versusOutcome(myScore: number, rivalScore: number): VersusOutcome {
  return myScore >= rivalScore ? 'versus_win' : 'versus_lose'
}
