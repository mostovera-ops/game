/**
 * engine/expedition/lootTable.ts — лут-таблицы по штатам T3–T5 (§4.2).
 *
 * Числа (базовое кол-во/рейс, шанс попадания в слот) — дословно из §4.2 таблицы
 * `docs/specs/07-expeditions.md`. Продукт-ключи — `highlights` каталога
 * `@/data/catalogs/states.ts` (уже прошедшего ревью Фазы B), не выдумываются заново
 * здесь: `highlights[0]` = топ-строка (форс 100%, §4.2), `highlights[1]` = вторичная
 * вероятностная строка.
 *
 * Фрагменты рецептов («Deep-Dish», «Pecan Pie» …, §4.2/§4.3) — нейминг-кандидаты:
 * `06-recipes.md`/`ingredients.ts` пока не заводят отдельный `ItemClass` или реестр
 * ключей для «секреток» (D8) — `FRAGMENT_KEY` ниже вводит временный `ProductKey`
 * (`itemClass` по смыслу — `special`, canon `ingredients.ts` §ItemClass) для целей
 * этой лут-системы. TODO(content-agent, аналог 07-expeditions §8 O2): свести с
 * будущим реестром `06-recipes.md`/`ingredients.ts`, когда «секретки» получат
 * канон-ключи — здесь заменить одной строкой без правки формул.
 *
 * `st_home` (T1–T2, обучающий рейс) вне таблицы §4.2 (та начинается с T3) — задана
 * здесь как гипотеза этого модуля (оба хайлайта форс 100%, без фрагмента), не число
 * из спеки дословно.
 */
import type { ProductKey, StateKey, Tier } from '@/types'
import { getStateContent } from './catalog'

export interface LootRow {
  key: ProductKey
  tier: Tier
  /** Базовое количество за рейс (до `capacity_multiplier`, §4.2). */
  baseQty: number
  /** Шанс попадания в слот, 0..1. Форс-строка всегда эффективно 1 (см. `forced`). */
  chance: number
  /** Топ-строка стопа — форсится к 100% (§4.2, гарантия непустого рейса P3). */
  forced?: boolean
  /** Строка фрагмента секретного рецепта (§4.2/§4.3), не участвует в стандартном стекинге продукта. */
  isFragment?: boolean
}

const FRAGMENT_KEY: Partial<Record<StateKey, ProductKey>> = {
  st_illinois: 'frag_deep_dish',
  st_tennessee: 'frag_pecan_pie',
  st_georgia: 'frag_peach_cobbler',
  st_louisiana: 'frag_gumbo',
  st_texas: 'frag_texas_brisket',
  st_maine: 'frag_lobster_roll',
  st_california: 'frag_golden_state_sundae',
}

/** Шанс фрагмента (§4.2), индексировано по штату волны 1. */
const FRAGMENT_CHANCE: Partial<Record<StateKey, number>> = {
  st_illinois: 0.08,
  st_tennessee: 0.08,
  st_georgia: 0.07,
  st_louisiana: 0.07,
  st_texas: 0.07,
  st_maine: 0.06,
  st_california: 0.06,
}

/** Базовое кол-во/шанс вторичной строки, §4.2 (индекс = `highlights[1]`). */
const SECONDARY: Partial<Record<StateKey, { baseQty: number; chance: number }>> = {
  st_illinois: { baseQty: 5, chance: 0.60 },
  st_tennessee: { baseQty: 5, chance: 0.60 },
  st_georgia: { baseQty: 3, chance: 0.40 },
  st_louisiana: { baseQty: 4, chance: 0.45 },
  st_texas: { baseQty: 4, chance: 0.45 },
  st_maine: { baseQty: 3, chance: 0.35 },
  st_california: { baseQty: 3, chance: 0.35 },
}

/** Базовое кол-во форс топ-строки, §4.2. */
const PRIMARY_QTY: Partial<Record<StateKey, number>> = {
  st_illinois: 6,
  st_tennessee: 6,
  st_georgia: 6,
  st_louisiana: 6,
  st_texas: 6,
  st_maine: 4,
  st_california: 4,
}

const HOME_HIGHLIGHT_QTY = 3

/** Лут-таблица стопа (§4.2): [форс-топ-строка, вторичная, фрагмент] — либо только 2 для st_home. */
export function lootTableForState(stateKey: StateKey): LootRow[] {
  const content = getStateContent(stateKey)
  if (!content) return []

  if (stateKey === 'st_home') {
    return content.highlights.map((key) => ({ key, tier: content.tier, baseQty: HOME_HIGHLIGHT_QTY, chance: 1, forced: true }))
  }

  const [primaryKey, secondaryKey] = content.highlights
  const rows: LootRow[] = []
  if (primaryKey) {
    rows.push({ key: primaryKey, tier: content.tier, baseQty: PRIMARY_QTY[stateKey] ?? 6, chance: 1, forced: true })
  }
  const secondary = SECONDARY[stateKey]
  if (secondaryKey && secondary) {
    rows.push({ key: secondaryKey, tier: content.tier, baseQty: secondary.baseQty, chance: secondary.chance })
  }
  const fragmentKey = FRAGMENT_KEY[stateKey]
  const fragmentChance = FRAGMENT_CHANCE[stateKey]
  if (fragmentKey && fragmentChance !== undefined) {
    rows.push({ key: fragmentKey, tier: content.tier, baseQty: 1, chance: fragmentChance, isFragment: true })
  }
  return rows
}
