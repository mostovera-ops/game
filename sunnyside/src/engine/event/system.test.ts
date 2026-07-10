/**
 * system.test.ts — фабрика EventSystem: contribute шлёт event_contribute через adapter.
 * Система НЕ считает FP/вехи сама (анти-чит §3.13) — только проксирует мутацию. Node.
 */

import { describe, it, expect, vi } from 'vitest'
import type { SystemContext } from '@/engine/contracts'
import type { EventContributeRes } from '@/types'
import { createEventSystem } from './index'

function makeCtx(res: EventContributeRes) {
  const applyMutation = vi.fn().mockResolvedValue({ ok: true, data: res })
  const ctx = {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => 0,
    applyMutation,
  } as unknown as SystemContext
  return { ctx, applyMutation }
}

describe('createEventSystem.contribute', () => {
  it('проксирует в applyMutation("event_contribute", payload)', async () => {
    const res: EventContributeRes = { meterPct: 50, personalFp: 1600, milestonesHit: [50] }
    const { ctx, applyMutation } = makeCtx(res)
    const system = createEventSystem(ctx)

    const out = await system.contribute('dish_cherry_pie', 3, 'donate')

    expect(applyMutation).toHaveBeenCalledWith('event_contribute', {
      itemKey: 'dish_cherry_pie',
      qty: 3,
      channel: 'donate',
    })
    expect(out).toEqual({ ok: true, data: res })
  })

  it('канал passive (авто-продажа с прилавка) тоже проксируется', async () => {
    const { ctx, applyMutation } = makeCtx({ meterPct: 10, personalFp: 100, milestonesHit: [] })
    const system = createEventSystem(ctx)

    await system.contribute('dish_lemonade', 1, 'passive')

    expect(applyMutation).toHaveBeenCalledWith('event_contribute', {
      itemKey: 'dish_lemonade',
      qty: 1,
      channel: 'passive',
    })
  })
})
