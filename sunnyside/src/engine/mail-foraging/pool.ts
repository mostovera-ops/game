/**
 * engine/mail-foraging/pool.ts — пул позиций-кандидатов Каталога почтой
 * (08-mail-foraging §3.1.1/§3.1.4). Из этого пула `rotation.ts` детерминированно
 * набирает недельную витрину (12 позиций). Ключи товаров (`itemKey`) — реальные
 * `ProductKey` семян T3–T5 (`data/catalogs/ingredients.ts`) плюс `decor_*`/`tool_*`
 * ключи каталога (косметика/расходники, §3.1.1) — они не переработка-ингредиенты,
 * поэтому живут собственным неймингом этого модуля (ProductKey = string, канон §3
 * не фиксирует префикс расходников каталога).
 *
 * ЦЕНЫ — ориентир из §3.1.4 (гипотезы до калибровки `14-economy.md`); при расхождении
 * с `14-economy.md` истина там, обновляются числа здесь, НЕ формулы `rotation.ts`.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net/state — чистые данные, node-тестируемо.
 */

import type { Bilingual } from '@/types'
import type { ProductKey } from '@/types'
import type { CurrencyKey } from '@/types'
import type { CatalogCategory } from './constants'

/** Тир редких семян (для гарантий разнообразия §3.1.6). Только для `rare_seeds`. */
export type SeedTier = 3 | 4 | 5

/** Одна позиция-кандидат каталога. `key` = `itemKey` заказа (что придёт в ящик). */
export interface MailCatalogItem {
  key: ProductKey
  category: CatalogCategory
  name: Bilingual
  price: number
  currency: CurrencyKey
  /** Тир — только у `rare_seeds` (нужен для гарантий §3.1.6). */
  tier?: SeedTier
}

/**
 * Пул кандидатов. Для anti-repeat (§3.1.6, кулдаун ≥1 неделя) и гарантий тиров пул
 * держится заведомо шире недельной выборки: rare_seeds ≥ 5+запас (T3 и T4–T5),
 * decor ≥ 4+запас, tools ≥ 3+запас.
 */
export const MAIL_CATALOG_POOL: readonly MailCatalogItem[] = [
  // ── Rare Seeds (5 из 12) — семена T3–T5 (§3.1.1), премия к открытию штата (§3.1.4) ──
  { key: 'seed_cherry', category: 'rare_seeds', name: { en: 'Cherry Seed', ru: 'Семена вишни' }, price: 55, currency: 'bucks', tier: 3 },
  { key: 'seed_pumpkin', category: 'rare_seeds', name: { en: 'Pumpkin Seed', ru: 'Семена тыквы' }, price: 60, currency: 'bucks', tier: 3 },
  { key: 'seed_butternut_squash', category: 'rare_seeds', name: { en: 'Butternut Squash Seed', ru: 'Семена мускатной тыквы' }, price: 58, currency: 'bucks', tier: 3 },
  { key: 'seed_sweet_potato', category: 'rare_seeds', name: { en: 'Sweet Potato Seed', ru: 'Семена батата' }, price: 62, currency: 'bucks', tier: 3 },
  { key: 'seed_snap_peas', category: 'rare_seeds', name: { en: 'Snap Peas Seed', ru: 'Семена сахарного горошка' }, price: 50, currency: 'bucks', tier: 3 },
  { key: 'crop_georgia_peach', category: 'rare_seeds', name: { en: 'Georgia Peach Sapling', ru: 'Саженец персика Джорджии' }, price: 340, currency: 'bucks', tier: 4 },
  { key: 'crop_vidalia_sweet_onion', category: 'rare_seeds', name: { en: 'Vidalia Onion Sets', ru: 'Севок сладкого лука Видалия' }, price: 210, currency: 'bucks', tier: 4 },
  { key: 'crop_okra', category: 'rare_seeds', name: { en: 'Okra Seed', ru: 'Семена окры' }, price: 180, currency: 'bucks', tier: 4 },
  { key: 'crop_hatch_green_chili', category: 'rare_seeds', name: { en: 'Hatch Chili Seed', ru: 'Семена чили Хэтч' }, price: 195, currency: 'bucks', tier: 4 },
  { key: 'crop_california_vanilla_bean', category: 'rare_seeds', name: { en: 'Vanilla Orchid', ru: 'Орхидея ванили' }, price: 40, currency: 'dimes', tier: 5 },
  { key: 'crop_maine_wild_blueberry', category: 'rare_seeds', name: { en: 'Wild Blueberry Cutting', ru: 'Черенок дикой черники' }, price: 420, currency: 'bucks', tier: 5 },
  { key: 'crop_california_meyer_lemon', category: 'rare_seeds', name: { en: 'Meyer Lemon Tree', ru: 'Деревце лимона Мейера' }, price: 460, currency: 'bucks', tier: 5 },

  // ── Decor (4 из 12) — косметика двора (§3.1.1), bucks + премиум-dimes (§3.1.4) ──
  { key: 'decor_weathervane_rooster', category: 'decor', name: { en: 'Rooster Weathervane', ru: 'Флюгер-петух' }, price: 120, currency: 'bucks' },
  { key: 'decor_flowerbed_petunias', category: 'decor', name: { en: 'Petunia Flowerbed', ru: 'Клумба петуний' }, price: 90, currency: 'bucks' },
  { key: 'decor_hand_signpost', category: 'decor', name: { en: 'Hand-painted Signpost', ru: 'Расписной указатель' }, price: 75, currency: 'bucks' },
  { key: 'decor_neon_googie_sign', category: 'decor', name: { en: 'Googie Neon Sign', ru: 'Неоновая вывеска Googie' }, price: 25, currency: 'dimes' },
  { key: 'decor_tiki_torches', category: 'decor', name: { en: 'Tiki Torch Set', ru: 'Набор тики-факелов' }, price: 18, currency: 'dimes' },
  { key: 'decor_xmas_garland', category: 'decor', name: { en: 'Xmas-55 Garland', ru: 'Гирлянда Xmas-55' }, price: 110, currency: 'bucks' },
  { key: 'decor_pumpkin_stack', category: 'decor', name: { en: 'Pumpkin Stack', ru: 'Тыквенная горка' }, price: 85, currency: 'bucks' },

  // ── Tools (3 из 12) — разовые расходники (§3.1.1), только bucks (§3.1.4) ──
  { key: 'tool_golden_sprinkle', category: 'tools', name: { en: 'Golden Sprinkle Can', ru: 'Лейка «Golden Sprinkle»' }, price: 60, currency: 'bucks' },
  { key: 'tool_fertilizer_sack', category: 'tools', name: { en: 'Fertilizer Sack (10 uses)', ru: 'Мешок удобрения (10 применений)' }, price: 80, currency: 'bucks' },
  { key: 'tool_silo_boost', category: 'tools', name: { en: 'Silo Boost Token', ru: 'Разовый буст силоса' }, price: 45, currency: 'bucks' },
  { key: 'tool_growth_tonic', category: 'tools', name: { en: 'Growth Tonic', ru: 'Тоник роста' }, price: 55, currency: 'bucks' },
  { key: 'tool_pest_repellent', category: 'tools', name: { en: 'Pest Repellent', ru: 'Средство от вредителей' }, price: 40, currency: 'bucks' },
]

/** Индекс `itemKey → позиция` (быстрый lookup категории/цены для адаптера/UI). */
const POOL_INDEX: ReadonlyMap<ProductKey, MailCatalogItem> = new Map(
  MAIL_CATALOG_POOL.map((it) => [it.key, it]),
)

/** Позиция каталога по `itemKey`, либо `undefined` для неизвестного ключа. */
export function catalogItemOf(itemKey: ProductKey): MailCatalogItem | undefined {
  return POOL_INDEX.get(itemKey)
}

/** Категория товара по `itemKey` (для тайминга доставки/лимитов), либо `undefined`. */
export function catalogCategoryOf(itemKey: ProductKey): CatalogCategory | undefined {
  return POOL_INDEX.get(itemKey)?.category
}
