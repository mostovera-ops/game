import { describe, expect, it } from 'vitest'
import {
  FREE_FIELD_PLOTS,
  MAX_FIELD_PLOTS,
  fieldPlotCost,
  totalFieldExpansionCost,
  orchardPlotCost,
  blockIndexForSlot,
  LAND_EXPANSION_BLOCK_SIZE,
} from './land'

describe('fieldPlotCost — Cost(n) = round(100 × 1.18^(n−6), −10)', () => {
  it('слоты 1–6 бесплатны (старт)', () => {
    for (let n = 1; n <= FREE_FIELD_PLOTS; n++) {
      expect(fieldPlotCost(n)).toBe(0)
    }
  })

  // Таблица — дословно из 02-farm.md §4.1 (мастер-формула K10/R4 DECISIONS-B).
  const expected: Record<number, number> = {
    7: 120,
    8: 140,
    9: 160,
    10: 190,
    11: 230,
    12: 270,
    13: 320,
    14: 380,
    15: 440,
    16: 520,
    17: 620,
    18: 730,
    19: 860,
    20: 1010,
    21: 1200,
    22: 1410,
    23: 1670,
    24: 1970,
    25: 2320,
    26: 2740,
    27: 3230,
    28: 3810,
    29: 4500,
    30: 5310,
    31: 6270,
    32: 7390,
    33: 8730,
    34: 10300,
    35: 12150,
    36: 14340,
    37: 16920,
    38: 19960,
    39: 23560,
    40: 27800,
  }

  it.each(Object.entries(expected))('слот №%s стоит $%s', (n, cost) => {
    expect(fieldPlotCost(Number(n))).toBe(cost)
  })

  it('строго монотонно растёт после стартовых слотов', () => {
    let prev = fieldPlotCost(FREE_FIELD_PLOTS + 1)
    for (let n = FREE_FIELD_PLOTS + 2; n <= MAX_FIELD_PLOTS; n++) {
      const cur = fieldPlotCost(n)
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
  })

  it('кидает RangeError на невалидный номер слота', () => {
    expect(() => fieldPlotCost(0)).toThrow(RangeError)
    expect(() => fieldPlotCost(-1)).toThrow(RangeError)
    expect(() => fieldPlotCost(1.5)).toThrow(RangeError)
  })
})

describe('totalFieldExpansionCost', () => {
  it('0 для диапазона внутри бесплатных слотов', () => {
    expect(totalFieldExpansionCost(FREE_FIELD_PLOTS)).toBe(0)
  })

  it('сумма первого платного блока (7–10) совпадает с ручным суммированием', () => {
    const manual = fieldPlotCost(7) + fieldPlotCost(8) + fieldPlotCost(9) + fieldPlotCost(10)
    expect(totalFieldExpansionCost(10)).toBe(manual)
  })

  it('невалидный аргумент (меньше стартовых слотов) даёт 0', () => {
    expect(totalFieldExpansionCost(3)).toBe(0)
  })
})

describe('orchardPlotCost — точечная шкала §4.1', () => {
  const expected = [900, 2200, 5000, 11000, 24000, 50000, 100000, 200000]

  it.each(expected.map((cost, i) => [i + 1, cost] as const))(
    'орчард-слот №%s стоит $%s',
    (n, cost) => {
      expect(orchardPlotCost(n)).toBe(cost)
    },
  )

  it('кидает RangeError вне диапазона 1..8', () => {
    expect(() => orchardPlotCost(0)).toThrow(RangeError)
    expect(() => orchardPlotCost(9)).toThrow(RangeError)
  })
})

describe('blockIndexForSlot — блоки по 5 слотов (§3.2)', () => {
  it('бесплатные слоты — блок 0', () => {
    expect(blockIndexForSlot(1)).toBe(0)
    expect(blockIndexForSlot(FREE_FIELD_PLOTS)).toBe(0)
  })

  it('первые 5 платных слотов — блок 1', () => {
    for (let n = FREE_FIELD_PLOTS + 1; n <= FREE_FIELD_PLOTS + LAND_EXPANSION_BLOCK_SIZE; n++) {
      expect(blockIndexForSlot(n)).toBe(1)
    }
  })

  it('следующие 5 — блок 2', () => {
    expect(blockIndexForSlot(FREE_FIELD_PLOTS + LAND_EXPANSION_BLOCK_SIZE + 1)).toBe(2)
  })
})
