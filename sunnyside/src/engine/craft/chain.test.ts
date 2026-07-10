/**
 * chain.test.ts — цепочка Wheat→Flour→Dough→Pie (04-machines.md §3.5, сквозная
 * цепочка выпечки) поверх реального каталога `@/data/catalogs/recipes.ts`.
 */
import { describe, it, expect } from 'vitest'
import { missingInputs, resolveChain } from './chain'
import { getRecipe } from './catalog'

describe('resolveChain — цепочка полуфабрикатов (§3.5)', () => {
  it('Apple Pie разворачивается в Wheat→Flour→(Butter)→Dough→Crust→Pie', () => {
    // rcp_apple_pie ← ingr_pie_crust_basic ← ingr_basic_dough ← {ingr_flour(←crop_wheat), ingr_butter(←milk), egg}
    const chain = resolveChain('rcp_apple_pie')

    expect(chain).toEqual([
      'rcp_ingr_flour',
      'rcp_ingr_butter',
      'rcp_ingr_basic_dough',
      'rcp_ingr_pie_crust_basic',
      'rcp_apple_pie',
    ])
  })

  it('каждое звено цепочки — валидный рецепт каталога, идущий в порядке производства', () => {
    const chain = resolveChain('rcp_apple_pie')
    for (const key of chain) expect(getRecipe(key)).toBeDefined()

    // Мука готова раньше Теста, Тесто — раньше Коржа, Корж — раньше Пирога.
    const idx = (k: string) => chain.indexOf(k)
    expect(idx('rcp_ingr_flour')).toBeLessThan(idx('rcp_ingr_basic_dough'))
    expect(idx('rcp_ingr_basic_dough')).toBeLessThan(idx('rcp_ingr_pie_crust_basic'))
    expect(idx('rcp_ingr_pie_crust_basic')).toBeLessThan(idx('rcp_apple_pie'))
  })

  it('рецепт без полуфабрикатных входов (Farm Scramble — только яйца) — цепочка из одного звена', () => {
    expect(resolveChain('rcp_farm_scramble')).toEqual(['rcp_farm_scramble'])
  })

  it('неизвестный ключ рецепта → пустая цепочка (не бросает)', () => {
    expect(resolveChain('rcp_does_not_exist')).toEqual([])
  })

  it('защита от циклов: повторный запуск с уже посещённым seed не зацикливается', () => {
    const seen = new Set(['rcp_ingr_basic_dough'])
    // rcp_apple_pie всё равно резолвится, но веточка через basic_dough уже "посещена" —
    // цепочка не должна падать/висеть, а просто не развернёт этот участок повторно.
    expect(() => resolveChain('rcp_apple_pie', seen)).not.toThrow()
  })
})

describe('missingInputs — проверка стока перед постановкой в очередь (§3.3)', () => {
  it('пустой склад → не хватает обоих входов Apple Pie (Корж×1, Apple×3)', () => {
    const shortages = missingInputs('rcp_apple_pie', {})
    expect(shortages).toEqual([
      { key: 'ingr_pie_crust_basic', need: 1, have: 0, short: 1 },
      { key: 'crop_apple', need: 3, have: 0, short: 3 },
    ])
  })

  it('частичный сток → недостаёт только то, чего мало', () => {
    const shortages = missingInputs('rcp_apple_pie', { ingr_pie_crust_basic: 1, crop_apple: 1 })
    expect(shortages).toEqual([{ key: 'crop_apple', need: 3, have: 1, short: 2 }])
  })

  it('достаточный сток → пустой массив (рецепт можно ставить в очередь)', () => {
    expect(missingInputs('rcp_apple_pie', { ingr_pie_crust_basic: 2, crop_apple: 10 })).toEqual([])
  })

  it('batch множит требуемое количество', () => {
    const shortages = missingInputs('rcp_ingr_flour', {}, 3) // Wheat×2 на партию → ×3 = 6
    expect(shortages).toEqual([{ key: 'crop_wheat', need: 6, have: 0, short: 6 }])
  })

  it('неизвестный рецепт → пустой массив (нечего проверять)', () => {
    expect(missingInputs('rcp_does_not_exist', {})).toEqual([])
  })
})
