import { describe, it, expect } from 'vitest'
import { closedRegionsCoveringStop, isRegionComplete, regionSetBonusReduction, regionsForState } from './regionSet'
import type { StateKey } from '@/types'

describe('engine/expedition/regionSet', () => {
  it('regionsForState finds the South region for its four member stops (§3.7 example)', () => {
    for (const stateKey of ['st_tennessee', 'st_georgia', 'st_louisiana', 'st_texas'] as StateKey[]) {
      expect(regionsForState(stateKey)).toEqual(['region_south'])
    }
  })

  it('st_home belongs to no region (обучающий стоп)', () => {
    expect(regionsForState('st_home')).toEqual([])
  })

  it('isRegionComplete is false until every member stop has a postcard', () => {
    const partial = new Set<StateKey>(['st_tennessee', 'st_georgia'])
    expect(isRegionComplete('region_south', partial)).toBe(false)

    const full = new Set<StateKey>(['st_tennessee', 'st_georgia', 'st_louisiana', 'st_texas'])
    expect(isRegionComplete('region_south', full)).toBe(true)
  })

  it('closedRegionsCoveringStop / regionSetBonusReduction: 0 until region complete, then 0.05 (§4.1)', () => {
    const partial = new Set<StateKey>(['st_tennessee', 'st_georgia'])
    expect(closedRegionsCoveringStop('st_texas', partial)).toBe(0)
    expect(regionSetBonusReduction('st_texas', partial)).toBe(0)

    const full = new Set<StateKey>(['st_tennessee', 'st_georgia', 'st_louisiana', 'st_texas'])
    expect(closedRegionsCoveringStop('st_texas', full)).toBe(1)
    expect(regionSetBonusReduction('st_texas', full)).toBeCloseTo(0.05)
  })
})
