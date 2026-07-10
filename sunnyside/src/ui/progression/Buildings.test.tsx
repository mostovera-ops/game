/**
 * @vitest-environment jsdom
 *
 * Buildings.test.tsx — рендер + клик "Улучшить" + гейт House (F3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { FarmSnapshot } from '@/types'
import { useStore } from '@/state'
import { Buildings } from './Buildings'
import { BuildingsSystemProvider, type BuildingsSystem } from './BuildingsSystemContext'

function makeBuildingsSystem(overrides: Partial<BuildingsSystem> = {}): BuildingsSystem {
  return {
    upgradeBuilding: vi.fn(async () => ({ ok: true, data: { upgradeReadyAt: 0 } }) as never),
    ...overrides,
  }
}

const baseFarm: FarmSnapshot = {
  farmId: 'farm_1',
  farmLevel: 3,
  plots: [],
  buildings: {
    bld_house: { version: 1, key: 'bld_house', level: 3 },
    bld_kitchen: { version: 1, key: 'bld_kitchen', level: 1 },
  },
  machines: [],
  animals: [],
  farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
}

describe('Buildings (F3)', () => {
  beforeEach(() => {
    useStore.getState().setFarm(structuredClone(baseFarm))
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('рендерит все 9 построек каталога', () => {
    render(
      <BuildingsSystemProvider value={makeBuildingsSystem()}>
        <Buildings />
      </BuildingsSystemProvider>,
    )
    expect(screen.getByTestId('buildings-panel')).toBeTruthy()
    expect(screen.getAllByTestId(/^building-row-/)).toHaveLength(9)
  })

  it('Kitchen Ур.1 → Ур.2 доступен (House Ур.3 не гейтит) и клик вызывает upgradeBuilding', async () => {
    const system = makeBuildingsSystem()
    render(
      <BuildingsSystemProvider value={system}>
        <Buildings />
      </BuildingsSystemProvider>,
    )
    const btn = screen.getByTestId('building-upgrade-bld_kitchen') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(system.upgradeBuilding).toHaveBeenCalledWith('bld_kitchen')
  })

  it('постройка на уровне Дома блокирует апгрейд (house-гейт, §3.3 P7)', () => {
    useStore.getState().setFarm({
      ...structuredClone(baseFarm),
      buildings: {
        bld_house: { version: 1, key: 'bld_house', level: 3 },
        bld_kitchen: { version: 1, key: 'bld_kitchen', level: 3 },
      },
    })
    render(
      <BuildingsSystemProvider value={makeBuildingsSystem()}>
        <Buildings />
      </BuildingsSystemProvider>,
    )
    const btn = screen.getByTestId('building-upgrade-bld_kitchen') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
