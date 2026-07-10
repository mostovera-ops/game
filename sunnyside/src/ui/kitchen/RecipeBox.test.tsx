/**
 * @vitest-environment jsdom
 *
 * RecipeBox.test.tsx — рендер + фильтры + клик "Готовить" (K2/K3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { CraftSystem } from '@/engine/contracts'
import { recipes } from '@/data/catalogs/recipes'
import { useStore } from '@/state'
import { RecipeBox } from './RecipeBox'
import { CraftSystemProvider } from './CraftSystemContext'

function makeCraftSystem(overrides: Partial<CraftSystem> = {}): CraftSystem {
  return {
    start: vi.fn(async () => ({ ok: true, data: { job: {} } }) as never),
    collect: vi.fn(async () => ({ ok: true, data: { items: [], masteryDelta: 0 } }) as never),
    experiment: vi.fn(async () => ({ ok: true, data: { result: null } }) as never),
    ...overrides,
  }
}

// Первый рецепт каталога, открытый с самого начала ('starter' | 'level' 1) — детерминированный якорь для теста.
const starterRecipe = recipes.find((r) => r.unlock.kind === 'starter' || (r.unlock.kind === 'level' && r.unlock.farmLevel <= 1))
if (!starterRecipe) throw new Error('фикстура теста: в каталоге должен быть хотя бы один стартовый рецепт')

describe('RecipeBox (K2/K3)', () => {
  beforeEach(() => {
    useStore.getState().setFarm({
      farmId: 'farm_1',
      farmLevel: 1,
      plots: [],
      buildings: {},
      animals: [],
      farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
      machines: [{ id: 'mch_inst_1', key: starterRecipe.machineKey, level: 1, jobs: [] }],
    })
    const items: Record<string, number> = {}
    for (const input of starterRecipe.inputs) items[input.key] = input.qty
    useStore.getState().setInventory({ items, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
  })

  it('показывает открытые рецепты по умолчанию', () => {
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <RecipeBox />
      </CraftSystemProvider>,
    )
    expect(screen.getByTestId('recipe-box')).toBeTruthy()
    expect(screen.getByTestId(`recipe-card-${starterRecipe.key}`)).toBeTruthy()
  })

  it('переключение на таб Locked меняет список карточек', () => {
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <RecipeBox />
      </CraftSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('recipe-box-tab-locked'))
    expect(screen.queryByTestId(`recipe-card-${starterRecipe.key}`)).toBeNull()
  })

  it('клик "Готовить" вызывает CraftSystem.start для станка машины', async () => {
    const craft = makeCraftSystem()
    render(
      <CraftSystemProvider value={craft}>
        <RecipeBox machineId="mch_inst_1" />
      </CraftSystemProvider>,
    )
    const card = screen.getByTestId(`recipe-card-${starterRecipe.key}`)
    const cookBtn = card.querySelector('[data-testid="recipe-cook-btn"]') as HTMLButtonElement
    expect(cookBtn.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(cookBtn)
    })
    expect(craft.start).toHaveBeenCalledWith('mch_inst_1', starterRecipe.key, 1)
  })

  it('onClose вызывается по клику на Закрыть', () => {
    const onClose = vi.fn()
    render(
      <CraftSystemProvider value={makeCraftSystem()}>
        <RecipeBox onClose={onClose} />
      </CraftSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('recipe-box-close'))
    expect(onClose).toHaveBeenCalled()
  })
})
