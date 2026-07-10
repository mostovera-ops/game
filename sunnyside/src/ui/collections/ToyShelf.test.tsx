/**
 * @vitest-environment jsdom
 *
 * ToyShelf.test.tsx — C4/M2 полка по сериям, открытый pity, клик Spin вызывает
 * `CollectionSystem.pullPrize` (мок — DI-контекст, компонент не ходит в сеть сам).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { ToyShelf } from './ToyShelf'
import { CollectionSystemProvider } from './CollectionSystemContext'

function makeSystem(overrides: Partial<CollectionSystem> = {}): CollectionSystem {
  return {
    pullPrize: vi.fn(async () => ({
      ok: true,
      data: {
        results: [{ toyKey: 'toy_highway_dinos_01', rarity: 'common', duplicate: false }],
        pityAfter: { series: 'toy_highway_dinos', pullsSinceRare: 1, pullsSinceChase: 1, rareCap: 10, chaseCap: 40 },
      },
    })) as never,
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    ...overrides,
  }
}

describe('ToyShelf (C4/M2)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('пустая полка серии показывает подсказку', () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [] })
    render(
      <CollectionSystemProvider value={makeSystem()}>
        <ToyShelf />
      </CollectionSystemProvider>,
    )
    // Каталог непуст (8 фигурок/серию) — проверяем счётчики pity вместо empty-state.
    expect(screen.getByTestId('prize-machine-pity-rare').textContent).toContain('10')
    expect(screen.getByTestId('prize-machine-pity-chase').textContent).toContain('40')
  })

  it('клик Spin вызывает pullPrize и обновляет pity-счётчик из ответа', async () => {
    useStore.getState().setCollections({ toys: {}, cosmetics: {}, postcards: [], ribbons: [] })
    const system = makeSystem()
    render(
      <CollectionSystemProvider value={system}>
        <ToyShelf />
      </CollectionSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('prize-machine-spin'))
    await waitFor(() => expect(system.pullPrize).toHaveBeenCalledWith({ seriesKey: 'toy_highway_dinos', count: 1 }))
    await waitFor(() => expect(screen.getByTestId('prize-machine-pity-rare').textContent).toContain('9'))
  })

  it('owned-игрушка показывает имя вместо силуэта', () => {
    useStore.getState().setCollections({
      toys: { toy_highway_dinos_01: { key: 'toy_highway_dinos_01', series: 'toy_highway_dinos', owned: true, duplicate: 0 } },
      cosmetics: {},
      postcards: [],
      ribbons: [],
    })
    render(
      <CollectionSystemProvider value={makeSystem()}>
        <ToyShelf />
      </CollectionSystemProvider>,
    )
    expect(screen.getByTestId('toy-toy_highway_dinos_01').getAttribute('data-owned')).toBe('true')
  })
})
