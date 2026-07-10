/**
 * inventory.test.ts — юниты склада: лимиты Silo/Icehouse, апгрейд, резервирование под
 * крафт, переполнение → буфер (canon E3, 02-farm §3.11/§4.4). Node, без three/network.
 */

import { describe, it, expect } from 'vitest'
import {
  siloCapacity,
  icehouseCapacity,
  storageUpgradeCost,
  ReservationLedger,
  addWithOverflow,
  isOverflowExpired,
  OVERFLOW_BUFFER_MS,
  createInventorySystem,
} from './index'

describe('siloCapacity / icehouseCapacity — §4.4 base + step·(level−1)', () => {
  it('таблица уровней 1..10 совпадает со спекой', () => {
    const expectedSilo = [500, 780, 1060, 1340, 1620, 1900, 2180, 2460, 2740, 3020]
    const expectedIcehouse = [200, 340, 480, 620, 760, 900, 1040, 1180, 1320, 1460]
    for (let level = 1; level <= 10; level++) {
      expect(siloCapacity(level)).toBe(expectedSilo[level - 1])
      expect(icehouseCapacity(level)).toBe(expectedIcehouse[level - 1])
    }
  })

  it('уровень <1 или дробный — бросает ошибку (защита от мусора)', () => {
    expect(() => siloCapacity(0)).toThrow()
    expect(() => siloCapacity(-1)).toThrow()
    expect(() => siloCapacity(1.5)).toThrow()
    expect(() => icehouseCapacity(0)).toThrow()
  })
})

describe('storageUpgradeCost — §4.4 round(200·1.32^(level−1), −10)', () => {
  it('таблица уровней 2..10 совпадает со спекой', () => {
    const expected = [260, 350, 460, 610, 800, 1060, 1400, 1840, 2430]
    for (let level = 2; level <= 10; level++) {
      expect(storageUpgradeCost(level)).toBe(expected[level - 2])
    }
  })

  it('уровень 1 — старт, бесплатно', () => {
    expect(storageUpgradeCost(1)).toBe(0)
  })

  it('монотонно растёт', () => {
    expect(storageUpgradeCost(5)).toBeGreaterThan(storageUpgradeCost(4))
    expect(storageUpgradeCost(10)).toBeGreaterThan(storageUpgradeCost(9))
  })
})

describe('ReservationLedger — резервирование под очереди крафта', () => {
  it('резервирует, если свободного стока хватает', () => {
    const ledger = new ReservationLedger()
    const res = ledger.reserve('crop_wheat', 10, 20)
    expect(res.ok).toBe(true)
    expect(ledger.reservedQty('crop_wheat')).toBe(10)
  })

  it('отказывает, если свободного (за вычетом уже зарезервированного) не хватает', () => {
    const ledger = new ReservationLedger()
    ledger.reserve('crop_wheat', 15, 20)
    const second = ledger.reserve('crop_wheat', 10, 20) // 20-15=5 свободно, просят 10
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toBe('insufficient_stock')
    expect(ledger.reservedQty('crop_wheat')).toBe(15) // второй резерв не применился
  })

  it('не даёт задвоить резерв двумя конкурентными очередями крафта сверх наличного стока', () => {
    const ledger = new ReservationLedger()
    const a = ledger.reserve('ingr_flour', 8, 10)
    const b = ledger.reserve('ingr_flour', 8, 10) // 10-8=2 свободно, просят 8 → отказ
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(false)
  })

  it('release освобождает резерв и позволяет зарезервировать заново', () => {
    const ledger = new ReservationLedger()
    const res = ledger.reserve('egg', 5, 5)
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(ledger.release(res.value)).toBe(true)
    expect(ledger.reservedQty('egg')).toBe(0)
    const again = ledger.reserve('egg', 5, 5)
    expect(again.ok).toBe(true)
  })

  it('release неизвестного id — false, без побочных эффектов', () => {
    const ledger = new ReservationLedger()
    expect(ledger.release('does-not-exist')).toBe(false)
  })

  it('qty ≤ 0 — отказ', () => {
    const ledger = new ReservationLedger()
    expect(ledger.reserve('crop_wheat', 0, 100).ok).toBe(false)
    expect(ledger.reserve('crop_wheat', -3, 100).ok).toBe(false)
  })
})

describe('addWithOverflow — переполнение склада (canon E3)', () => {
  it('помещается целиком, если под лимитом — overflow отсутствует', () => {
    const r = addWithOverflow('silo', 'crop_wheat', 50, 3, 400, 500, 1_000)
    expect(r.stored).toBe(50)
    expect(r.overflow).toBeNull()
  })

  it('ровно на лимите — без overflow', () => {
    const r = addWithOverflow('silo', 'crop_wheat', 100, 3, 400, 500, 1_000)
    expect(r.stored).toBe(100)
    expect(r.overflow).toBeNull()
  })

  it('превышение — излишек уходит в overflow-запись с 24ч таймером', () => {
    const now = 10_000
    const r = addWithOverflow('icehouse', 'crop_tomato', 80, 4, 450, 500, now)
    expect(r.stored).toBe(50) // влезло только до лимита
    expect(r.overflow).not.toBeNull()
    expect(r.overflow?.qty).toBe(30) // 80-50 излишек
    expect(r.overflow?.itemKey).toBe('crop_tomato')
    expect(r.overflow?.kind).toBe('icehouse')
    expect(r.overflow?.createdAt).toBe(now)
    expect(r.overflow?.expiresAt).toBe(now + OVERFLOW_BUFFER_MS)
  })

  it('склад уже переполнен (currentQty > limit) — весь новый сбор в overflow, sтored=0', () => {
    const r = addWithOverflow('silo', 'crop_wheat', 20, 2, 550, 500, 0)
    expect(r.stored).toBe(0)
    expect(r.overflow?.qty).toBe(20)
  })

  it('qty ≤ 0 — no-op', () => {
    const r = addWithOverflow('silo', 'crop_wheat', 0, 3, 100, 500, 0)
    expect(r.stored).toBe(0)
    expect(r.overflow).toBeNull()
  })

  it('isOverflowExpired: до истечения 24ч — false, после — true', () => {
    const now = 0
    const r = addWithOverflow('silo', 'crop_wheat', 600, 3, 400, 500, now)
    const entry = r.overflow
    expect(entry).not.toBeNull()
    if (!entry) throw new Error('unreachable')
    expect(isOverflowExpired(entry, now + OVERFLOW_BUFFER_MS - 1)).toBe(false)
    expect(isOverflowExpired(entry, now + OVERFLOW_BUFFER_MS)).toBe(true)
    expect(isOverflowExpired(entry, now + OVERFLOW_BUFFER_MS + 1)).toBe(true)
  })
})

describe('createInventorySystem — сборка InventorySystem', () => {
  it('storageLimits использует §4.4 формулы, general — не лимитируется', () => {
    const sys = createInventorySystem()
    const limits = sys.storageLimits(3, 2)
    expect(limits.silo).toBe(1060)
    expect(limits.icehouse).toBe(340)
    expect(limits.general).toBe(Number.POSITIVE_INFINITY)
  })

  it('upgradeCost делегирует в мастер-формулу', () => {
    const sys = createInventorySystem()
    expect(sys.upgradeCost(4)).toBe(460)
  })

  it('freeCapacity — простая разница лимит-занято, не уходит в минус', () => {
    const sys = createInventorySystem()
    expect(sys.freeCapacity('silo', 400, 500)).toBe(100)
    expect(sys.freeCapacity('silo', 600, 500)).toBe(0)
  })

  it('reserve/release/reservedQty работают через инстанс системы', () => {
    const sys = createInventorySystem()
    const res = sys.reserve('crop_wheat', 5, 10)
    expect(res.ok).toBe(true)
    expect(sys.reservedQty('crop_wheat')).toBe(5)
    if (res.ok) expect(sys.release(res.value)).toBe(true)
    expect(sys.reservedQty('crop_wheat')).toBe(0)
  })

  it('add копит overflow во внутреннем буфере; sweepExpiredOverflow вычищает просроченное', () => {
    const sys = createInventorySystem()
    const t0 = 0
    const { overflow } = sys.add('silo', 'crop_wheat', 120, 3, 450, 500, t0)
    expect(overflow).not.toBeNull()
    expect(sys.listOverflow()).toHaveLength(1)

    // До истечения 24ч — sweep ничего не забирает.
    expect(sys.sweepExpiredOverflow(t0 + OVERFLOW_BUFFER_MS - 1)).toHaveLength(0)
    expect(sys.listOverflow()).toHaveLength(1)

    // После истечения — запись уходит (Potluck/подарок), список пустеет.
    const swept = sys.sweepExpiredOverflow(t0 + OVERFLOW_BUFFER_MS)
    expect(swept).toHaveLength(1)
    expect(swept[0]?.qty).toBe(70)
    expect(sys.listOverflow()).toHaveLength(0)
  })

  it('add без переполнения не создаёт overflow-запись', () => {
    const sys = createInventorySystem()
    const { stored, overflow } = sys.add('icehouse', 'crop_tomato', 10, 3, 0, 200, 0)
    expect(stored).toBe(10)
    expect(overflow).toBeNull()
    expect(sys.listOverflow()).toHaveLength(0)
  })
})
