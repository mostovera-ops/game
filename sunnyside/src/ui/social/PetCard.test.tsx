/**
 * @vitest-environment jsdom
 *
 * PetCard.test.tsx — переименование + ласка-подарок (03-animals §5 `ui_pet_card`).
 * Мокаем `AnimalSystem` (DI) — компонент не ходит в сеть сам (AGENTS.md §0.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { AnimalSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import type { FarmSnapshot, InventorySnapshot } from '@/types'
import { PetCard } from './PetCard'
import { AnimalSystemProvider } from './AnimalSystemContext'

function makeAnimalSystem(overrides: Partial<AnimalSystem> = {}): AnimalSystem {
  return {
    feed: vi.fn(async () => ({ ok: true, data: { fed: 0 } }) as never),
    collect: vi.fn(async () => ({ ok: true, data: { items: [] } }) as never),
    rename: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    gift: vi.fn(async () => ({ ok: true, data: { affection: 2 } }) as never),
    ...overrides,
  }
}

const farmWithAnimal: FarmSnapshot = {
  farmId: 'farm_me',
  farmLevel: 1,
  plots: [],
  buildings: {},
  machines: [],
  animals: [
    { version: 1, id: 'an_1', kind: 'cow', housing: 'bld_barn', name: 'Bessie', affection: 2, productKey: 'prod_milk' },
  ],
  farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
}

const inventoryWithFeed: InventorySnapshot = {
  items: { feed_hay: 3 },
  stacks: [{ key: 'feed_hay', qty: 3, quality: 1, itemClass: 'feed' }],
  limits: { silo: 100, icehouse: 100, general: 100 },
}

describe('PetCard (03-animals §5 ui_pet_card)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, farm: null, inventory: null })
  })

  it('пустая ферма — показывает пустое состояние', () => {
    render(
      <AnimalSystemProvider value={makeAnimalSystem()}>
        <PetCard />
      </AnimalSystemProvider>,
    )
    expect(screen.getByTestId('pet-card-empty')).toBeTruthy()
  })

  it('рендерит имя и звёзды affection питомца', () => {
    useStore.setState({ farm: farmWithAnimal })
    render(
      <AnimalSystemProvider value={makeAnimalSystem()}>
        <PetCard />
      </AnimalSystemProvider>,
    )
    expect(screen.getByTestId('pet-name-an_1').textContent).toContain('Bessie')
    expect(screen.getByTestId('pet-affection-stars').textContent).toBe('★★☆☆☆')
  })

  it('переименование вызывает AnimalSystem.rename(animalId, name)', async () => {
    useStore.setState({ farm: farmWithAnimal })
    const animals = makeAnimalSystem()
    render(
      <AnimalSystemProvider value={animals}>
        <PetCard />
      </AnimalSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('pet-name-an_1'))
    const input = screen.getByTestId('pet-name-input-an_1')
    fireEvent.change(input, { target: { value: 'Bessie Jr' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pet-name-save-an_1'))
    })
    expect(animals.rename).toHaveBeenCalledWith('an_1', 'Bessie Jr')
  })

  it('подарок-ласка вызывает AnimalSystem.gift(animalId, giftKey)', async () => {
    useStore.setState({ farm: farmWithAnimal, inventory: inventoryWithFeed })
    const animals = makeAnimalSystem()
    render(
      <AnimalSystemProvider value={animals}>
        <PetCard />
      </AnimalSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('pet-gift-pick-an_1'), { target: { value: 'feed_hay' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pet-gift-btn-an_1'))
    })
    expect(animals.gift).toHaveBeenCalledWith('an_1', 'feed_hay')
  })
})
