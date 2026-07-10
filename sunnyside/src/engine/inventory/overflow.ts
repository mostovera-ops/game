/**
 * engine/inventory/overflow.ts — буфер перелива склада при достижении лимита (canon E3,
 * 02-farm §3.11): сбор всё равно происходит, излишек уходит на 24ч (гипотеза) без штрафа,
 * затем — в Street Potluck / «Подарок соседям» (не сгорает впустую, но покидает личный инвентарь).
 *
 * ГРАНИЦА: ноль three/react/net — чистые функции, node-тестируемо.
 */

import type { EpochMs, ProductKey, Quality, StorageKind, UUID } from '@/types'
import type { InventoryOverflowEntry } from '@/engine/contracts'

/** Окно буфера перелива (02-farm §3.11 п.1 — гипотеза «24 ч»). */
export const OVERFLOW_BUFFER_MS = 24 * 60 * 60 * 1000

function makeId(): UUID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ovf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

/** Строит запись буфера перелива, стартующую 24ч-таймер от `now`. */
export function makeOverflowEntry(
  kind: StorageKind,
  itemKey: ProductKey,
  qty: number,
  quality: Quality,
  now: EpochMs,
): InventoryOverflowEntry {
  return {
    id: makeId(),
    kind,
    itemKey,
    qty,
    quality,
    createdAt: now,
    expiresAt: now + OVERFLOW_BUFFER_MS,
  }
}

/** Истёк ли конкретный буфер к моменту `now` (serverNow(), не Date.now() — вызывающий отвечает). */
export function isOverflowExpired(entry: InventoryOverflowEntry, now: EpochMs): boolean {
  return now >= entry.expiresAt
}

/**
 * Кладёт `qty` в хранилище с учётом `limit`: то, что не влезло сверх лимита, возвращается
 * отдельной overflow-записью (canon E3) вместо потери сбора. Отрицательный/нулевой qty —
 * no-op. `currentQty` сверх `limit` (не должно случаться штатно, но не паникуем) — весь
 * новый qty уходит в overflow.
 */
export function addWithOverflow(
  kind: StorageKind,
  itemKey: ProductKey,
  qty: number,
  quality: Quality,
  currentQty: number,
  limit: number,
  now: EpochMs,
): { stored: number; overflow: InventoryOverflowEntry | null } {
  if (qty <= 0) {
    return { stored: 0, overflow: null }
  }
  const room = Math.max(0, limit - currentQty)
  const stored = Math.min(qty, room)
  const overflowQty = qty - stored
  if (overflowQty <= 0) {
    return { stored, overflow: null }
  }
  return { stored, overflow: makeOverflowEntry(kind, itemKey, overflowQty, quality, now) }
}
