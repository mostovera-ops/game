/**
 * @vitest-environment jsdom
 *
 * StorageOverlay.test.tsx — рендер лимитов Silo/Icehouse, индикация переполнения, клики
 * Gift/Potluck/Upgrade (F4). `InventorySystem` — реальная фабрика движка (чистая логика,
 * без сети) — тестируем интеграцию компонент↔engine/inventory, не мокаем контракт.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createInventorySystem } from '@/engine/inventory'
import { useStore } from '@/state'
import { StorageOverlay } from './StorageOverlay'
import { InventorySystemProvider } from './InventorySystemContext'

describe('StorageOverlay (F4)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' } })
    useStore.getState().setFarm({
      farmId: 'farm_1',
      farmLevel: 1,
      plots: [],
      buildings: { bld_silo: { key: 'bld_silo', level: 1, version: 1 }, bld_icehouse: { key: 'bld_icehouse', level: 1, version: 1 } },
      animals: [],
      farmValue: { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 },
      machines: [],
    })
  })

  it('показывает лимиты Silo/Icehouse (Ур.1 — 500/200, §4.4)', () => {
    useStore.getState().setInventory({ items: { crop_wheat: 100 }, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    render(
      <InventorySystemProvider value={createInventorySystem()}>
        <StorageOverlay />
      </InventorySystemProvider>,
    )
    expect(screen.getByTestId('storage-shelf-silo').textContent).toMatch(/100 \/ 500/)
    expect(screen.getByTestId('storage-shelf-icehouse').textContent).toMatch(/0 \/ 200/)
  })

  it('переполнение силоса подсвечивается (data-overflowing=true), без штрафа/потери товара', () => {
    useStore.getState().setInventory({ items: { crop_wheat: 999 }, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    render(
      <InventorySystemProvider value={createInventorySystem()}>
        <StorageOverlay />
      </InventorySystemProvider>,
    )
    const shelf = screen.getByTestId('storage-shelf-silo')
    expect(shelf.getAttribute('data-overflowing')).toBe('true')
    // Товар всё ещё виден на полке (canon E3 — не сгорает).
    expect(shelf.textContent).toMatch(/999/)
  })

  it('фильтр по виду хранилища скрывает остальные полки', () => {
    useStore.getState().setInventory({ items: { crop_wheat: 10 }, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    render(
      <InventorySystemProvider value={createInventorySystem()}>
        <StorageOverlay />
      </InventorySystemProvider>,
    )
    fireEvent.click(screen.getByTestId('storage-kind-tab-silo'))
    expect(screen.getByTestId('storage-shelf-silo')).toBeTruthy()
    expect(screen.queryByTestId('storage-shelf-icehouse')).toBeNull()
  })

  it('клик Подарить вызывает onGiftNeighbor с ключом и количеством товара', () => {
    useStore.getState().setInventory({ items: { crop_wheat: 10 }, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    const onGiftNeighbor = vi.fn()
    render(
      <InventorySystemProvider value={createInventorySystem()}>
        <StorageOverlay onGiftNeighbor={onGiftNeighbor} />
      </InventorySystemProvider>,
    )
    fireEvent.click(screen.getByTestId('storage-gift-crop_wheat'))
    expect(onGiftNeighbor).toHaveBeenCalledWith('crop_wheat', 10)
  })

  it('клик Расширить вызывает onUpgrade с видом хранилища', () => {
    useStore.getState().setInventory({ items: {}, stacks: [], limits: { silo: 500, icehouse: 200, general: Infinity } })
    const onUpgrade = vi.fn()
    render(
      <InventorySystemProvider value={createInventorySystem()}>
        <StorageOverlay onUpgrade={onUpgrade} />
      </InventorySystemProvider>,
    )
    fireEvent.click(screen.getByTestId('storage-upgrade-silo'))
    expect(onUpgrade).toHaveBeenCalledWith('silo')
  })
})
