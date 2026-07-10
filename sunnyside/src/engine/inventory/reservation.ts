/**
 * engine/inventory/reservation.ts — резервирование стока под очереди крафта (02-farm §3.11,
 * 04-machines: `CraftSystem.start` списывает вход рецепта). Чистая бухгалтерия ledger'а: не
 * трогает сеть/сервер, только предотвращает клиентское двойное резервирование одного и того
 * же стока несколькими одновременно открытыми панелями крафта до подтверждения сервера.
 *
 * ГРАНИЦА: ноль three/react/net — чистые структуры данных, node-тестируемо.
 */

import type { ProductKey, Result, UUID } from '@/types'

interface ReservationRecord {
  id: UUID
  itemKey: ProductKey
  qty: number
}

/** uuid v4 без внешней зависимости (crypto доступен в node ≥18 и во всех браузерах-целях). */
function makeId(): UUID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Фолбэк для окружений без crypto.randomUUID (не криптостойкий, но уникальный для сессии).
  return `resv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

/** Ledger резервов: itemKey → сумма зарезервированного qty + список записей по id. */
export class ReservationLedger {
  private readonly records = new Map<UUID, ReservationRecord>()
  private readonly totals = new Map<ProductKey, number>()

  /** Суммарно зарезервировано данного предмета прямо сейчас. */
  reservedQty(itemKey: ProductKey): number {
    return this.totals.get(itemKey) ?? 0
  }

  /**
   * Резервирует `qty` предмета, если `availableQty` (всего на складе) минус уже
   * зарезервированное покрывает запрос. `availableQty` — снапшот с сервера (кэш);
   * система не считает это истиной начисления, только предохраняет UI от овербукинга.
   */
  reserve(itemKey: ProductKey, qty: number, availableQty: number): Result<UUID, 'insufficient_stock'> {
    if (qty <= 0) {
      return { ok: false, error: 'insufficient_stock' }
    }
    const already = this.reservedQty(itemKey)
    const free = availableQty - already
    if (free < qty) {
      return { ok: false, error: 'insufficient_stock' }
    }
    const id = makeId()
    this.records.set(id, { id, itemKey, qty })
    this.totals.set(itemKey, already + qty)
    return { ok: true, value: id }
  }

  /** Освобождает резерв по id (крафт стартовал/отменён/подтверждён сервером). `false`, если не найден. */
  release(reservationId: UUID): boolean {
    const rec = this.records.get(reservationId)
    if (!rec) return false
    this.records.delete(reservationId)
    const current = this.reservedQty(rec.itemKey)
    const next = current - rec.qty
    if (next <= 0) {
      this.totals.delete(rec.itemKey)
    } else {
      this.totals.set(rec.itemKey, next)
    }
    return true
  }

  /** Полная очистка (reconnect/logout). */
  clear(): void {
    this.records.clear()
    this.totals.clear()
  }
}
