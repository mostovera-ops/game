/**
 * engine/event/leagues.ts — лиги по историческому вкладу + личные сундуки (§3.5, §3.7).
 *
 * ГАРДРЕЙЛ КАНОНА §4: лиги — по накопленному за сезон FP (`league_score`), НЕ по
 * деньгам. Лига — справедливое признание и масштаб наград, НЕ сила: не даёт
 * производственных бонусов. Кит поднимается ровно настолько, насколько его буст
 * СКОНВЕРТИРОВАЛСЯ в FP для города.
 *
 * ЧИСТАЯ логика: ноль сети/three/state.
 */

import {
  CHEST_BASE_THRESHOLD,
  LEAGUE_SEASON_CARRY,
  LEAGUES,
  type ChestKey,
  type LeagueDef,
  type LeagueKey,
} from './constants'

/**
 * Лига по накопленному за сезон FP (§3.7). Берётся высшая лига, чей порог достигнут.
 * Отрицательный/нулевой score → Sprout.
 */
export function leagueForScore(seasonFp: number): LeagueDef {
  // LEAGUES непуст (5 лиг) — стартуем с Sprout (порог 0).
  let current: LeagueDef = LEAGUES[0]!
  for (const league of LEAGUES) {
    if (seasonFp >= league.minSeasonFp) {
      current = league
    } else {
      break
    }
  }
  return current
}

/** Определение лиги по ключу (для UI/бейджа). */
export function leagueByKey(key: LeagueKey): LeagueDef | undefined {
  return LEAGUES.find((l) => l.key === key)
}

/**
 * Итоговый порог сундука с учётом лиги (§3.5, §4.5).
 *
 * Participation-floor Bronze (§3.5, приоритет над лига-порогом): множитель лиги
 * поднимает пороги ТОЛЬКО для Silver и выше. Bronze всегда по базовому порогу —
 * гарантия участие-награды (EV1), сколь бы высока ни была лига.
 */
export function chestThreshold(chest: ChestKey, league: LeagueDef): number {
  const base = CHEST_BASE_THRESHOLD[chest]
  if (chest === 'chest_bronze') return base
  return base * league.chestThresholdMult
}

/**
 * Личные сундуки, открытые игроком (§3.5). Bronze — по факту `≥1` внесённого блюда
 * (`contributed`), НЕЗАВИСИМО от personalFp и лиги (participation floor, EV1).
 * Silver/Gold/Platinum — по `personalFp ≥ порог×множитель_лиги`.
 * Сундуки накопительные: список — все достигнутые.
 */
export function chestsUnlocked(
  personalFp: number,
  league: LeagueDef,
  contributed: boolean,
): ChestKey[] {
  const unlocked: ChestKey[] = []
  // Bronze: participation floor — достаточно ≥1 блюда.
  if (contributed || personalFp >= chestThreshold('chest_bronze', league)) {
    unlocked.push('chest_bronze')
  }
  const higher: ChestKey[] = ['chest_silver', 'chest_gold', 'chest_platinum']
  for (const chest of higher) {
    if (personalFp >= chestThreshold(chest, league)) {
      unlocked.push(chest)
    }
  }
  return unlocked
}

/**
 * Перенос league_score между сезонами (§3.7, §4.7): мягкий сброс 25% — ветеран не
 * падает в ноль, новичок догоняет.
 */
export function carryLeagueScore(oldScore: number): number {
  return LEAGUE_SEASON_CARRY * Math.max(0, oldScore)
}
