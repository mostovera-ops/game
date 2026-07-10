/**
 * catalogs/recipes.test.ts — валидация доп. экспортов каталога рецептов, которые НЕ
 * входят в `CONTENT_CATALOGS`/`validate.test.ts` (та проверяет только `recipes`):
 * `bluePlateSets` (BluePlateSchema), `recipeCatalogMeta`/`secretRecipeCatalogMeta`
 * (ссылочная целостность на `recipes`), `RECIPE_MASTERY_CURVE` (форма кривой R18).
 *
 * `recipes` сама (схема + уникальность ключей + межкаталожные ссылки) уже покрыта
 * `../validate.test.ts` через `CONTENT_CATALOGS` — здесь не дублируем.
 */

import { describe, it, expect } from 'vitest'
import {
  recipes,
  secretRecipes,
  bluePlateSets,
  recipeCatalogMeta,
  secretRecipeCatalogMeta,
  RECIPE_MASTERY_CURVE,
} from './recipes'
import { BluePlateSchema, assertUniqueKeys } from '../schema'

describe('recipes.ts — доп. экспорты (06-recipes.md §4.4/§4.5, R18)', () => {
  const recipeKeys = new Set(recipes.map((r) => r.key))

  it('bluePlateSets: 34 сета, валидны по BluePlateSchema, ключи уникальны', () => {
    expect(bluePlateSets.length).toBe(34)
    for (const set of bluePlateSets) {
      const res = BluePlateSchema.safeParse(set)
      expect(res.success, res.success ? '' : res.error?.toString()).toBe(true)
    }
    expect(() => assertUniqueKeys(bluePlateSets.map((s) => s.key), 'bluePlateSets')).not.toThrow()
  })

  it('bluePlateSets: main/side/drink каждого сета ссылаются на существующий рецепт', () => {
    for (const set of bluePlateSets) {
      expect(recipeKeys.has(set.main), `сет "${set.key}": main "${set.main}" не найден среди recipes`).toBe(true)
      expect(recipeKeys.has(set.side), `сет "${set.key}": side "${set.side}" не найден среди recipes`).toBe(true)
      expect(recipeKeys.has(set.drink), `сет "${set.key}": drink "${set.drink}" не найден среди recipes`).toBe(true)
    }
  })

  it('secretRecipes: 22 секретки, все входят в основной массив `recipes` и помечены unlock:experiment', () => {
    expect(secretRecipes.length).toBe(22)
    for (const sec of secretRecipes) {
      expect(sec.unlock.kind).toBe('experiment')
      expect(recipeKeys.has(sec.key), `секретка "${sec.key}" отсутствует в основном экспорте recipes`).toBe(true)
    }
  })

  it('recipeCatalogMeta: 112 записей (§4.2), каждая ссылается на существующий рецепт, basePrice > 0', () => {
    expect(recipeCatalogMeta.length).toBe(112)
    for (const meta of recipeCatalogMeta) {
      expect(recipeKeys.has(meta.recipeKey), `meta ссылается на несуществующий рецепт "${meta.recipeKey}"`).toBe(true)
      expect(meta.basePrice).toBeGreaterThan(0)
      expect(meta.demandCategory.length).toBeGreaterThan(0)
    }
  })

  it('secretRecipeCatalogMeta: 22 записи, каждая ссылается на существующую секретку', () => {
    expect(secretRecipeCatalogMeta.length).toBe(22)
    const secretKeys = new Set(secretRecipes.map((s) => s.key))
    for (const meta of secretRecipeCatalogMeta) {
      expect(secretKeys.has(meta.recipeKey), `meta ссылается на несуществующую секретку "${meta.recipeKey}"`).toBe(true)
    }
  })

  it('RECIPE_MASTERY_CURVE: 5 уровней ★1–★5, пороги и бонусы монотонны (R18 §3.3)', () => {
    expect(RECIPE_MASTERY_CURVE.length).toBe(5)
    expect(RECIPE_MASTERY_CURVE.map((t) => t.stars)).toEqual([1, 2, 3, 4, 5])
    expect(RECIPE_MASTERY_CURVE.map((t) => t.requiredCrafts)).toEqual([0, 10, 30, 75, 150])
    for (let i = 1; i < RECIPE_MASTERY_CURVE.length; i++) {
      const prev = RECIPE_MASTERY_CURVE[i - 1]!
      const cur = RECIPE_MASTERY_CURVE[i]!
      expect(cur.requiredCrafts).toBeGreaterThan(prev.requiredCrafts)
      expect(cur.timeBonusPct).toBeLessThan(prev.timeBonusPct)
      expect(cur.priceBonusPct).toBeGreaterThan(prev.priceBonusPct)
    }
  })

  it('каталог содержит R20-фикс: ingr_flour доступна с unlock starter (MVP), не гейтится за Mill', () => {
    const flour = recipes.find((r) => r.output.key === 'ingr_flour')
    expect(flour, 'ingr_flour должен существовать как Recipe (R20)').toBeTruthy()
    expect(flour?.unlock.kind).toBe('starter')
  })
})
