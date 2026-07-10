/**
 * @vitest-environment jsdom
 *
 * SeedPicker.test.tsx — F1 Seed Picker (farm-ui-seams). Мокаем узкий `SeedSystem`
 * (`Pick<FarmSystem,'sow'>`, DI через `FarmSystemContext`) — компонент не ходит в сеть
 * сам (AGENTS.md §0.3), сеет ЧЕРЕЗ адаптер (мок здесь играет его роль).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useStore } from '@/state'
import { SeedPicker } from './SeedPicker'
import { FarmSystemProvider, type SeedSystem } from './FarmSystemContext'

function makeFarmSystem(overrides: Partial<SeedSystem> = {}): SeedSystem {
  return {
    sow: vi.fn(async () => ({ ok: true, data: { plot: {} } }) as never),
    ...overrides,
  }
}

describe('SeedPicker (F1)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru', seedPickerSlot: null } })
  })

  it('не рендерится, пока ui.seedPickerSlot === null', () => {
    const { container } = render(
      <FarmSystemProvider value={makeFarmSystem()}>
        <SeedPicker />
      </FarmSystemProvider>,
    )
    expect(container.querySelector('[data-testid="seed-picker"]')).toBeNull()
  })

  it('открывается, показывает сетку культур', () => {
    useStore.getState().setSeedPickerSlot(2)
    render(
      <FarmSystemProvider value={makeFarmSystem()}>
        <SeedPicker />
      </FarmSystemProvider>,
    )
    expect(screen.getByTestId('seed-picker')).toBeTruthy()
    expect(screen.getByTestId('seed-picker-option-seed_tomato')).toBeTruthy()
  })

  it('клик по культуре сеет ЧЕРЕЗ FarmSystem.sow с правильным слотом и закрывает оверлей', async () => {
    useStore.getState().setSeedPickerSlot(3)
    const farm = makeFarmSystem()
    render(
      <FarmSystemProvider value={farm}>
        <SeedPicker />
      </FarmSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('seed-picker-option-seed_wheat'))
    expect(farm.sow).toHaveBeenCalledWith(3, 'seed_wheat')
    await waitFor(() => expect(useStore.getState().ui.seedPickerSlot).toBeNull())
  })

  it('при отказе адаптера оверлей остаётся открытым (можно попробовать снова)', async () => {
    useStore.getState().setSeedPickerSlot(1)
    const farm = makeFarmSystem({
      sow: vi.fn(async () => ({ ok: false, error: { code: 'insufficient_funds', message: 'нет денег' } }) as never),
    })
    render(
      <FarmSystemProvider value={farm}>
        <SeedPicker />
      </FarmSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('seed-picker-option-seed_tomato'))
    await waitFor(() => expect(farm.sow).toHaveBeenCalled())
    expect(useStore.getState().ui.seedPickerSlot).toBe(1)
  })

  it('крестик закрывает оверлей без посева', () => {
    useStore.getState().setSeedPickerSlot(0)
    const farm = makeFarmSystem()
    render(
      <FarmSystemProvider value={farm}>
        <SeedPicker />
      </FarmSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('seed-picker-close'))
    expect(useStore.getState().ui.seedPickerSlot).toBeNull()
    expect(farm.sow).not.toHaveBeenCalled()
  })
})
