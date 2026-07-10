/**
 * system.test.ts — MonetizationSystem: делегирует к adapter.iapVerify, валидирует
 * payload ДО сети (AGENTS.md §0.3 — клиент не считает начисление сам, но не должен
 * слать заведомо мусорный запрос).
 */
import { describe, it, expect, vi } from 'vitest'
import type { BackendAdapter, SystemContext } from '@/engine/contracts'
import { createMonetizationSystem } from './system'

function makeCtx(overrides: Partial<BackendAdapter> = {}): SystemContext {
  const adapter = {
    iapVerify: vi.fn(async () => ({ ok: true, data: { purchaseId: 'p1', dimes: 320 } }) as never),
    ...overrides,
  } as unknown as BackendAdapter
  return {
    adapter,
    serverNow: () => Date.now(),
    applyMutation: vi.fn(async () => ({ ok: true, data: undefined }) as never),
  }
}

describe('createMonetizationSystem', () => {
  it('делегирует подтверждённую покупку в adapter.iapVerify без пересчёта суммы', async () => {
    const ctx = makeCtx()
    const system = createMonetizationSystem(ctx)
    const res = await system.verifyPurchase({ provider: 'web', receipt: 'dev-receipt-1', sku: 'dimes_sack' })
    expect(ctx.adapter.iapVerify).toHaveBeenCalledWith({ provider: 'web', receipt: 'dev-receipt-1', sku: 'dimes_sack' })
    expect(res).toEqual({ ok: true, data: { purchaseId: 'p1', dimes: 320 } })
  })

  it('отклоняет payload без receipt локально (не ходит в adapter)', async () => {
    const ctx = makeCtx()
    const system = createMonetizationSystem(ctx)
    const res = await system.verifyPurchase({ provider: 'web', receipt: '', sku: 'dimes_sack' })
    expect(res.ok).toBe(false)
    expect(ctx.adapter.iapVerify).not.toHaveBeenCalled()
  })

  it('отклоняет пустой sku', async () => {
    const ctx = makeCtx()
    const system = createMonetizationSystem(ctx)
    const res = await system.verifyPurchase({ provider: 'web', receipt: 'dev-receipt-1', sku: '' })
    expect(res.ok).toBe(false)
    expect(ctx.adapter.iapVerify).not.toHaveBeenCalled()
  })
})
