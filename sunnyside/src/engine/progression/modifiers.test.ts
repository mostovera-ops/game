/**
 * modifiers.test.ts — агрегатор/стак модификаторов прогрессии (13-progression
 * §3.1.1/§3.1.2/§3.1.5/§3.2). Проверяет масштабирование уровнем, активацию синергий,
 * АДДИТИВНОЕ сложение навыков + синергий + know-how.
 */

import { describe, it, expect } from 'vitest'
import {
  aggregateModifiers,
  getModifier,
  isStaffActive,
  type StaffAssignment,
} from './modifiers'
import {
  staffLevelMultiplier,
  staffUpgradeCost,
  staffUpgradeCostCumulative,
  effectiveStaffSkill,
} from './staffSkills'
import { isSynergyActive, activeSynergies, SYNERGIES } from './synergy'

const hire = (key: StaffAssignment['key'], level: number, post?: string): StaffAssignment => ({
  key,
  level,
  hired: true,
  ...(post !== undefined ? { assignedPost: post } : {}),
})

describe('staffLevelMultiplier (§3.1.2/§4.1)', () => {
  it('1.00/1.25/1.50/1.75/2.00 по уровням 1..5', () => {
    expect(staffLevelMultiplier(1)).toBe(1.0)
    expect(staffLevelMultiplier(2)).toBe(1.25)
    expect(staffLevelMultiplier(3)).toBe(1.5)
    expect(staffLevelMultiplier(4)).toBe(1.75)
    expect(staffLevelMultiplier(5)).toBe(2.0)
  })

  it('зажим за границами [1..5]', () => {
    expect(staffLevelMultiplier(0)).toBe(1.0)
    expect(staffLevelMultiplier(99)).toBe(2.0)
  })
})

describe('staffUpgradeCost — жетоны (§4.1)', () => {
  it('переходы →2/→3/→4/→5 = 10/25/60/140', () => {
    expect(staffUpgradeCost(2)).toBe(10)
    expect(staffUpgradeCost(3)).toBe(25)
    expect(staffUpgradeCost(4)).toBe(60)
    expect(staffUpgradeCost(5)).toBe(140)
  })

  it('вне диапазона перехода → 0', () => {
    expect(staffUpgradeCost(1)).toBe(0)
    expect(staffUpgradeCost(6)).toBe(0)
  })

  it('кумулятивно 10/35/95/235 (§4.1)', () => {
    expect(staffUpgradeCostCumulative(1)).toBe(0)
    expect(staffUpgradeCostCumulative(2)).toBe(10)
    expect(staffUpgradeCostCumulative(3)).toBe(35)
    expect(staffUpgradeCostCumulative(4)).toBe(95)
    expect(staffUpgradeCostCumulative(5)).toBe(235)
  })
})

describe('effectiveStaffSkill — base × множитель (§3.1.2)', () => {
  it('Bruno −10% готовки на Ур.5 = −20% (пример §4.1)', () => {
    const s = effectiveStaffSkill('staff_bruno', 5)
    expect(s).toEqual({ key: 'cooking_time_pct', value: -20 })
  })

  it('Peggy +15% чаевые на Ур.3 = +22.5%', () => {
    expect(effectiveStaffSkill('staff_peggy', 3)).toEqual({ key: 'tips_pct', value: 22.5 })
  })

  it('персонаж без числового навыка → null (Clara/Lorraine/Vernon/Buck)', () => {
    expect(effectiveStaffSkill('staff_clara', 5)).toBeNull()
    expect(effectiveStaffSkill('staff_lorraine', 5)).toBeNull()
    expect(effectiveStaffSkill('staff_vernon', 5)).toBeNull()
    expect(effectiveStaffSkill('staff_buck', 5)).toBeNull()
  })
})

describe('isStaffActive — эффект только на своём посту (§3.1.3)', () => {
  it('нанят + назначен на канонический пост → активен', () => {
    expect(isStaffActive(hire('staff_bruno', 1, 'Kitchen'))).toBe(true)
  })

  it('назначен на ЧУЖОЙ пост → не активен', () => {
    expect(isStaffActive(hire('staff_bruno', 1, 'Yard'))).toBe(false)
  })

  it('на скамейке (без поста) → не активен (§3.1.3 P1/P2)', () => {
    expect(isStaffActive(hire('staff_bruno', 5))).toBe(false)
  })

  it('не нанят → не активен', () => {
    expect(isStaffActive({ key: 'staff_bruno', level: 1, hired: false, assignedPost: 'Kitchen' })).toBe(
      false,
    )
  })
})

describe('синергии (§3.1.5)', () => {
  it('Kitchen Brigade активна при всех трёх на Kitchen', () => {
    const active = new Set<StaffAssignment['key']>(['staff_bruno', 'staff_rosalind', 'staff_marty'])
    const def = SYNERGIES.find((s) => s.id === 'kitchen_brigade')!
    expect(isSynergyActive(def, active)).toBe(true)
  })

  it('Kitchen Brigade НЕ активна без одного участника', () => {
    const active = new Set<StaffAssignment['key']>(['staff_bruno', 'staff_rosalind'])
    const def = SYNERGIES.find((s) => s.id === 'kitchen_brigade')!
    expect(isSynergyActive(def, active)).toBe(false)
  })

  it('Motor Pool: любые 3 из 4 Yard (§3.1.5)', () => {
    const def = SYNERGIES.find((s) => s.id === 'motor_pool')!
    expect(isSynergyActive(def, new Set(['staff_ada', 'staff_gus', 'staff_buck']))).toBe(true)
    expect(isSynergyActive(def, new Set(['staff_ada', 'staff_gus']))).toBe(false)
    // все 4 — тоже активна
    expect(
      isSynergyActive(def, new Set(['staff_ada', 'staff_gus', 'staff_buck', 'staff_vernon'])),
    ).toBe(true)
  })

  it('activeSynergies находит все подходящие', () => {
    const active = new Set<StaffAssignment['key']>([
      'staff_bruno',
      'staff_rosalind',
      'staff_marty',
      'staff_ada',
    ])
    const ids = activeSynergies(active).map((s) => s.id)
    expect(ids).toContain('kitchen_brigade')
    expect(ids).toContain('syn_bruno_ada') // bruno + ada
    expect(ids).not.toContain('front_of_house')
  })
})

describe('aggregateModifiers — АДДИТИВНЫЙ стак (§3.1.5)', () => {
  it('стек cooking_time_pct: Bruno Ур.5 (−20) + Kitchen Brigade (−5) + know-how (−5 −5 −5)', () => {
    const res = aggregateModifiers({
      staff: [
        hire('staff_bruno', 5, 'Kitchen'),
        hire('staff_rosalind', 1, 'Kitchen'),
        hire('staff_marty', 1, 'Kitchen'),
      ],
      studiedNodes: [
        'kh_cookery_mise_en_place', // −5
        'kh_cookery_prep_crew', // −5
        'kh_cookery_cookery_mastery', // −5 (+ machine_batch +1)
      ],
    })
    // Bruno −20, синергия Kitchen Brigade −5, три узла −15 → итого −40.
    expect(getModifier(res.modifiers, 'cooking_time_pct')).toBeCloseTo(-40, 6)
    // капстоун также дал +1 партию.
    expect(getModifier(res.modifiers, 'machine_batch')).toBe(1)
    expect(res.activeSynergies).toContain('kitchen_brigade')
  })

  it('только активные персонажи участвуют в навыке И синергии', () => {
    // Bruno на скамейке (нет поста): ни навыка, ни вклада в Kitchen Brigade.
    const res = aggregateModifiers({
      staff: [
        hire('staff_bruno', 5), // скамейка
        hire('staff_rosalind', 1, 'Kitchen'),
        hire('staff_marty', 1, 'Kitchen'),
      ],
      studiedNodes: [],
    })
    expect(getModifier(res.modifiers, 'cooking_time_pct')).toBe(0)
    expect(res.activeSynergies).not.toContain('kitchen_brigade')
    expect(res.activeStaff).not.toContain('staff_bruno')
  })

  it('select_global_pct стек: master_gardener (+5) + agronomy_mastery (+5) = +10', () => {
    const res = aggregateModifiers({
      staff: [],
      studiedNodes: ['kh_agronomy_master_gardener', 'kh_agronomy_agronomy_mastery'],
    })
    expect(getModifier(res.modifiers, 'select_global_pct')).toBe(10)
  })

  it('auto_water_plots стек: Hank (4) + Homestead (+2) + Drip Lines (+2) = 8', () => {
    const res = aggregateModifiers({
      staff: [hire('staff_hank', 1, 'Field'), hire('staff_clara', 1, 'Field')],
      studiedNodes: ['kh_agronomy_drip_lines'],
    })
    // Hank base 4 ×1.00 + Homestead +2 + Drip Lines +2.
    expect(getModifier(res.modifiers, 'auto_water_plots')).toBe(8)
    expect(res.activeSynergies).toContain('homestead')
  })

  it('expedition_time_pct стек: Gus Ур.1 (−15) + Motor Pool (−10) + syn_gus_buck (−10) + Convoy (−5)', () => {
    const res = aggregateModifiers({
      staff: [
        hire('staff_gus', 1, 'Yard'),
        hire('staff_buck', 1, 'Yard'),
        hire('staff_ada', 1, 'Yard'), // 3 из 4 Yard → Motor Pool
      ],
      studiedNodes: ['kh_civics_convoy'],
    })
    // Gus −15, Motor Pool −10, syn_gus_buck −10, Convoy −5 → −40.
    expect(getModifier(res.modifiers, 'expedition_time_pct')).toBe(-40)
  })

  it('дубли изученных узлов не задваивают эффект', () => {
    const res = aggregateModifiers({
      staff: [],
      studiedNodes: ['kh_agronomy_soil_science', 'kh_agronomy_soil_science'],
    })
    expect(getModifier(res.modifiers, 'yield_pct')).toBe(10) // не 20
  })

  it('пустое состояние → пустой стек', () => {
    const res = aggregateModifiers({ staff: [], studiedNodes: [] })
    expect(Object.keys(res.modifiers)).toHaveLength(0)
    expect(res.activeSynergies).toHaveLength(0)
    expect(res.activeStaff).toHaveLength(0)
  })

  it('getModifier возвращает 0 для отсутствующего канала', () => {
    const res = aggregateModifiers({ staff: [], studiedNodes: [] })
    expect(getModifier(res.modifiers, 'tips_pct')).toBe(0)
  })
})
