/**
 * windowGlow.test.ts — раскладка окон-акцентов по реально построенным зданиям (node).
 */

import { describe, it, expect } from 'vitest'
import type { Building, BuildingKey } from '@/types'
import { buildingWindowPositions, GLOWING_BUILDINGS } from './windowGlow'
import { BUILDING_LAYOUT } from './layout'

function stubBuilding(): Building {
  return { level: 1, updatedAt: 0 } as unknown as Building
}

describe('buildingWindowPositions', () => {
  it('без построек — пусто', () => {
    expect(buildingWindowPositions(undefined)).toEqual([])
    expect(buildingWindowPositions({})).toEqual([])
  })

  it('только для построенных зданий из списка «светящихся»', () => {
    const buildings: Partial<Record<BuildingKey, Building>> = {
      bld_house: stubBuilding(),
      bld_silo: stubBuilding(), // не в GLOWING_BUILDINGS
    }
    const positions = buildingWindowPositions(buildings)
    expect(positions).toHaveLength(1)
  })

  it('позиция смещена от центра постройки, не совпадает с ним', () => {
    const buildings: Partial<Record<BuildingKey, Building>> = { bld_diner: stubBuilding() }
    const [pos] = buildingWindowPositions(buildings)
    const base = BUILDING_LAYOUT.bld_diner!
    expect(pos).toBeDefined()
    expect(pos).not.toEqual(base)
    expect(pos![1]).toBeGreaterThan(base[1])
  })

  it('все ключи GLOWING_BUILDINGS построены → столько же позиций', () => {
    const buildings: Partial<Record<BuildingKey, Building>> = {}
    for (const key of GLOWING_BUILDINGS) buildings[key] = stubBuilding()
    expect(buildingWindowPositions(buildings)).toHaveLength(GLOWING_BUILDINGS.length)
  })
})
