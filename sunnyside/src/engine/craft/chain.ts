/**
 * engine/craft/chain.ts — цепочки полуфабрикатов (04-machines.md §3.5): рецепт может
 * требовать вход, который сам является output другого рецепта каталога (Мука → Тесто →
 * Корж → Пирог, §3.5/§4.4). Чистые функции: разворачивание цепочки и проверка стока.
 */
import type { ProductKey, RecipeKey } from '@/types'
import { getRecipe, findProducerRecipe } from './catalog'

export interface MissingInput {
  key: ProductKey
  need: number
  have: number
  short: number
}

/**
 * Каких входов не хватает на складе для одной постановки рецепта (batch партий, §3.3
 * «Постановка в очередь мгновенно списывает сырьё... если сырья не хватает — слот
 * недоступен»). Пустой массив = рецепт можно ставить в очередь прямо сейчас.
 */
export function missingInputs(
  recipeKey: RecipeKey,
  inventory: Partial<Record<ProductKey, number>>,
  batch = 1,
): MissingInput[] {
  const recipe = getRecipe(recipeKey)
  if (!recipe) return []
  const safeBatch = Math.max(1, batch)
  const shortages: MissingInput[] = []
  for (const input of recipe.inputs) {
    const need = input.qty * safeBatch
    const have = inventory[input.key] ?? 0
    if (have < need) shortages.push({ key: input.key, need, have, short: need - have })
  }
  return shortages
}

/**
 * Разворачивает цепочку полуфабрикатов рецепта bottom-up: сначала рецепты, чьи выходы
 * нужны как вход (рекурсивно, по каждому недостающему звену цепочки), последним
 * элементом — сам `recipeKey`. Пример (04-machines.md §3.5, сквозная цепочка выпечки):
 * `rcp_ingr_flour` (Wheat→Мука) → `rcp_ingr_basic_dough` (→Тесто) →
 * `rcp_ingr_pie_crust_basic` (→Корж) → `rcp_apple_pie` (→Пирог).
 * Сырьё (крупа/животный продукт без рецепта-производителя) не разворачивается дальше.
 * Защита от циклов — общий `seen` для всего обхода (рекурсия не проходит по ключу дважды).
 */
export function resolveChain(recipeKey: RecipeKey, seen: Set<RecipeKey> = new Set()): RecipeKey[] {
  if (seen.has(recipeKey)) return []
  seen.add(recipeKey)
  const recipe = getRecipe(recipeKey)
  if (!recipe) return []

  const chain: RecipeKey[] = []
  for (const input of recipe.inputs) {
    const producer = findProducerRecipe(input.key)
    if (!producer || seen.has(producer.key)) continue
    for (const step of resolveChain(producer.key, seen)) {
      if (!chain.includes(step)) chain.push(step)
    }
  }
  chain.push(recipeKey)
  return chain
}
