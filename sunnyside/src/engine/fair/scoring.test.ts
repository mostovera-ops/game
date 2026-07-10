/**
 * scoring.test.ts — юниты формул активной смены (09-fair §3.5/§3.6/§4.6).
 * Node без браузера. Числа сверены со спекой (base_pts §3.6, combo §3.5, House Special §4.6).
 */

import { describe, it, expect } from 'vitest'

import {
  comboMultiplier,
  nextCombo,
  baseOrderPoints,
  orderScore,
  orderBucks,
  orderTips,
  scoreShift,
  weeklyTickets,
  type ServedOrder,
} from './scoring'

describe('comboMultiplier — стрик → множитель (§3.5)', () => {
  it('пороги 0–2/3–5/6–9/10+', () => {
    expect(comboMultiplier(0)).toBe(1.0)
    expect(comboMultiplier(2)).toBe(1.0)
    expect(comboMultiplier(3)).toBe(1.25)
    expect(comboMultiplier(5)).toBe(1.25)
    expect(comboMultiplier(6)).toBe(1.5)
    expect(comboMultiplier(9)).toBe(1.5)
    expect(comboMultiplier(10)).toBe(2.0)
    expect(comboMultiplier(100)).toBe(2.0)
  })
})

describe('nextCombo — рост/сброс серии (§3.5)', () => {
  it('успех +1, Blue Plate +3 (=+1 базовый +2 бонус), таймаут → 0', () => {
    expect(nextCombo(4, 'success')).toBe(5)
    expect(nextCombo(4, 'blue_plate')).toBe(7)
    expect(nextCombo(9, 'timeout')).toBe(0)
  })
})

describe('baseOrderPoints — базовые очки заказа (§3.6, §4.6)', () => {
  it('обычный мульти-блюдный заказ = сумма base_pts', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [2, 3], stars: 0, comboStreak: 0 }
    expect(baseOrderPoints(o)).toBe(20 + 35)
  })
  it('Blue Plate = 1.5 × base_pts главного (макс. тира) блюда', () => {
    const o: ServedOrder = { kind: 'blue_plate', dishTiers: [1, 3, 1], stars: 0, comboStreak: 0 }
    expect(baseOrderPoints(o)).toBe(35 * 1.5)
  })
  it('House Special = флэт 2 (§4.6)', () => {
    const o: ServedOrder = { kind: 'house_special', dishTiers: [3], stars: 5, comboStreak: 9 }
    expect(baseOrderPoints(o)).toBe(2)
  })
})

describe('orderScore — base × Q × combo × vip (§3.6)', () => {
  it('обычный T3, ★0, combo 0, не VIP → base 35', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0 }
    expect(orderScore(o)).toBeCloseTo(35)
  })
  it('T3 ★5 combo 10 VIP → 35×1.40×2.0×1.5 = 147', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [3], stars: 5, comboStreak: 10, vip: true }
    expect(orderScore(o)).toBeCloseTo(147)
  })
  it('House Special игнорит Q/combo/vip — только флэт 2 (§4.6)', () => {
    const o: ServedOrder = { kind: 'house_special', dishTiers: [5], stars: 5, comboStreak: 10, vip: true }
    expect(orderScore(o)).toBe(2)
  })
})

describe('orderBucks — цена стока (§3.6, §4.6)', () => {
  it('обычный = Σ p_ref блюд', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [2, 3], stars: 0, comboStreak: 0 }
    expect(orderBucks(o)).toBe(22 + 75)
  })
  it('VIP ×1.5 к чеку', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0, vip: true }
    expect(orderBucks(o)).toBeCloseTo(75 * 1.5)
  })
  it('House Special = ×0.5 от p_ref усреднённого блюда (§4.6)', () => {
    const o: ServedOrder = { kind: 'house_special', dishTiers: [3, 5], stars: 0, comboStreak: 0 }
    expect(orderBucks(o)).toBeCloseTo(((75 + 900) / 2) * 0.5)
  })
})

describe('orderTips — 0.12 × Σp_ref × combo × staff × vip (§3.5/§3.6)', () => {
  it('база 12% без combo/стаффа', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0 }
    expect(orderTips(o)).toBeCloseTo(0.12 * 75)
  })
  it('combo ×2 и Peggy +15%', () => {
    const o: ServedOrder = { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 10 }
    expect(orderTips(o, { peggy: true })).toBeCloseTo(0.12 * 75 * 2.0 * 1.15)
  })
  it('House Special — 0 чаевых (§4.6)', () => {
    const o: ServedOrder = { kind: 'house_special', dishTiers: [3], stars: 0, comboStreak: 0 }
    expect(orderTips(o)).toBe(0)
  })
})

describe('scoreShift — агрегат смены (§3.6)', () => {
  it('суммирует очки/деньги/чаевые, считает served без House Special', () => {
    const orders: ServedOrder[] = [
      { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0 }, // 35
      { kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 1 }, // 35
      { kind: 'house_special', dishTiers: [3], stars: 0, comboStreak: 0 }, // 2, не served
    ]
    const res = scoreShift(orders)
    expect(res.fairScore).toBe(35 + 35 + 2)
    expect(res.served).toBe(2)
    expect(res.bucks).toBe(75 + 75 + Math.round(75 * 0.5))
  })

  it('палатка ур.4+ даёт +10% Fair Score (§3.6)', () => {
    const orders: ServedOrder[] = [{ kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0 }]
    const plain = scoreShift(orders)
    const l4 = scoreShift(orders, { tentLevel: 4 })
    expect(l4.fairScore).toBe(Math.round(plain.fairScore * 1.1))
  })

  it('Ada +5% Bucks множитель (§3.9)', () => {
    const orders: ServedOrder[] = [{ kind: 'normal', dishTiers: [3], stars: 0, comboStreak: 0 }]
    const res = scoreShift(orders, { bucksMult: 1.05 })
    expect(res.bucks).toBe(Math.round(75 * 1.05))
  })

  it('ticketsRaw = floor(fairScore/500)', () => {
    // 20 заказов T3 ★0 combo0 = 20×35 = 700 → 1 тикет
    const orders: ServedOrder[] = Array.from({ length: 20 }, () => ({
      kind: 'normal' as const,
      dishTiers: [3],
      stars: 0,
      comboStreak: 0,
    }))
    expect(scoreShift(orders).ticketsRaw).toBe(1)
  })
})

describe('weeklyTickets — порог 500, кэп 5/неделя (§3.6/R10)', () => {
  it('<500 → 0; 1560 → 3; кэп 5 при большом счёте', () => {
    expect(weeklyTickets(300)).toBe(0)
    expect(weeklyTickets(1560)).toBe(3)
    expect(weeklyTickets(999999)).toBe(5)
  })
})
