/**
 * net/local/catalog.ts — индексы контент-каталогов для LocalBackendAdapter.
 *
 * ЗАЧЕМ: локальный «сервер» валидирует мутации как настоящий (стоимость семени/рецепта,
 * тайминги роста/крафта/апгрейда, склад) — для этого ему нужен доступ к каноничным
 * числам из `src/data/catalogs/*`. Здесь строятся быстрые Map-индексы поверх этих
 * массивов (данные прошли ревью Фазы B; числа НЕ выдумываются, а читаются из каталогов).
 *
 * ГРАНИЦА: `net/` вне списка RULES страж-границ (scripts/check-boundaries.mjs) — может
 * импортировать `@/data`, `@/engine`, `@/types`. Ноль three/scene/ui.
 */

import type { Tier, Quality, ProductKey, StorageKind, ItemClass } from '@/types'
import type { CropDef, Recipe, Machine, BuildingDef } from '@/data/schema'
import { crops } from '@/data/catalogs/crops'
import { recipes, recipeCatalogMeta, secretRecipes, secretRecipeCatalogMeta } from '@/data/catalogs/recipes'
import { machines } from '@/data/catalogs/machines'
import { buildings } from '@/data/catalogs/buildings'
import { ingredients } from '@/data/catalogs/ingredients'
import type { Ingredient } from '@/data/schema'

// ── Опорные цены тира (canon §2.2 «Цена блюда, $») — fallback, когда предмета нет в
//    каталоге ингредиентов/рецептов (напр. экспедиционное сырьё без записи). ──────────
const TIER_REF_PRICE: Readonly<Record<Tier, number>> = { 1: 6, 2: 22, 3: 75, 4: 260, 5: 900 }

// ── Индексы ───────────────────────────────────────────────────────────────────────
const ingredientByKey = new Map<ProductKey, Ingredient>()
for (const ing of ingredients) ingredientByKey.set(ing.key, ing)

const cropBySeed = new Map<ProductKey, CropDef>()
const cropByCrop = new Map<ProductKey, CropDef>()
for (const c of crops) {
  cropBySeed.set(c.seedKey, c)
  cropByCrop.set(c.cropKey, c)
}

const allRecipes: Recipe[] = [...recipes, ...secretRecipes]
const recipeByKey = new Map<string, Recipe>()
for (const r of allRecipes) recipeByKey.set(r.key, r)

/** Ключ выходного продукта рецепта → сам рецепт (для инфо о готовом блюде/полуфабрикате). */
const recipeByOutput = new Map<ProductKey, Recipe>()
for (const r of allRecipes) {
  if (!recipeByOutput.has(r.output.key)) recipeByOutput.set(r.output.key, r)
}

const recipePriceByKey = new Map<string, { basePrice: number; demandCategory: string }>()
for (const m of [...recipeCatalogMeta, ...secretRecipeCatalogMeta]) {
  recipePriceByKey.set(m.recipeKey, { basePrice: m.basePrice, demandCategory: m.demandCategory })
}

const machineByKey = new Map<string, Machine>()
for (const mc of machines) machineByKey.set(mc.key, mc)

const buildingByKey = new Map<string, BuildingDef>()
for (const b of buildings) buildingByKey.set(b.key, b)

// ── Публичные лукапы ────────────────────────────────────────────────────────────────

export interface ProductInfo {
  key: ProductKey
  tier: Tier
  storage: StorageKind
  itemClass: ItemClass
  basePrice: number
  demandCategory: string
}

/**
 * Сводная информация о предмете: сперва каталог ингредиентов (сырьё/полуфабрикаты),
 * затем — вывод рецепта (готовые блюда `dish_*`, которых нет в ingredients.ts, см.
 * докстринг recipes.ts), затем tier-fallback. Никогда не кидает — локальный сервер
 * должен уметь оценить любой предмет.
 */
export function productInfo(key: ProductKey): ProductInfo {
  const ing = ingredientByKey.get(key)
  if (ing) {
    return {
      key,
      tier: ing.tier,
      storage: ing.storage,
      itemClass: ing.itemClass,
      basePrice: ing.basePrice,
      demandCategory: ing.demandCategory ?? 'garden',
    }
  }
  const rec = recipeByOutput.get(key)
  if (rec) {
    const meta = recipePriceByKey.get(rec.key)
    return {
      key,
      tier: rec.tier,
      storage: rec.output.itemClass === 'dish' ? 'general' : 'icehouse',
      itemClass: rec.output.itemClass,
      basePrice: meta?.basePrice ?? TIER_REF_PRICE[rec.tier],
      demandCategory: meta?.demandCategory ?? 'garden',
    }
  }
  return { key, tier: 1, storage: 'general', itemClass: 'material', basePrice: TIER_REF_PRICE[1], demandCategory: 'garden' }
}

/**
 * Маппинг категории спроса предмета (из каталогов — 'garden'/'baking'/'seafood'/…) в одну
 * из 4 мет Demand Board (cat_grill/cat_bakery/cat_drinks/cat_produce). Категории каталогов
 * богаче 4-метовой доски (расхождение спек 05/06 vs 14) — сводим коуничным маппингом.
 */
const CATEGORY_TO_META: Readonly<Record<string, string>> = {
  garden: 'cat_produce', produce: 'cat_produce', dairy: 'cat_produce', preserves: 'cat_produce',
  baking: 'cat_bakery', breakfasts: 'cat_bakery', sweets: 'cat_bakery', desserts: 'cat_bakery',
  drinks: 'cat_drinks', beverages: 'cat_drinks',
  grill: 'cat_grill', meat: 'cat_grill', seafood: 'cat_grill', southern_cuisine: 'cat_grill', sandwiches: 'cat_grill',
}

/**
 * Множитель спроса для предмета по доске недели. Доска — Record<meta, mult>; предмет
 * относим к мете по его demandCategory. Неизвестная категория → нейтральный 1.0.
 */
export function demandMultiplier(board: Record<string, number>, demandCategory: string): number {
  const meta = CATEGORY_TO_META[demandCategory] ?? demandCategory
  const mult = board[meta]
  return typeof mult === 'number' && mult > 0 ? mult : 1.0
}

export function cropForSeed(seedKey: ProductKey): CropDef | undefined {
  return cropBySeed.get(seedKey)
}

export function cropInfo(cropKey: ProductKey): CropDef | undefined {
  return cropByCrop.get(cropKey)
}

export function recipe(recipeKey: string): Recipe | undefined {
  return recipeByKey.get(recipeKey)
}

/** Цена продажи готового выхода рецепта ($) — для превью/начисления смены/ярмарки. */
export function recipeOutputPrice(recipeKey: string): number {
  const meta = recipePriceByKey.get(recipeKey)
  if (meta) return meta.basePrice
  const rec = recipeByKey.get(recipeKey)
  return rec ? TIER_REF_PRICE[rec.tier] : TIER_REF_PRICE[1]
}

export function machine(machineKey: string): Machine | undefined {
  return machineByKey.get(machineKey)
}

export function building(buildingKey: string): BuildingDef | undefined {
  return buildingByKey.get(buildingKey)
}

/** Качество урожая по affection/mastery — локальный сервер ставит базовое Common (1). */
export function defaultQuality(): Quality {
  return 1
}
