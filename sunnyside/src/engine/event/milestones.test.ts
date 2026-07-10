/**
 * milestones.test.ts — юниты автоскейла Goal_100 и детекта вех (§3.4, §3.15).
 * Sensitivity-таблица §3.15/§4.11 (N_eff 40/50/60) — сверена со спекой. Node.
 */

import { describe, it, expect } from 'vitest'
import {
  effectiveActive,
  roundTo,
  goal100,
  meterPct,
  milestoneFp,
  milestoneThresholds,
  crossedMilestones,
  hitMilestones,
} from './index'

describe('effectiveActive — N_eff clamp [30; 80] §3.15', () => {
  it('округляет средний актив', () => {
    expect(effectiveActive(50)).toBe(50)
    expect(effectiveActive(49.6)).toBe(50)
  })
  it('пол 30 — малый город посилен', () => {
    expect(effectiveActive(10)).toBe(30)
    expect(effectiveActive(0)).toBe(30)
  })
  it('потолок 80 — анти-накрутка актива (EV12)', () => {
    expect(effectiveActive(200)).toBe(80)
    expect(effectiveActive(80)).toBe(80)
  })
})

describe('roundTo', () => {
  it('округляет до ближайшего шага', () => {
    expect(roundTo(92400, 1000)).toBe(92000)
    expect(roundTo(92500, 1000)).toBe(93000)
  })
  it('шаг ≤ 0 → без округления', () => {
    expect(roundTo(123, 0)).toBe(123)
  })
})

describe('goal100 — round_to(2800 × N_eff, 1000) §3.15', () => {
  it('sensitivity-таблица §4.11 (N=40/50/60)', () => {
    expect(goal100(40)).toBe(112_000)
    expect(goal100(50)).toBe(140_000)
    expect(goal100(60)).toBe(168_000)
  })
  it('кламп актива входит в цель', () => {
    expect(goal100(10)).toBe(84_000) // N_eff=30 → 2800×30
    expect(goal100(999)).toBe(224_000) // N_eff=80 → 2800×80
  })
})

describe('meterPct — 100 × Meter_FP / Goal_100 §3.3', () => {
  it('процент заполнения', () => {
    expect(meterPct(70_000, 140_000)).toBe(50)
    expect(meterPct(140_000, 140_000)).toBe(100)
    expect(meterPct(210_000, 140_000)).toBe(150) // stretch — растёт выше 100
  })
  it('нулевая цель → 0 (защита от деления на ноль)', () => {
    expect(meterPct(1000, 0)).toBe(0)
  })
})

describe('milestoneFp / milestoneThresholds §3.4', () => {
  it('пороги вех при Goal=140k', () => {
    expect(milestoneFp(25, 140_000)).toBe(35_000)
    expect(milestoneFp(75, 140_000)).toBe(105_000)
  })
  it('полный список: базовые 25/50/75/100 + stretch 125/150', () => {
    const t = milestoneThresholds(140_000)
    expect(t.map((m) => m.pct)).toEqual([25, 50, 75, 100, 125, 150])
    expect(t.filter((m) => m.stretch).map((m) => m.pct)).toEqual([125, 150])
    expect(t.find((m) => m.pct === 100)?.fp).toBe(140_000)
    expect(t.find((m) => m.pct === 150)?.fp).toBe(210_000)
  })
})

describe('crossedMilestones — детект пересечения prevFp → newFp (EV8)', () => {
  const goal = 140_000
  it('один инкремент пересекает одну веху', () => {
    expect(crossedMilestones(69_000, 71_000, goal)).toEqual([50])
  })
  it('большой скачок пересекает несколько вех по возрастанию', () => {
    expect(crossedMilestones(0, 140_000, goal)).toEqual([25, 50, 75, 100])
  })
  it('пересекает stretch выше 100%', () => {
    expect(crossedMilestones(100_000, 180_000, goal)).toEqual([75, 100, 125])
  })
  it('граница: порог достигнут ровно (prevFp < fp ≤ newFp)', () => {
    // 35000 уже был → не пересекаем; 70000 достигнут ровно → пересекаем 50%
    expect(crossedMilestones(35_000, 70_000, goal)).toEqual([50])
  })
  it('просадка меры не пересекает вех (§3.4 необратимость — детект только на рост)', () => {
    expect(crossedMilestones(140_000, 130_000, goal)).toEqual([])
    expect(crossedMilestones(70_000, 70_000, goal)).toEqual([])
  })
})

describe('hitMilestones — все достигнутые вехи при текущей мере', () => {
  it('гидрация UI по мере', () => {
    expect(hitMilestones(35_000, 140_000)).toEqual([25])
    expect(hitMilestones(140_000, 140_000)).toEqual([25, 50, 75, 100])
    expect(hitMilestones(0, 140_000)).toEqual([])
  })
})
