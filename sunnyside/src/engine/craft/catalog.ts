/**
 * engine/craft/catalog.ts — lookup-обёртки над контент-каталогами (`@/data/catalogs`)
 * для системы крафта. Чистые индексы по ключу; каталоги read-only (владелец —
 * content-агенты recipes/machines, см. AGENTS.md §2 — мы их только читаем).
 */
import { recipes } from '@/data/catalogs/recipes'
import { machines } from '@/data/catalogs/machines'
import type { Recipe, Machine } from '@/data/schema'
import type { ProductKey, RecipeKey, MachineKey } from '@/types'

const recipesByKey = new Map<RecipeKey, Recipe>(recipes.map((r) => [r.key, r]))
const machinesByKey = new Map<MachineKey, Machine>(machines.map((m) => [m.key, m]))

/** Индекс output.key → первый производящий его рецепт каталога (порядок каталога — детерминирован). */
const producerByOutput = new Map<ProductKey, Recipe>()
for (const recipe of recipes) {
  if (!producerByOutput.has(recipe.output.key)) producerByOutput.set(recipe.output.key, recipe)
}

export function getRecipe(key: RecipeKey): Recipe | undefined {
  return recipesByKey.get(key)
}

export function getMachineDef(key: MachineKey): Machine | undefined {
  return machinesByKey.get(key)
}

/** Рецепт каталога, который производит данный продукт как output (для разворота цепочек). */
export function findProducerRecipe(outputKey: ProductKey): Recipe | undefined {
  return producerByOutput.get(outputKey)
}
