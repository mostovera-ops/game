/**
 * collections.ts — игрушки, открытки, ленты, косметика (17-collections, canon §3.10/§3.11).
 * Престиж и самовыражение. Σ(косметика+коллекции) в Farm Value капится 15%.
 */

import type { UUID } from './common'
import type { StateKey } from './expeditions'
import type { ContestKey } from './fair'

/** Серии игрушек Prize Machine (canon §3.10). 5 серий. */
export type ToySeriesKey =
  | 'toy_highway_dinos'
  | 'toy_cosmos_57'
  | 'toy_route_critters'
  | 'toy_chrome_rockets'
  | 'toy_diner_mascots'

export const TOY_SERIES_KEYS: readonly ToySeriesKey[] = [
  'toy_highway_dinos',
  'toy_cosmos_57',
  'toy_route_critters',
  'toy_chrome_rockets',
  'toy_diner_mascots',
] as const

/** Собранная игрушка (ui_toy_shelf). */
export interface Toy {
  key: string // toy_<series>_<n>
  series: ToySeriesKey
  owned: boolean
  duplicate: number
}

/** Косметик-сеты (canon §3.11). Скины: дайнер/грузовик/стафф/вывеска/интерьер. */
export type CosmeticKey = 'cos_googie' | 'cos_chrome' | 'cos_tiki' | 'cos_xmas_55'

export const COSMETIC_KEYS: readonly CosmeticKey[] = [
  'cos_googie',
  'cos_chrome',
  'cos_tiki',
  'cos_xmas_55',
] as const

export type CosmeticTarget = 'diner' | 'truck' | 'staff' | 'sign' | 'interior'

export interface Cosmetic {
  key: CosmeticKey
  owned: boolean
  appliedTo: CosmeticTarget[]
}

/** Открытка «Greetings from…» (mech_greetings_postcard). 1/штат/ивент; полный сет → бафф. */
export interface Postcard {
  key: string
  stateKey?: StateKey
  owned: boolean
}

/** Лента (🎀 Blue Ribbon с конкурсов). Только витрина/декор (canon §2.1). */
export interface Ribbon {
  id: UUID
  contestKey: ContestKey
  weekIndex: number
  rank: number
}

/** Анимация неоновой вывески (17-collections §3.7). Постоянное/мигание — база, волна — премиум. */
export type NeonAnimationKey = 'steady' | 'blink' | 'chase'

/**
 * Конфиг неоновой вывески (`player_neon_sign`, 17-collections §3.7/§8 таблица
 * `letters_json`/`pictogram_ids`/`color_ids`/`animation_key`). До 3 строк текста,
 * до 14 символов в строке (гипотеза спеки, зависит от модели фасада).
 */
export interface NeonSignConfig {
  lines: string[] // ≤3 строки, ≤14 символов каждая
  pictogramIds: string[]
  colorIds: string[]
  animation: NeonAnimationKey
}

/** Одна сохранённая фотография Kodachrome (`ui_photo_mode`, галерея профиля). */
export interface CollectionPhoto {
  id: string
  url: string
  takenAt: number
  filterKey: string
  frameKey: string
}

/** Снапшот коллекций (collections-слайс). */
export interface CollectionsSnapshot {
  toys: Record<string, Toy>
  cosmetics: Partial<Record<CosmeticKey, Cosmetic>>
  postcards: Postcard[]
  ribbons: Ribbon[]
  /** Ключи разблокированных ачивок (Achievement Wall, 17-collections §3.5) — источник истины сервер. */
  achievementsUnlocked?: string[]
  /** Подмножество разблокированных, физически повешенных в интерьере (`Hang`, C6). */
  achievementsHung?: string[]
  /** Кэш «готовили N раз» по рецепту (Recipe Box mastery, R18) — инкремент сервера при `craft_collect`. */
  recipeMastery?: Record<string, number>
  /** Текущая сохранённая вывеска (Neon Builder, §3.7). `null`/отсутствие — вывеска ещё не собрана. */
  neonSign?: NeonSignConfig | null
  /** Галерея Kodachrome (`ui_photo_mode`) — снимки, сохранённые игроком. */
  photos?: CollectionPhoto[]
}
