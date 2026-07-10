/**
 * engine/expedition/catalog.ts — lookup-обёртки над контент-каталогами
 * (`@/data/catalogs/states`, `@/data/catalogs/postcards`) для системы экспедиций.
 * Чистые индексы по ключу; каталоги read-only (владелец — content-агент, AGENTS.md §2).
 */
import { states } from '@/data/catalogs/states'
import { postcards } from '@/data/catalogs/postcards'
import type { StateContent, PostcardDef } from '@/data/schema'
import type { StateKey } from '@/types'

const statesByKey = new Map<StateKey, StateContent>(states.map((s) => [s.key, s]))
const postcardsByState = new Map<StateKey, PostcardDef>(
  postcards.filter((p) => p.stateKey).map((p) => [p.stateKey as StateKey, p]),
)

export function getStateContent(key: StateKey): StateContent | undefined {
  return statesByKey.get(key)
}

export function getPostcardForState(stateKey: StateKey): PostcardDef | undefined {
  return postcardsByState.get(stateKey)
}

/** Порядок лестницы роуд-трипа (0 = st_home), из `routeSlot` каталога (§3.1). */
export function getRouteSlot(key: StateKey): number | undefined {
  return statesByKey.get(key)?.routeSlot
}

/** Все ключи волны 1, отсортированные по `routeSlot` (лестница открытия, §3.1). */
export function orderedStateKeys(): StateKey[] {
  return [...states].sort((a, b) => (a.routeSlot ?? 0) - (b.routeSlot ?? 0)).map((s) => s.key)
}
