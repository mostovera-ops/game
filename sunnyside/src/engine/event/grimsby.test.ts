/**
 * grimsby.test.ts — фазы-капризы Гримсби (ev_glutton, §3.9, §4.8). Node.
 */

import { describe, it, expect } from 'vitest'
import {
  phaseIndexAt,
  phaseDef,
  phaseMultiplier,
  gluttonMultiplier,
  grandCravingTriggers,
  isCleanPlate,
  GLUTTON_PHASE_MS,
} from './index'

describe('phaseIndexAt — 4-часовые фазы от начала окна', () => {
  it('фаза 0 в первые 4 ч', () => {
    expect(phaseIndexAt(0)).toBe(0)
    expect(phaseIndexAt(GLUTTON_PHASE_MS - 1)).toBe(0)
  })
  it('следующая фаза ровно через 4 ч', () => {
    expect(phaseIndexAt(GLUTTON_PHASE_MS)).toBe(1)
    expect(phaseIndexAt(GLUTTON_PHASE_MS * 3)).toBe(3)
  })
  it('отрицательное смещение → фаза 0', () => {
    expect(phaseIndexAt(-1000)).toBe(0)
  })
})

describe('phaseDef — фиксированный цикл категорий §3.9', () => {
  it('P1 craves desserts, likes drinks, bored grill', () => {
    expect(phaseDef(0)).toEqual({ craves: 'cat_desserts', likes: 'cat_drinks', bored: 'cat_grill' })
  })
  it('цикл из 4 позиций повторяется (любой пояс застаёт каждую, E11)', () => {
    expect(phaseDef(4)).toEqual(phaseDef(0))
    expect(phaseDef(5)).toEqual(phaseDef(1))
  })
})

describe('phaseMultiplier — craves 2.0 / likes 1.3 / bored 0.6 / прочее 1.0 §4.8', () => {
  it('множители фазы P1', () => {
    expect(phaseMultiplier('cat_desserts', 0)).toBe(2.0) // craves
    expect(phaseMultiplier('cat_drinks', 0)).toBe(1.3) // likes
    expect(phaseMultiplier('cat_grill', 0)).toBe(0.6) // bored
    expect(phaseMultiplier('cat_snacks', 0)).toBe(1.0) // прочее
  })
})

describe('gluttonMultiplier — Grand Craving абсолютный ×3.0 §3.9', () => {
  it('без Grand Craving — фазовый множитель', () => {
    expect(gluttonMultiplier('cat_desserts', 0)).toBe(2.0)
  })
  it('Grand Craving заменяет фазовый: целевая ×3.0, прочие ×1.0 (не поверх)', () => {
    // desserts в P1 фазово ×2.0, но Grand Craving на desserts → ровно 3.0
    expect(gluttonMultiplier('cat_desserts', 0, 'cat_desserts')).toBe(3.0)
    // grill в P1 фазово bored ×0.6, но при Grand Craving на desserts → ×1.0
    expect(gluttonMultiplier('cat_grill', 0, 'cat_desserts')).toBe(1.0)
  })
})

describe('grandCravingTriggers — ~50% и ~90% §4.8', () => {
  it('пересечение 50% включает Grand Craving', () => {
    expect(grandCravingTriggers(45, 55)).toEqual([50])
  })
  it('большой скачок пересекает оба триггера', () => {
    expect(grandCravingTriggers(49, 91)).toEqual([50, 90])
  })
  it('нет пересечения → пусто', () => {
    expect(grandCravingTriggers(91, 95)).toEqual([])
    expect(grandCravingTriggers(60, 55)).toEqual([])
  })
})

describe('isCleanPlate — ≥6% Goal_100 в craved-категорию за фазу §3.9', () => {
  it('порог 6% Goal_100', () => {
    // 6% от 140000 = 8400
    expect(isCleanPlate(8400, 140_000)).toBe(true)
    expect(isCleanPlate(8399, 140_000)).toBe(false)
  })
})
