/**
 * @vitest-environment jsdom
 *
 * NeonBuilder.test.tsx — C8 редактирование строк/пиктограмм, Save вызывает
 * `CollectionSystem.saveNeon` и кэширует конфиг в сторе (мок системы — DI).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CollectionSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { NeonBuilder } from './NeonBuilder'
import { CollectionSystemProvider } from './CollectionSystemContext'

function makeSystem(overrides: Partial<CollectionSystem> = {}): CollectionSystem {
  return {
    pullPrize: vi.fn(async () => ({ ok: true, data: { results: [], pityAfter: { series: 'toy_highway_dinos', pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 } } })) as never,
    purchaseDecor: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    placeDecor: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    saveNeon: vi.fn(async () => ({ ok: true, data: undefined })) as never,
    ...overrides,
  }
}

describe('NeonBuilder (C8)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, collections: null })
  })

  it('редактирует первую строку текста (обрезка ≤14 символов, uppercase)', () => {
    render(
      <CollectionSystemProvider value={makeSystem()}>
        <NeonBuilder />
      </CollectionSystemProvider>,
    )
    const input = screen.getByTestId('neon-line-0') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'grandma diner' } })
    expect(input.value).toBe('GRANDMA DINER')
  })

  it('клик Save вызывает saveNeon и кэширует конфиг в collections.neonSign', async () => {
    const system = makeSystem()
    render(
      <CollectionSystemProvider value={system}>
        <NeonBuilder />
      </CollectionSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('neon-color-teal'))
    fireEvent.click(screen.getByTestId('neon-builder-save'))
    await waitFor(() => expect(system.saveNeon).toHaveBeenCalled())
    await waitFor(() => expect(useStore.getState().collections?.neonSign?.colorIds).toContain('teal'))
  })

  it('пиктограмма переключается кликом (aria-pressed)', () => {
    render(
      <CollectionSystemProvider value={makeSystem()}>
        <NeonBuilder />
      </CollectionSystemProvider>,
    )
    const star = screen.getByTestId('neon-pictogram-star')
    expect(star.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(star)
    expect(star.getAttribute('aria-pressed')).toBe('true')
  })
})
