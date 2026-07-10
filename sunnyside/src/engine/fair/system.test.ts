/**
 * system.test.ts — фабрики систем ярмарки (реализация contracts.ts).
 * Проверяем делегирование мутаций через SystemContext.applyMutation (анти-чит §0.3)
 * и жизненный цикл локальной сессии смены.
 */

import { describe, it, expect, vi } from 'vitest'
import type { SystemContext } from '@/engine/contracts'
import type { MutationKind } from '@/types'
import type { RpcResult } from '@/types/common'
import type { ProductKey } from '@/types/ingredients'

import {
  createFairSystem,
  createShiftSystem,
  createContestSystem,
  shiftDurationSec,
  sessionPhase,
} from './system'

/** Мок контекста: фиксированное время + запись вызовов applyMutation. */
function mockCtx(now = 1_000_000): {
  ctx: SystemContext
  calls: { kind: MutationKind; payload: unknown }[]
} {
  const calls: { kind: MutationKind; payload: unknown }[] = []
  const ctx: SystemContext = {
    adapter: {} as SystemContext['adapter'],
    serverNow: () => now,
    async applyMutation<T>(kind: MutationKind, payload: unknown): Promise<RpcResult<T>> {
      calls.push({ kind, payload })
      return { ok: true, data: undefined as T }
    },
  }
  return { ctx, calls }
}

describe('createFairSystem — прилавок через adapter', () => {
  it('open/list/upgradeTent шлют правильные MutationKind и payload', async () => {
    const { ctx, calls } = mockCtx()
    const fair = createFairSystem(ctx)

    await fair.open('stall-1')
    await fair.list({ stallId: 'stall-1', lots: [] })
    await fair.upgradeTent()

    expect(calls.map((c) => c.kind)).toEqual(['fair_open', 'fair_list', 'fair_tent_upgrade'])
    expect(calls[0]!.payload).toEqual({ stallId: 'stall-1' })
    expect(calls[1]!.payload).toEqual({ stallId: 'stall-1', lots: [] })
  })
})

describe('createContestSystem — конкурсы через adapter', () => {
  it('enter/vote шлют contest_enter / contest_vote', async () => {
    const { ctx, calls } = mockCtx()
    const contest = createContestSystem(ctx)

    await contest.enter('ct_pie_week', { dishId: 'x' })
    await contest.vote('contest-1', 'entry-9')

    expect(calls[0]).toEqual({ kind: 'contest_enter', payload: { contestKey: 'ct_pie_week', payload: { dishId: 'x' } } })
    expect(calls[1]).toEqual({ kind: 'contest_vote', payload: { contestId: 'contest-1', entryId: 'entry-9' } })
  })
})

describe('shiftDurationSec — таймер по уровню палатки (§3.4)', () => {
  it('660 базово … 720 на ур.5', () => {
    expect(shiftDurationSec(1)).toBe(660)
    expect(shiftDurationSec(5)).toBe(720)
  })
})

describe('createShiftSystem — локальная сессия + submit через adapter', () => {
  it('start открывает сессию с серверным временем и детерминированной очередью', async () => {
    const { ctx } = mockCtx(2_000_000)
    const shift = createShiftSystem(ctx)
    shift.withStartOpts({
      tentLevel: 2,
      dishPool: [{ key: 'crop_cherry' as ProductKey, tier: 3 }],
    })

    const res = await shift.start()
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.startedAt).toBe(2_000_000)
      expect(res.data.durationSec).toBe(shiftDurationSec(2))
    }
    const session = shift.session()
    expect(session).not.toBeNull()
    expect(session!.queue.length).toBeGreaterThan(0)
  })

  it('tick продвигает elapsed, клампится длительностью; sessionPhase считает фазу', async () => {
    const { ctx } = mockCtx()
    const shift = createShiftSystem(ctx)
    shift.withStartOpts({ tentLevel: 1, dishPool: [{ key: 'crop_tomato' as ProductKey, tier: 1 }] })
    await shift.start()

    shift.tick(90_000) // 90 с → rush
    expect(sessionPhase(shift.session()!)).toBe('rush')

    shift.tick(9_999_999) // клампится к durationSec×1000
    expect(shift.session()!.elapsedMs).toBe(660 * 1000)
  })

  it('tick без активной сессии — безопасный no-op', () => {
    const { ctx } = mockCtx()
    const shift = createShiftSystem(ctx)
    expect(() => shift.tick(1000)).not.toThrow()
    expect(shift.session()).toBeNull()
  })

  it('submit шлёт shift_submit и закрывает локальную сессию', async () => {
    const { ctx, calls } = mockCtx()
    const shift = createShiftSystem(ctx)
    shift.withStartOpts({ tentLevel: 1, dishPool: [{ key: 'crop_tomato' as ProductKey, tier: 1 }] })
    await shift.start()

    const spy = vi.spyOn(shift, 'session')
    await shift.submit({
      shiftLog: { seed: 1, startedAt: 0, served: 5, tips: 10, soldStock: [] },
    })
    expect(calls.at(-1)!.kind).toBe('shift_submit')
    expect(shift.session()).toBeNull()
    spy.mockRestore()
  })
})
