/**
 * ui/kitchen/catalog.ts — read-only lookups поверх контент-каталогов (`@/data/catalogs`)
 * для оверлеев кухни/склада (K1–K3, F4). Презентационный слой: имена/тиры/цены для
 * рендера карточек. НЕ источник игровых правил — те живут в `engine/craft`,
 * `engine/inventory` (см. AGENTS.md §0.3: клиент не считает награду/лимиты сам).
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ читает @/types и @/data (контент, read-only, как и
 * `engine/craft/catalog.ts`), ноль three/@react-three/@/net.
 */
import { recipes } from '@/data/catalogs/recipes'
import { machines } from '@/data/catalogs/machines'
import { ingredients } from '@/data/catalogs/ingredients'
import type { Recipe, Machine, Ingredient } from '@/data/schema'
import type { Locale, MachineKey, ProductKey, RecipeKey } from '@/types'

const recipeByKey = new Map<RecipeKey, Recipe>(recipes.map((r) => [r.key, r]))
const machineByKey = new Map<MachineKey, Machine>(machines.map((m) => [m.key, m]))
const ingredientByKey = new Map<ProductKey, Ingredient>(ingredients.map((i) => [i.key, i]))

export function recipeContent(key: RecipeKey): Recipe | undefined {
  return recipeByKey.get(key)
}

export function machineContent(key: MachineKey): Machine | undefined {
  return machineByKey.get(key)
}

export function ingredientContent(key: ProductKey): Ingredient | undefined {
  return ingredientByKey.get(key)
}

/** Все рецепты каталога, готовящиеся на данном станке (порядок каталога — детерминирован). */
export function recipesForMachine(machineKey: MachineKey): Recipe[] {
  return recipes.filter((r) => r.machineKey === machineKey)
}

/** Локализованная подпись продукта; незнакомый ключ каталога — падаем обратно на сам ключ (dev-заметность, C8-подобно). */
export function productLabel(key: ProductKey, locale: Locale = 'ru'): string {
  return ingredientContent(key)?.name[locale] ?? key
}

export function machineLabel(key: MachineKey, locale: Locale = 'ru'): string {
  return machineContent(key)?.name[locale] ?? key
}

export function recipeLabel(key: RecipeKey, locale: Locale = 'ru'): string {
  return recipeContent(key)?.name[locale] ?? key
}

/**
 * Статус доступности рецепта для UI Recipe Box (K2 таб Unlocked/Locked/Secret).
 *
 * ЭВРИСТИКА ПРЕЗЕНТАЦИИ, не истина сервера: `ProgressionSnapshot` (13-progression) пока
 * не несёт список фактически открытых рецептов — только `farmLevel`. Для `kind:'level'`
 * это ровно правило спеки (unlock.farmLevel ≤ текущий); `kind:'state'` (экспедиционный
 * стейт) консервативно считаем locked без данных о пройденных стейтах;
 * `kind:'experiment'` — секретка. TODO(progression): заменить на реальный
 * список открытых рецептов, когда снапшот его понесёт.
 */
export type RecipeAvailability = 'unlocked' | 'locked' | 'secret'

export function recipeAvailability(recipe: Recipe, farmLevel: number): RecipeAvailability {
  switch (recipe.unlock.kind) {
    case 'starter':
      return 'unlocked'
    case 'level':
      return farmLevel >= recipe.unlock.farmLevel ? 'unlocked' : 'locked'
    case 'state':
      return 'locked'
    case 'experiment':
      return 'secret'
    default:
      return 'locked'
  }
}
