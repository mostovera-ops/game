/**
 * system.test.ts — `createCraftSystem` (04-machines.md): валидация очереди/батча/стока
 * ДО отправки мутации, и что фактическая мутация (`ctx.applyMutation`) — единственный
 * источник результата (анти-чит, AGENTS.md §0.3). Ports — фейковые (без стора/сети).
 */
import { describe, it, expect, vi } from 'vitest'
import type { SystemContext } from '@/engine/contracts'
import type { MachineInstance, MachineJob, RpcResult } from '@/types'
import { createCraftSystem, type CraftSystemPorts } from './system'

function job(overrides: Partial<MachineJob> = {}): MachineJob {
  return {
    id: 'job-1',
    machineId: 'm1',
    recipeKey: 'rcp_ingr_flour',
    batch: 1,
    state: 'cooking',
    startedAt: 0,
    readyAt: 1000,
    version: 1,
    ...overrides,
  }
}

function machine(overrides: Partial<MachineInstance> = {}): MachineInstance {
  return { id: 'm1', key: 'mch_oven', level: 1, jobs: [], ...overrides }
}

function makeCtx(): SystemContext & { applyMutation: ReturnType<typeof vi.fn> } {
  const applyMutation = vi.fn(async (): Promise<RpcResult<unknown>> => ({ ok: true, data: {} }))
  return {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => 0,
    applyMutation,
  } as unknown as SystemContext & { applyMutation: typeof applyMutation }
}

function makePorts(overrides: Partial<CraftSystemPorts> = {}): CraftSystemPorts {
  return {
    getMachine: () => machine(),
    getInventoryQty: () => 0,
    ...overrides,
  }
}

describe('createCraftSystem().start — валидация до сети', () => {
  it('batch нецелый/меньше 1 → invalid_payload, сеть не трогаем', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts())

    const res = await system.start('m1', 'rcp_ingr_flour', 0)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('неизвестный станок → not_found', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts({ getMachine: () => undefined }))

    const res = await system.start('missing', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('not_found')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('неизвестный рецепт → not_found', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts({ getInventoryQty: () => 999 }))

    const res = await system.start('m1', 'rcp_does_not_exist', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('not_found')
  })

  it('рецепт готовится на другом станке → invalid_payload', async () => {
    const ctx = makeCtx()
    // rcp_ingr_flour готовится на mch_oven, а станок здесь — mch_grill.
    const system = createCraftSystem(ctx, makePorts({ getMachine: () => machine({ key: 'mch_grill' }) }))

    const res = await system.start('m1', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
  })

  it('очередь станка заполнена (Ур.1 → ёмкость 1, уже 1 незабранная партия) → cap_reached', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(
      ctx,
      makePorts({
        getMachine: () => machine({ jobs: [job({ state: 'ready' })] }),
        getInventoryQty: () => 999,
      }),
    )

    const res = await system.start('m1', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('cap_reached')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('активный овертайм даёт +1 к ёмкости — та же ситуация теперь проходит', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(
      ctx,
      makePorts({
        getMachine: () => machine({ jobs: [job({ state: 'ready' })] }),
        getInventoryQty: () => 999,
        hasActiveOvertime: () => true,
      }),
    )

    const res = await system.start('m1', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(true)
    expect(ctx.applyMutation).toHaveBeenCalledOnce()
  })

  it('батч превышает максимум станка на уровне → invalid_payload (Oven Ур.1 макс. батч 1)', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts({ getInventoryQty: () => 999 }))

    const res = await system.start('m1', 'rcp_ingr_flour', 2)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
  })

  it('не хватает сырья на складе → insufficient_stock (Flour = Wheat×2)', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts({ getInventoryQty: () => 1 }))

    const res = await system.start('m1', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('insufficient_stock')
  })

  it('всё ок → делегирует ctx.applyMutation("craft_start", ...) и возвращает его результат', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts({ getInventoryQty: () => 2 }))

    const res = await system.start('m1', 'rcp_ingr_flour', 1)
    expect(res.ok).toBe(true)
    expect(ctx.applyMutation).toHaveBeenCalledWith('craft_start', {
      machineId: 'm1',
      recipeKey: 'rcp_ingr_flour',
      batch: 1,
    })
  })
})

describe('createCraftSystem().collect / .experiment', () => {
  it('collect с пустым списком → invalid_payload, без сети', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts())

    const res = await system.collect([])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('collect делегирует ctx.applyMutation("craft_collect", { jobIds })', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts())

    await system.collect(['j1', 'j2'])
    expect(ctx.applyMutation).toHaveBeenCalledWith('craft_collect', { jobIds: ['j1', 'j2'] })
  })

  it('experiment с пустыми inputs → invalid_payload, без сети', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts())

    const res = await system.experiment([])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('experiment делегирует ctx.applyMutation("recipe_experiment", { inputs })', async () => {
    const ctx = makeCtx()
    const system = createCraftSystem(ctx, makePorts())
    const inputs = [{ key: 'crop_wheat', qty: 1 }]

    await system.experiment(inputs)
    expect(ctx.applyMutation).toHaveBeenCalledWith('recipe_experiment', { inputs })
  })
})
