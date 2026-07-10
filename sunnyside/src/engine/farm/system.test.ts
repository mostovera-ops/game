import { describe, expect, it, vi } from 'vitest'
import type { SystemContext } from '@/engine/contracts'
import type { RpcResult } from '@/types'
import { createFarmSystem } from './system'

/** Мок SystemContext — проверяем только делегирование, не сеть. */
function makeCtx() {
  const applyMutation = vi.fn(async (): Promise<RpcResult<unknown>> => ({ ok: true, data: {} }))
  const ctx: SystemContext = {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => 0,
    applyMutation: applyMutation as unknown as SystemContext['applyMutation'],
  }
  return { ctx, applyMutation }
}

describe('createFarmSystem — тонкая обёртка над SystemContext.applyMutation', () => {
  it('sow шлёт мутацию "sow" с { slot, seedKey }', async () => {
    const { ctx, applyMutation } = makeCtx()
    const sys = createFarmSystem(ctx)
    await sys.sow(3, 'seed_tomato')
    expect(applyMutation).toHaveBeenCalledWith('sow', { slot: 3, seedKey: 'seed_tomato' })
  })

  it('water шлёт мутацию "water" с { plotIds }', async () => {
    const { ctx, applyMutation } = makeCtx()
    const sys = createFarmSystem(ctx)
    await sys.water(['p1', 'p2'])
    expect(applyMutation).toHaveBeenCalledWith('water', { plotIds: ['p1', 'p2'] })
  })

  it('harvest шлёт мутацию "harvest" с { plotIds }', async () => {
    const { ctx, applyMutation } = makeCtx()
    const sys = createFarmSystem(ctx)
    await sys.harvest(['p1'])
    expect(applyMutation).toHaveBeenCalledWith('harvest', { plotIds: ['p1'] })
  })

  it('upgradeBuilding шлёт мутацию "building_upgrade" с { buildingKey }', async () => {
    const { ctx, applyMutation } = makeCtx()
    const sys = createFarmSystem(ctx)
    await sys.upgradeBuilding('bld_house')
    expect(applyMutation).toHaveBeenCalledWith('building_upgrade', { buildingKey: 'bld_house' })
  })

  it('возвращает RpcResult из applyMutation без модификации', async () => {
    const { ctx } = makeCtx()
    const sys = createFarmSystem(ctx)
    const res = await sys.sow(1, 'seed_lettuce')
    expect(res.ok).toBe(true)
  })
})
