/**
 * engine/inventory — ЧИСТАЯ логика склада (02-farm §3.11/§4.4): лимиты Silo/Icehouse,
 * стоимость апгрейда, резервирование стока под очереди крафта, буфер перелива.
 *
 * ЧТО ЭТО НЕ ДЕЛАЕТ (анти-чит, AGENTS.md §0.3): не ходит в `BackendAdapter`, не решает,
 * сколько предметов реально на складе — это `InventorySnapshot` с сервера (кэш в
 * `state/inventory.ts`). Эта система — локальная бухгалтерия/предсказание для UI:
 * какой лимит покажет апгрейд, хватит ли стока на крафт до отправки RPC, куда девать
 * излишек сверх лимита до подтверждения сервера.
 *
 * Владелец: engine/inventory (см. AGENTS.md §2 карта владения). Реализует `InventorySystem`
 * из `engine/contracts.ts`.
 */

import type { InventorySystem, InventoryOverflowEntry } from '@/engine/contracts'
import type { EpochMs, ProductKey, Quality, Result, StorageKind, StorageLimits, UUID } from '@/types'

import { icehouseCapacity, siloCapacity, storageUpgradeCost } from './limits'
import { ReservationLedger } from './reservation'
import { addWithOverflow, isOverflowExpired } from './overflow'

export { siloCapacity, icehouseCapacity, storageUpgradeCost, roundToTen } from './limits'
export { ReservationLedger } from './reservation'
export { addWithOverflow, isOverflowExpired, makeOverflowEntry, OVERFLOW_BUFFER_MS } from './overflow'

/** Фабрика `InventorySystem`. Инстанс держит собственный (клиентский, non-persist) ledger резервов и буфер перелива. */
export function createInventorySystem(): InventorySystem {
  const ledger = new ReservationLedger()
  const overflow = new Map<UUID, InventoryOverflowEntry>()

  const system: InventorySystem = {
    storageLimits(siloLevel: number, icehouseLevel: number): StorageLimits {
      return {
        silo: siloCapacity(siloLevel),
        icehouse: icehouseCapacity(icehouseLevel),
        // general (декор/инструменты/семена и проч.) вне мастер-таблицы §4.4 — не лимитируется здесь.
        general: Number.POSITIVE_INFINITY,
      }
    },

    upgradeCost(level: number): number {
      return storageUpgradeCost(level)
    },

    freeCapacity(_kind: StorageKind, currentQty: number, limit: number): number {
      return Math.max(0, limit - currentQty)
    },

    reserve(itemKey: ProductKey, qty: number, availableQty: number): Result<UUID, 'insufficient_stock'> {
      return ledger.reserve(itemKey, qty, availableQty)
    },

    release(reservationId: UUID): boolean {
      return ledger.release(reservationId)
    },

    reservedQty(itemKey: ProductKey): number {
      return ledger.reservedQty(itemKey)
    },

    add(
      kind: StorageKind,
      itemKey: ProductKey,
      qty: number,
      quality: Quality,
      currentQty: number,
      limit: number,
      now: EpochMs,
    ): { stored: number; overflow: InventoryOverflowEntry | null } {
      const result = addWithOverflow(kind, itemKey, qty, quality, currentQty, limit, now)
      if (result.overflow) {
        overflow.set(result.overflow.id, result.overflow)
      }
      return result
    },

    listOverflow(): InventoryOverflowEntry[] {
      return Array.from(overflow.values())
    },

    sweepExpiredOverflow(now: EpochMs): InventoryOverflowEntry[] {
      const expired: InventoryOverflowEntry[] = []
      for (const entry of overflow.values()) {
        if (isOverflowExpired(entry, now)) {
          expired.push(entry)
        }
      }
      for (const entry of expired) {
        overflow.delete(entry.id)
      }
      return expired
    },
  }

  return system
}
