/**
 * ui/market/format.ts — чистые презентационные хелперы для доски спроса и прилавка
 * (19-ui-ux §3.6 W6, §3.4 R2; 09-fair; 14-economy). НИКАКИХ расчётов экономики —
 * только форматирование уже готовых чисел из стора/движка (AGENTS.md §0.3).
 */

import type { DemandCategory } from '@/types'

/** RU/EN-подписи известных категорий спроса (14-economy §3.6, 09-fair §4.2). Незнакомый
 * ключ — мягкий фолбэк из самого ключа, чтобы новая категория не ломала экран. */
const CATEGORY_LABELS: Record<string, { ru: string; en: string }> = {
  garden: { ru: 'Овощи с грядки', en: 'Garden produce' },
  dairy: { ru: 'Молочное', en: 'Dairy' },
  meat: { ru: 'Мясо', en: 'Meat' },
  bakery: { ru: 'Выпечка', en: 'Bakery' },
  drinks: { ru: 'Напитки', en: 'Drinks' },
  preserves: { ru: 'Консервы', en: 'Preserves' },
  sweets: { ru: 'Сладости', en: 'Sweets' },
  seafood: { ru: 'Морепродукты', en: 'Seafood' },
  cat_grill: { ru: 'Гриль', en: 'Grill' },
  cat_bakery: { ru: 'Выпечка и десерты', en: 'Bakery & Desserts' },
  cat_drinks: { ru: 'Напитки', en: 'Drinks' },
  cat_produce: { ru: 'Овощи и гарниры', en: 'Produce & Sides' },
}

/** Человекочитаемая подпись категории спроса; неизвестный ключ — из самого ключа. */
export function categoryLabel(category: DemandCategory, ru: boolean): string {
  const known = CATEGORY_LABELS[category]
  if (known) return ru ? known.ru : known.en
  return category.replace(/^cat_/, '').replace(/_/g, ' ')
}

/** Стрелка направления спроса относительно нейтрали 1.0 (19-ui-ux §3.6 «▲/▼/±0»). */
export function demandArrow(mult: number): '▲' | '▼' | '±0' {
  if (mult > 1.005) return '▲'
  if (mult < 0.995) return '▼'
  return '±0'
}

/** Процент отклонения множителя спроса от нейтрали 1.0, со знаком («+25%», «−15%»). */
export function demandPercent(mult: number): string {
  const pct = Math.round((mult - 1) * 100)
  if (pct === 0) return '0%'
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

/** Денежная строка `$N` (округление до целого — витрина, не бухгалтерия). */
export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('ru-RU')}`
}
