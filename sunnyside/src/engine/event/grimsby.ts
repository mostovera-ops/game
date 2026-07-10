/**
 * engine/event/grimsby.ts — тема The Glutton Comes to Town: фазы-капризы (§3.9, §4.8).
 *
 * Гастрокритик Гримсби капризничает фазами по 4 ч: craves ×2.0 / likes ×1.3 /
 * bored ×0.6 / прочее ×1.0. Категории идут фиксированным циклом (любой пояс
 * застаёт каждую, канон E11). Grand Craving — абсолютный ×3.0 на 2 ч (заменяет
 * фазовый множитель), триггер на ~50%/~90% шкалы.
 *
 * ЧИСТАЯ логика: ноль сети/three/state. Время фазы — от начала окна вклада
 * (Сб 00:00 UTC), считается вызывающей стороной через clock.
 */

import {
  GLUTTON_BORED_MULT,
  GLUTTON_CLEAN_PLATE_PCT,
  GLUTTON_CRAVES_MULT,
  GLUTTON_GRAND_CRAVING_MULT,
  GLUTTON_GRAND_CRAVING_TRIGGERS,
  GLUTTON_LIKES_MULT,
  GLUTTON_NEUTRAL_MULT,
  GLUTTON_PHASE_CYCLE,
  GLUTTON_PHASE_HOURS,
  type DishCategory,
  type GluttonPhaseDef,
} from './constants'
import { MINUTE_MS, HOUR_MS } from '@/engine/clock'

/** Длина фазы Гримсби в мс (4 ч). */
export const GLUTTON_PHASE_MS = GLUTTON_PHASE_HOURS * HOUR_MS

/**
 * Индекс фазы от смещения относительно начала окна вклада (Сб 00:00 UTC).
 * `elapsedMs` — сколько прошло от открытия котла; ≥0. Отрицательное → фаза 0.
 */
export function phaseIndexAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return Math.floor(elapsedMs / GLUTTON_PHASE_MS)
}

/** Определение фазы (craves/likes/bored) по индексу — цикл из 4 позиций (§3.9). */
export function phaseDef(phaseIndex: number): GluttonPhaseDef {
  const n = GLUTTON_PHASE_CYCLE.length
  const pos = ((phaseIndex % n) + n) % n
  // pos ∈ [0; n) по построению — цикл всегда покрыт (§3.9).
  return GLUTTON_PHASE_CYCLE[pos] ?? GLUTTON_PHASE_CYCLE[0]!
}

/**
 * Фазовый множитель категории (без Grand Craving): craves ×2.0 / likes ×1.3 /
 * bored ×0.6 / прочее ×1.0 (§4.8).
 */
export function phaseMultiplier(category: DishCategory, phaseIndex: number): number {
  const def = phaseDef(phaseIndex)
  if (category === def.craves) return GLUTTON_CRAVES_MULT
  if (category === def.likes) return GLUTTON_LIKES_MULT
  if (category === def.bored) return GLUTTON_BORED_MULT
  return GLUTTON_NEUTRAL_MULT
}

/**
 * Итоговый M_theme темы Glutton (§3.9). Если активен Grand Craving на категорию
 * `grandCraving`: целевая категория → ×3.0 АБСОЛЮТНО (заменяет фазовый), прочие →
 * ×1.0. Иначе — фазовый множитель.
 */
export function gluttonMultiplier(
  category: DishCategory,
  phaseIndex: number,
  grandCraving?: DishCategory | null,
): number {
  if (grandCraving != null) {
    return category === grandCraving ? GLUTTON_GRAND_CRAVING_MULT : GLUTTON_NEUTRAL_MULT
  }
  return phaseMultiplier(category, phaseIndex)
}

/**
 * Нужно ли включить Grand Craving на пересечении меры `prevPct → newPct`.
 * Триггеры ~50% и ~90% (§4.8): срабатывает, когда рост меры пересекает порог.
 * Возвращает список пересечённых триггеров (обычно 0–1 за инкремент).
 */
export function grandCravingTriggers(prevPct: number, newPct: number): number[] {
  if (newPct <= prevPct) return []
  return GLUTTON_GRAND_CRAVING_TRIGGERS.filter((t) => t > prevPct && t <= newPct)
}

/**
 * Clean Plate (§3.9): мини-цель фазы выполнена, если в craved-категорию за фазу
 * внесено ≥ 6% Goal_100. `categoryFpThisPhase` — FP craved-категории за фазу.
 */
export function isCleanPlate(categoryFpThisPhase: number, goal100: number): boolean {
  return categoryFpThisPhase >= GLUTTON_CLEAN_PLATE_PCT * goal100
}

/** Телеграф Grand Craving — за 30 мин (§4.8). Утилита длительности анонса. */
export const GRAND_CRAVING_TELEGRAPH_MS = 30 * MINUTE_MS
