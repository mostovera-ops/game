import { describe, it, expect, vi } from 'vitest'
import {
  affectionPoints,
  affectionStar,
  qualityTier,
  qualityAdjustedPrice,
  secondaryDropChance,
  isSleepyPen,
  STORAGE_CAP,
  effectiveCycleMs,
  housingQualityMult,
  animalFarmValue,
  QUALITY_PRICE_MULTIPLIER,
} from './formulas'
import { createAnimalSystem } from './system'
import type { SystemContext } from '@/engine/contracts'
import type { RpcResult } from '@/types/common'

// ════════════════════════════════════════════════════════════════════════════
// affectionPoints / affectionStar (§3.3, §4.2)
// ════════════════════════════════════════════════════════════════════════════

describe('affectionPoints', () => {
  it('считает своевременные кормления по 2 очка', () => {
    expect(affectionPoints({ timelyFeeds: 10 })).toBe(20)
  })

  it('считает подкормку любимым кормом по 5 очков', () => {
    expect(affectionPoints({ favoriteFeedBonuses: 3 })).toBe(15)
  })

  it('считает подарки по 10 очков', () => {
    expect(affectionPoints({ gifts: 2 })).toBe(20)
  })

  it('суммирует все источники', () => {
    expect(affectionPoints({ timelyFeeds: 5, favoriteFeedBonuses: 2, gifts: 1 })).toBe(
      5 * 2 + 2 * 5 + 1 * 10,
    )
  })

  it('игнорирует отрицательные значения (защита от порчи входа)', () => {
    expect(affectionPoints({ timelyFeeds: -5 })).toBe(0)
  })

  it('пустой ввод даёт 0 очков', () => {
    expect(affectionPoints({})).toBe(0)
  })
})

describe('affectionStar', () => {
  it('минимум звезды — 1, даже при 0 очках (P3: никогда не падает ниже старта)', () => {
    expect(affectionStar(0)).toBe(1)
  })

  it('100 очков = 1★ порог перехода во 2★ не достигнут (floor)', () => {
    expect(affectionStar(99)).toBe(1)
    expect(affectionStar(100)).toBe(1)
  })

  it('200 очков = 2★', () => {
    expect(affectionStar(200)).toBe(2)
  })

  it('500 очков = 5★', () => {
    expect(affectionStar(500)).toBe(5)
  })

  it('клампится к 5★ сверху (перегруз очков не даёт "6 звёзд")', () => {
    expect(affectionStar(10_000)).toBe(5)
  })

  it('клампится к 1★ снизу для отрицательных очков', () => {
    expect(affectionStar(-50)).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// qualityTier (§4.2 — дословная формула ИЛИ, Blue Ribbon требует оба максимума)
// ════════════════════════════════════════════════════════════════════════════

describe('qualityTier', () => {
  it('Common по умолчанию (низкая звезда, низкое жильё, без стаффа)', () => {
    expect(qualityTier({ affectionStar: 1, housingLevel: 1 })).toBe(1)
  })

  it('Good от звезды 2★ при низком жилье', () => {
    expect(qualityTier({ affectionStar: 2, housingLevel: 1 })).toBe(2)
  })

  it('Good от жилья Ур.2+ при низкой звезде', () => {
    expect(qualityTier({ affectionStar: 1, housingLevel: 2 })).toBe(2)
  })

  it('Prime от звезды 4★ (без макс. жилья)', () => {
    expect(qualityTier({ affectionStar: 4, housingLevel: 1 })).toBe(3)
  })

  it('Prime от жилья Ур.4+ (без макс. звезды)', () => {
    expect(qualityTier({ affectionStar: 1, housingLevel: 4 })).toBe(3)
  })

  it('Prime от назначенного Field-стаффа на группу (без звезды/жилья)', () => {
    expect(qualityTier({ affectionStar: 1, housingLevel: 1, staffAssignedToGroup: true })).toBe(3)
  })

  it('Blue Ribbon ТОЛЬКО при обоих максимумах (5★ И жильё Ур.10)', () => {
    expect(qualityTier({ affectionStar: 5, housingLevel: 10 })).toBe(4)
  })

  it('5★ без макс. жилья — это Prime, не Blue Ribbon (не аддитивно)', () => {
    expect(qualityTier({ affectionStar: 5, housingLevel: 9 })).toBe(3)
  })

  it('макс. жильё без 5★ — это Prime, не Blue Ribbon', () => {
    expect(qualityTier({ affectionStar: 4, housingLevel: 10 })).toBe(3)
  })
})

describe('qualityAdjustedPrice', () => {
  it('множители точно из §3.5 (×1.0/×1.3/×1.7/×2.5)', () => {
    expect(QUALITY_PRICE_MULTIPLIER).toEqual({ 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.5 })
  })

  it('применяет множитель тира к базовой цене', () => {
    expect(qualityAdjustedPrice(10, 1)).toBeCloseTo(10)
    expect(qualityAdjustedPrice(10, 4)).toBeCloseTo(25)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// secondaryDropChance (§3.2 таблица + §3.3 веха 2★)
// ════════════════════════════════════════════════════════════════════════════

describe('secondaryDropChance', () => {
  it('базовый шанс Feather у кур — 8%', () => {
    expect(secondaryDropChance('chicken', 1)).toBeCloseTo(0.08)
  })

  it('базовый шанс Lard у свиней — 15%', () => {
    expect(secondaryDropChance('pig', 1)).toBeCloseTo(0.15)
  })

  it('базовый шанс Beeswax у пчёл — 20%', () => {
    expect(secondaryDropChance('bee', 1)).toBeCloseTo(0.2)
  })

  it('у коровы нет прямого вторичного дропа (масло/сыр — крафт)', () => {
    expect(secondaryDropChance('cow', 1)).toBe(0)
  })

  it('+5% при привязанности 2★+', () => {
    expect(secondaryDropChance('pig', 2)).toBeCloseTo(0.2)
    expect(secondaryDropChance('pig', 5)).toBeCloseTo(0.2)
  })

  it('без бонуса при 1★', () => {
    expect(secondaryDropChance('goat', 1)).toBeCloseTo(0.1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Storage Cap / Sleepy Pen (§4.4)
// ════════════════════════════════════════════════════════════════════════════

describe('isSleepyPen / STORAGE_CAP', () => {
  it('капы совпадают со спекой §4.4', () => {
    expect(STORAGE_CAP.chicken).toBe(12)
    expect(STORAGE_CAP.cow).toBe(6)
    expect(STORAGE_CAP.pig).toBe(5)
    expect(STORAGE_CAP.bee).toBe(4)
    expect(STORAGE_CAP.goat).toBe(4)
  })

  it('не Sleepy Pen ниже капа', () => {
    expect(isSleepyPen(11, 'chicken')).toBe(false)
  })

  it('Sleepy Pen ровно на капе (включительно)', () => {
    expect(isSleepyPen(12, 'chicken')).toBe(true)
  })

  it('Sleepy Pen выше капа', () => {
    expect(isSleepyPen(999, 'pig')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// effectiveCycleMs (§3.2)
// ════════════════════════════════════════════════════════════════════════════

describe('effectiveCycleMs', () => {
  it('без бонуса — базовый цикл в мс', () => {
    expect(effectiveCycleMs(20)).toBe(20 * 60_000)
  })

  it('применяет сокращение (Clara −15% §3.6)', () => {
    expect(effectiveCycleMs(45, 0.15)).toBe(Math.round(45 * 60_000 * 0.85))
  })

  it('клампит отрицательное сокращение к 0', () => {
    expect(effectiveCycleMs(20, -1)).toBe(20 * 60_000)
  })

  it('клампит чрезмерное сокращение (защита от нулевого/отрицательного таймера)', () => {
    expect(effectiveCycleMs(20, 1)).toBe(effectiveCycleMs(20, 0.8))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Farm Value (§4.5)
// ════════════════════════════════════════════════════════════════════════════

describe('housingQualityMult', () => {
  it('1.0 на уровнях 1–3', () => {
    expect(housingQualityMult(1)).toBe(1.0)
    expect(housingQualityMult(3)).toBe(1.0)
  })

  it('1.1 на уровнях 4–6', () => {
    expect(housingQualityMult(4)).toBe(1.1)
    expect(housingQualityMult(6)).toBe(1.1)
  })

  it('1.2 на уровнях 7–10', () => {
    expect(housingQualityMult(7)).toBe(1.2)
    expect(housingQualityMult(10)).toBe(1.2)
  })
})

describe('animalFarmValue', () => {
  it('T1 (Hen) при 1★ и жилье Ур.1 (§4.5 формула)', () => {
    expect(animalFarmValue(1, 1, 1)).toBeCloseTo(15 * (1 + 0.15 * 1) * 1.0)
  })

  it('T2 (Cow) при 5★ и жилье Ур.10 — максимальный вклад', () => {
    expect(animalFarmValue(2, 5, 10)).toBeCloseTo(35 * (1 + 0.15 * 5) * 1.2)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// createAnimalSystem — оркестрация через SystemContext.applyMutation (анти-чит)
// ════════════════════════════════════════════════════════════════════════════

function makeCtx(applyMutation: (...args: unknown[]) => Promise<RpcResult<unknown>>): SystemContext {
  return {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => 0,
    applyMutation: applyMutation as SystemContext['applyMutation'],
  }
}

describe('createAnimalSystem', () => {
  it('feed() шлёт мутацию feed_animal с payload {animalIds}', async () => {
    const applyMutation = vi.fn(
      async (): Promise<RpcResult<{ fed: number }>> => ({ ok: true, data: { fed: 2 } }),
    )
    const system = createAnimalSystem(makeCtx(applyMutation))
    const res = await system.feed(['a1', 'a2'])
    expect(applyMutation).toHaveBeenCalledWith('feed_animal', { animalIds: ['a1', 'a2'] })
    expect(res).toEqual({ ok: true, data: { fed: 2 } })
  })

  it('collect() шлёт мутацию collect_animal_product', async () => {
    const applyMutation = vi.fn(
      async (): Promise<RpcResult<{ items: never[] }>> => ({ ok: true, data: { items: [] } }),
    )
    const system = createAnimalSystem(makeCtx(applyMutation))
    await system.collect(['a1'])
    expect(applyMutation).toHaveBeenCalledWith('collect_animal_product', { animalIds: ['a1'] })
  })

  it('rename() шлёт мутацию rename_pet с именем', async () => {
    const applyMutation = vi.fn(async (): Promise<RpcResult<void>> => ({ ok: true, data: undefined }))
    const system = createAnimalSystem(makeCtx(applyMutation))
    await system.rename('a1', 'Bessie')
    expect(applyMutation).toHaveBeenCalledWith('rename_pet', { animalId: 'a1', name: 'Bessie' })
  })

  it('gift() шлёт мутацию affection_gift', async () => {
    const applyMutation = vi.fn(
      async (): Promise<RpcResult<{ affection: number }>> => ({ ok: true, data: { affection: 42 } }),
    )
    const system = createAnimalSystem(makeCtx(applyMutation))
    const res = await system.gift('a1', 'toy_ribbon')
    expect(applyMutation).toHaveBeenCalledWith('affection_gift', { animalId: 'a1', giftKey: 'toy_ribbon' })
    expect(res).toEqual({ ok: true, data: { affection: 42 } })
  })

  it('пробрасывает ошибку адаптера как есть (система не глотает офлайн-код)', async () => {
    const applyMutation = vi.fn(
      async (): Promise<RpcResult<{ fed: number }>> => ({
        ok: false,
        error: { code: 'offline', message: 'нет сети' },
      }),
    )
    const system = createAnimalSystem(makeCtx(applyMutation))
    const res = await system.feed(['a1'])
    expect(res.ok).toBe(false)
  })
})
