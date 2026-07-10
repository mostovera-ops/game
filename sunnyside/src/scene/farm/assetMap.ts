/**
 * assetMap.ts — чистые мапперы «доменный ключ → id заглушки реестра»
 * (`src/assets/placeholders/registry.ts`, 22-audio-visual §7).
 *
 * ЗАЧЕМ: сцена рисует ТОЛЬКО через заглушки по реестру (никаких своих мешей). Домен
 * оперирует своими ключами (`ProductKey`, `AnimalKind`, `MachineKey`, тир грядки), а
 * реестр — своими id (`crop_*`, `an_*`, `mch_*`, `plot_field_*`). Этот модуль — тонкий
 * детерминированный перевод между ними, вынесенный из компонентов ради node-тестов.
 *
 * ГРАНИЦА: чистые функции, ноль three/react. Импортирует только `@/types` (типы домена).
 */

import type { ProductKey } from '@/types'
import type { AnimalKind } from '@/types'
import type { MachineKey } from '@/types'

/** id заглушек грядки по тиру (02-farm §3.3): Basic→Tilled→Raised→Irrigated. */
export const PLOT_ASSET_BY_TIER = [
  'plot_field_basic',
  'plot_field_tilled',
  'plot_field_raised',
  'plot_field_irrigated',
] as const

export type PlotAssetId = (typeof PLOT_ASSET_BY_TIER)[number] | 'plot_orchard'

/** id заглушки грядки по её тиру (0..3); вне диапазона → базовая. Орчард — отдельный слот. */
export function plotAssetId(tier: number, orchard = false): PlotAssetId {
  if (orchard) return 'plot_orchard'
  const t = Math.max(0, Math.min(PLOT_ASSET_BY_TIER.length - 1, Math.floor(tier)))
  return PLOT_ASSET_BY_TIER[t] ?? 'plot_field_basic'
}

/** Культуры, заведённые в мастер-реестре заглушек (`crop_*`). Источник истины — registry. */
export const KNOWN_CROP_ASSETS = new Set<string>([
  'crop_tomato',
  'crop_lettuce',
  'crop_potato',
  'crop_wheat',
  'crop_corn',
  'crop_strawberry',
  'crop_cherry',
  'crop_peach',
])

/** Фолбэк-культура, если конкретный ключ ещё не заведён в реестре (заметно, но не ломает). */
export const CROP_ASSET_FALLBACK = 'crop_tomato'

/**
 * `ProductKey` посева/урожая → id заглушки культуры. Нормализует `seed_*`→`crop_*`,
 * достраивает голый ключ до `crop_*`. Пустой ключ (пустая грядка) → null (крест не рисуем).
 * Неизвестная культура → фолбэк (видно, что заглушка ещё не заведена — 22-av V3).
 */
export function cropAssetId(key: ProductKey | undefined): string | null {
  if (key === undefined || key === '') return null
  let id = key
  if (id.startsWith('seed_')) id = `crop_${id.slice('seed_'.length)}`
  else if (!id.startsWith('crop_')) id = `crop_${id}`
  return KNOWN_CROP_ASSETS.has(id) ? id : CROP_ASSET_FALLBACK
}

/** Вид животного → id заглушки (`an_*`). registry-converge: `an_sheep` заведён в мастер-реестре
 * (`src/assets/placeholders/registry.ts`), стенд-ин индюком больше не нужен. */
export const ANIMAL_ASSET_BY_KIND: Record<AnimalKind, string> = {
  chicken: 'an_hen',
  cow: 'an_cow',
  pig: 'an_pig',
  goat: 'an_goat',
  bee: 'an_bee',
  sheep: 'an_sheep',
}

export function animalAssetId(kind: AnimalKind): string {
  return ANIMAL_ASSET_BY_KIND[kind] ?? 'an_hen'
}

/** Станки, заведённые в реестре (`mch_*`). Ключ станка — свободная строка (types/machines). */
export const KNOWN_MACHINE_ASSETS = new Set<string>([
  'mch_grill',
  'mch_oven',
  'mch_fryer',
  'mch_churn',
  'mch_smoker',
  'mch_mill',
  'mch_coffee',
  'mch_ice_cream',
  'mch_soda_fountain',
  'mch_steam_kettle',
])

export const MACHINE_ASSET_FALLBACK = 'mch_grill'

/** `MachineKey` → id заглушки станка. Неизвестный станок → фолбэк (гриль). */
export function machineAssetId(key: MachineKey): string {
  return KNOWN_MACHINE_ASSETS.has(key) ? key : MACHINE_ASSET_FALLBACK
}
