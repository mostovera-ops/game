/**
 * system.test.ts — `createExpeditionSystem` (07-expeditions): валидация штата/routeSlot
 * ДО отправки мутации; фактический seed/лут/returnAt — только из `ctx.applyMutation`
 * (анти-чит, AGENTS.md §0.3). `ctx` — фейковый (без стора/сети).
 */
import { describe, it, expect, vi } from 'vitest'
import type { SystemContext } from '@/engine/contracts'
import type { RpcResult } from '@/types'
import { createExpeditionSystem } from './system'

function makeCtx(): SystemContext & { applyMutation: ReturnType<typeof vi.fn> } {
  const applyMutation = vi.fn(async (): Promise<RpcResult<unknown>> => ({ ok: true, data: {} }))
  return {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => 0,
    applyMutation,
  } as unknown as SystemContext & { applyMutation: typeof applyMutation }
}

describe('createExpeditionSystem().start', () => {
  it('unknown stateKey → not_found, network untouched', async () => {
    const ctx = makeCtx()
    const system = createExpeditionSystem(ctx)
    const result = await system.start({ stateKey: 'st_nowhere' as never, routeSlot: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('negative/non-integer routeSlot → invalid_payload, network untouched', async () => {
    const ctx = makeCtx()
    const system = createExpeditionSystem(ctx)
    const result = await system.start({ stateKey: 'st_illinois', routeSlot: -1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid_payload')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('valid request → delegates to ctx.applyMutation("expedition_start", req)', async () => {
    const ctx = makeCtx()
    const system = createExpeditionSystem(ctx)
    const req = { stateKey: 'st_illinois' as const, routeSlot: 1 }
    const result = await system.start(req)
    expect(result.ok).toBe(true)
    expect(ctx.applyMutation).toHaveBeenCalledWith('expedition_start', req)
  })
})

describe('createExpeditionSystem().collect', () => {
  it('empty expIds → invalid_payload, network untouched', async () => {
    const ctx = makeCtx()
    const system = createExpeditionSystem(ctx)
    const result = await system.collect([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid_payload')
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })

  it('non-empty expIds → delegates to ctx.applyMutation("expedition_collect", ...)', async () => {
    const ctx = makeCtx()
    const system = createExpeditionSystem(ctx)
    const result = await system.collect(['exp-1', 'exp-2'])
    expect(result.ok).toBe(true)
    expect(ctx.applyMutation).toHaveBeenCalledWith('expedition_collect', { expIds: ['exp-1', 'exp-2'] })
  })
})

describe('createExpeditionSystem().list', () => {
  it('delegates to adapter.getExpeditions (чистое чтение, без applyMutation)', async () => {
    const ctx = makeCtx()
    const getExpeditions = vi.fn(async () => ({ ok: true, data: { expeditions: [] } }))
    ctx.adapter = { getExpeditions } as unknown as SystemContext['adapter']
    const system = createExpeditionSystem(ctx)
    const result = await system.list()
    expect(result.ok).toBe(true)
    expect(getExpeditions).toHaveBeenCalledTimes(1)
    expect(ctx.applyMutation).not.toHaveBeenCalled()
  })
})
