/**
 * engine/event/pennant.ts — вклад стрита → вымпел (§3.6, §4.6).
 *
 * Стриты ранжируются по FP-НА-УЧАСТНИКА (per-capita), чтобы стрит из 10 не
 * проигрывал стриту из 20. Делитель — размер РОСТЕРА (все приписанные фермы), не
 * число контрибьюторов: награждаем ДОЛЮ участия (анти-абуз §3.6). Позитив-сум:
 * добавление вкладчика никогда не роняет StreetScore.
 *
 * ЧИСТАЯ логика: ноль сети/three/state.
 */

import {
  PENNANT_THRESHOLD,
  STREET_MIN_FLOOR,
  type PennantKey,
} from './constants'

/**
 * StreetScore (§3.6): Σ FP_членов / max(roster_size, min_floor=5).
 * Делитель — размер ростера (не активные): вовлекать всех выгодно. `min_floor`
 * не даёт микро-стриту космический per-capita.
 */
export function streetScore(sumFp: number, rosterSize: number): number {
  const divisor = Math.max(rosterSize, STREET_MIN_FLOOR)
  if (divisor <= 0) return 0
  return Math.max(0, sumFp) / divisor
}

/**
 * Высший пороговый вымпел по StreetScore (§4.6): Bronze ≥1500 / Silver ≥2500 /
 * Gold ≥4000. `null`, если ни один порог не достигнут. Center Stage (топ-1) —
 * вне порога, определяется ранжированием стритов вызывающей стороной.
 * Пороговые вымпелы НЕ эксклюзивны — несколько стритов могут взять Gold.
 */
export function pennantTier(score: number): PennantKey | null {
  if (score >= PENNANT_THRESHOLD.pennant_gold) return 'pennant_gold'
  if (score >= PENNANT_THRESHOLD.pennant_silver) return 'pennant_silver'
  if (score >= PENNANT_THRESHOLD.pennant_bronze) return 'pennant_bronze'
  return null
}
