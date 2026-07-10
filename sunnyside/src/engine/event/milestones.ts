/**
 * engine/event/milestones.ts — динамическая цель Goal_100 + серверные вехи (§3.4, §3.15).
 *
 * ЧИСТАЯ логика: автоскейл цели от 7-дневного актива города (DAU) и детект
 * пересечения вех `25/50/75/100%` (+ stretch `125/150%`). НЕ начисляет награды —
 * только считает пороги/пересечения; выдача идемпотентна на сервере по
 * `(week_id, ms_key)` (§3.13, EV8/EV9).
 *
 * ГРАНИЦА: ноль сети/three/state.
 */

import {
  GOAL_FP_PER_ACTIVE,
  GOAL_ROUND_STEP,
  MILESTONE_PCTS,
  N_EFF_MAX,
  N_EFF_MIN,
  STRETCH_PCTS,
  type MilestonePct,
  type StretchPct,
} from './constants'

/** Кламп эффективного актива N_eff в [30; 80] (§3.15): пол посилен, потолок анти-накрутка. */
export function effectiveActive(activePlayers7dAvg: number): number {
  const rounded = Math.round(activePlayers7dAvg)
  return Math.max(N_EFF_MIN, Math.min(N_EFF_MAX, rounded))
}

/** Округление до ближайшего шага (§3.15: round_to(x, 1000)). */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

/**
 * Goal_100 (§3.15): round_to(2800 × N_eff, 1000). N_eff — кламп актива.
 * Единица — ЭФФЕКТИВНЫЙ FP (после всех множителей), не сырой BFP.
 */
export function goal100(activePlayers7dAvg: number): number {
  const nEff = effectiveActive(activePlayers7dAvg)
  return roundTo(GOAL_FP_PER_ACTIVE * nEff, GOAL_ROUND_STEP)
}

/** Процент заполнения шкалы (§3.3): 100 × Meter_FP / Goal_100. */
export function meterPct(fp: number, goal: number): number {
  if (goal <= 0) return 0
  return (100 * fp) / goal
}

/** Абсолютный порог FP для вехи `pct` при данном Goal_100. */
export function milestoneFp(pct: number, goal: number): number {
  return (pct / 100) * goal
}

export interface MilestoneThreshold {
  pct: MilestonePct | StretchPct
  fp: number
  stretch: boolean
}

/**
 * Полный список порогов (базовые `25/50/75/100` + stretch `125/150`) с абсолютным
 * FP для данного Goal_100. Отсортирован по возрастанию pct.
 */
export function milestoneThresholds(goal: number): MilestoneThreshold[] {
  const base: MilestoneThreshold[] = MILESTONE_PCTS.map((pct) => ({
    pct,
    fp: milestoneFp(pct, goal),
    stretch: false,
  }))
  const stretch: MilestoneThreshold[] = STRETCH_PCTS.map((pct) => ({
    pct,
    fp: milestoneFp(pct, goal),
    stretch: true,
  }))
  return [...base, ...stretch]
}

/**
 * Вехи, пересечённые при росте меры `prevFp → newFp` (EV8: атомарный инкремент,
 * детект пересечения). Веха «hit» когда мера ДОСТИГЛА порога: `prevFp < fp ≤ newFp`.
 * Возвращает pct в порядке возрастания (порядок начисления, §3.13).
 *
 * Необратимость (§3.4): просадка меры (freshness-переоценка) НЕ снимает вехи —
 * этот детект вызывается только на РОСТ; откат наград не делается вызывающей стороной.
 */
export function crossedMilestones(
  prevFp: number,
  newFp: number,
  goal: number,
): (MilestonePct | StretchPct)[] {
  if (newFp <= prevFp) return []
  return milestoneThresholds(goal)
    .filter((m) => m.fp > prevFp && m.fp <= newFp)
    .map((m) => m.pct)
}

/** Все вехи, уже достигнутые при текущей мере `fp` (для гидрации/UI). */
export function hitMilestones(fp: number, goal: number): (MilestonePct | StretchPct)[] {
  return milestoneThresholds(goal)
    .filter((m) => fp >= m.fp)
    .map((m) => m.pct)
}
