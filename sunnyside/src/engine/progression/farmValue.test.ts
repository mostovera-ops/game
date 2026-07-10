/**
 * farmValue.test.ts — мастер-формула Farm Value (13-progression §3.4.1/§4.5), включая
 * кап 15% косметики/коллекций (делегируется econ) и пример расчёта §3.4.2.
 */

import { describe, it, expect } from 'vitest'
import {
  farmValue,
  farmValueAxes,
  buildingsAxis,
  productionAxis,
  collectionsAxis,
  cosmeticsAxis,
  type FarmValueInput,
} from './farmValue'

const EMPTY: FarmValueInput = {
  buildingLevels: {},
  staffLevels: [],
  knowHowNodeCount: 0,
  fieldPlots: 0,
  orchardPlots: 0,
  animalFv: 0,
  recipeMasteryStars: 0,
  toys: 0,
  ribbons: 0,
  postcards: 0,
  decorScore: 0,
}

describe('buildingsAxis — level^1.5 × W_bld (§3.4.1)', () => {
  it('House Ур.6 = 6^1.5×120 ≈ 1763 (пример §3.4.2)', () => {
    expect(buildingsAxis({ bld_house: 6 })).toBeCloseTo(Math.pow(6, 1.5) * 120, 5)
    expect(Math.round(buildingsAxis({ bld_house: 6 }))).toBe(1764)
  })

  it('Diner/Kitchen Ур.5 = 5^1.5×100 ≈ 1118 каждый', () => {
    expect(Math.round(buildingsAxis({ bld_diner: 5 }))).toBe(1118)
    expect(Math.round(buildingsAxis({ bld_kitchen: 5 }))).toBe(1118)
  })

  it('веса из §3.4.1: House120 Diner100 Kitchen100 Garage80 Barn70 Coop50 Silo40 Icehouse40', () => {
    const at1 = (k: FarmValueInput['buildingLevels']) => buildingsAxis(k) // level^1.5 при 1 = 1
    expect(at1({ bld_house: 1 })).toBe(120)
    expect(at1({ bld_diner: 1 })).toBe(100)
    expect(at1({ bld_kitchen: 1 })).toBe(100)
    expect(at1({ bld_garage: 1 })).toBe(80)
    expect(at1({ bld_barn: 1 })).toBe(70)
    expect(at1({ bld_coop: 1 })).toBe(50)
    expect(at1({ bld_silo: 1 })).toBe(40)
    expect(at1({ bld_icehouse: 1 })).toBe(40)
  })

  it('bld_apiary без веса в §3.4.1 → вклад 0 (не выдумываем)', () => {
    expect(buildingsAxis({ bld_apiary: 10 })).toBe(0)
  })

  it('уровень 0/отрицательный игнорируется', () => {
    expect(buildingsAxis({ bld_house: 0, bld_diner: -3 })).toBe(0)
  })
})

describe('productionAxis (§3.4.1/§4.5)', () => {
  it('стафф × 40 за уровень', () => {
    expect(productionAxis({ ...EMPTY, staffLevels: [3, 3, 3] })).toBe(9 * 40)
  })

  it('know-how × 60, грядки × 15, сад × 25, рецепты × 10, animalFv как есть', () => {
    const p = productionAxis({
      ...EMPTY,
      knowHowNodeCount: 22,
      fieldPlots: 28,
      orchardPlots: 6,
      recipeMasteryStars: 40,
      animalFv: 700,
    })
    expect(p).toBe(22 * 60 + 28 * 15 + 6 * 25 + 40 * 10 + 700)
  })
})

describe('collections / cosmetics axes (§3.4.1)', () => {
  it('коллекции: игрушки×20 + ленты×100 + открытки×15', () => {
    expect(collectionsAxis({ ...EMPTY, toys: 25, ribbons: 4, postcards: 10 })).toBe(
      25 * 20 + 4 * 100 + 10 * 15,
    )
  })

  it('косметика: decor_score×5', () => {
    expect(cosmeticsAxis({ ...EMPTY, decorScore: 40 })).toBe(200)
  })
})

describe('farmValue — кап 15% (§3.4.1, делегируется econ)', () => {
  it('огромная косметика зажата: cappedSoft = core×0.15/0.85, доля в total = 15%', () => {
    const fv = farmValue({
      ...EMPTY,
      buildingLevels: { bld_house: 6 },
      toys: 1000, // огромная косметика
      ribbons: 1000,
    })
    // econ.farmValue капирует только total (оси возвращаются сырыми) — проверяем total.
    const core = fv.production + fv.buildings
    const cappedSoft = (core * 0.15) / 0.85
    expect(fv.total).toBe(Math.round(core + cappedSoft))
    // Доля «мягкой» части в итоге ровно 15% (в пределах округления).
    expect(cappedSoft / fv.total).toBeCloseTo(0.15, 4)
  })

  it('малая косметика (< кап) входит целиком', () => {
    const fv = farmValue({
      ...EMPTY,
      buildingLevels: { bld_house: 6 }, // core = ~1764
      toys: 1, // soft = 20 ≪ кап
    })
    const core = fv.production + fv.buildings
    expect(fv.total).toBe(Math.round(core + 20))
  })

  it('пример середины игры §3.4.2 воспроизводится ≈ 10 977', () => {
    // Входы из таблицы §3.4.2 (Garage/Barn/Silo и животные заданы явными уровнями/суммой).
    const fv = farmValue({
      buildingLevels: {
        bld_house: 6,
        bld_diner: 5,
        bld_kitchen: 5,
        bld_garage: 5, // 5^1.5×80 ≈ 894
        bld_barn: 5, // 5^1.5×70 ≈ 783
        bld_silo: 4, // 4^1.5×40 = 320
      },
      staffLevels: [3, 3, 3, 3, 3, 3, 3], // 7 персонажей ср. Ур.3 → 21×40=840
      knowHowNodeCount: 22,
      fieldPlots: 28,
      orchardPlots: 6,
      animalFv: 700,
      recipeMasteryStars: 40,
      toys: 25,
      ribbons: 4,
      postcards: 10,
      decorScore: 40,
    })
    // Спека даёт «≈ 10 977» при округлённой сумме Garage/Barn/Silo≈1900; допускаем ±250.
    expect(fv.total).toBeGreaterThan(10_700)
    expect(fv.total).toBeLessThan(11_250)
  })

  it('оси до капа = сумма компонент', () => {
    const input: FarmValueInput = { ...EMPTY, buildingLevels: { bld_house: 2 }, staffLevels: [1] }
    const axes = farmValueAxes(input)
    expect(axes.buildings).toBe(buildingsAxis(input.buildingLevels))
    expect(axes.production).toBe(productionAxis(input))
  })
})
