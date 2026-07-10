/**
 * daynight.test.ts — тон сцены по фазе недели (node).
 */

import { describe, it, expect } from 'vitest'
import type { WeekPhase } from '@/types'
import { WEEK_PHASES } from '@/types'
import { phaseTone } from './daynight'

describe('phaseTone', () => {
  it('null/неизвестная фаза → ясный день', () => {
    const day = phaseTone(null)
    expect(day.ambient).toBeGreaterThan(0.6)
    expect(phaseTone('nonsense' as WeekPhase)).toEqual(day)
  })
  it('воскресный ивент темнее буднего дня', () => {
    expect(phaseTone('sun_event').ambient).toBeLessThan(phaseTone('mon_plan').ambient)
    expect(phaseTone('sun_event').dirIntensity).toBeLessThan(phaseTone('mon_plan').dirIntensity)
  })
  it('суббота-ярмарка — закатный тон между днём и ночью', () => {
    const sat = phaseTone('sat_fair')
    expect(sat.ambient).toBeLessThanOrEqual(phaseTone('mon_plan').ambient)
    expect(sat.ambient).toBeGreaterThanOrEqual(phaseTone('sun_event').ambient)
  })
  it('каждая канон-фаза даёт валидный hex-фон', () => {
    for (const phase of WEEK_PHASES) {
      expect(phaseTone(phase).background).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
