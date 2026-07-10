/**
 * engine/fair/system.ts — фабрики систем ярмарки (реализуют contracts.ts).
 *
 * Три системы домена ярмарки (AGENTS.md §2 — зона `engine/fair/`):
 *   - FairSystem    — пассивный прилавок: open/list/upgradeTent (RPC через adapter).
 *   - ShiftSystem   — активная смена: start (локальная сессия) / tick (локальный сим) /
 *                     submit (RPC). Очередь детерминирована от seed; итог реконструирует сервер.
 *   - ContestSystem — конкурсы: enter/vote (RPC).
 *
 * АНТИ-ЧИТ (AGENTS.md §0.3): любая мутация серверного стейта идёт через
 * `SystemContext.applyMutation` → `BackendAdapter`. Системы НИЧЕГО не начисляют —
 * скоринг/продажи из `./sales.ts`/`./scoring.ts`/`./contest.ts` только предсказывают для UI.
 *
 * ГРАНИЦА: импортирует лишь `@/engine/contracts` и `@/types`. Ноль three/react/net/store.
 */

import type { ContestSystem, FairSystem, ShiftSystem, SystemContext } from '@/engine/contracts'
import type {
  FairOpenReq,
  FairOpenRes,
  FairListReq,
  FairListRes,
  FairTentUpgradeRes,
  ContestEnterReq,
  ContestEnterRes,
  ContestVoteReq,
  ShiftSubmitReq,
  ShiftSubmitRes,
} from '@/types'
import type { UUID, EpochMs } from '@/types/common'
import type { ContestKey } from '@/types/fair'
import type { ProductKey } from '@/types/ingredients'

import { TENT_TIERS, type TentLevel } from './constants'
import { generateQueue, phaseAt, type SimGuest } from './simulation'

// ════════════════════════════════════════════════════════════════════════════
// FairSystem — пассивный прилавок (§3.2/§3.3/§3.6)
// ════════════════════════════════════════════════════════════════════════════

/** Фабрика `FairSystem` (владелец: agent «fair», AGENTS.md §2). */
export function createFairSystem(ctx: SystemContext): FairSystem {
  return {
    async open(stallId: UUID) {
      const payload: FairOpenReq = { stallId }
      return ctx.applyMutation<FairOpenRes>('fair_open', payload)
    },

    async list(req: FairListReq) {
      return ctx.applyMutation<FairListRes>('fair_list', req)
    },

    async upgradeTent() {
      return ctx.applyMutation<FairTentUpgradeRes>('fair_tent_upgrade', {})
    },
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ShiftSystem — активная смена (§3.4/§3.5/§3.6)
// ════════════════════════════════════════════════════════════════════════════

/** Длительность смены по уровню палатки (§3.4: 660 базово, +15/ур, потолок 720 на ур.5). */
export function shiftDurationSec(tentLevel: TentLevel): number {
  return TENT_TIERS[tentLevel].timerSec
}

/** Опции старта смены — берутся из store вызывающим слайсом (эта система store не знает). */
export interface ShiftStartOpts {
  tentLevel?: TentLevel
  dishPool?: { key: ProductKey; tier: number }[]
}

/**
 * Живая локальная сессия смены (только UI-сим; истина итога — серверная на submit).
 * `seed`/`startedAt` в идеале серверные (§3.6, анти-чит) — но в contracts.ts НЕТ RPC
 * `shift_start` и метода адаптера под него, поэтому здесь seed выводится детерминированно
 * из `serverNow()` (детерминизм локальной очереди сохранён; награда всё равно
 * реконструируется сервером из списанного стока на shift_submit, так что чит-вектора нет).
 * TODO(architecture): при появлении `shift_start` в contracts.ts/adapter — переключить на
 * серверный seed/startedAt (заведена как согласование, AGENTS.md §0.6).
 */
export interface ShiftSession {
  seed: number
  startedAt: EpochMs
  durationSec: number
  queue: SimGuest[]
  elapsedMs: number
}

/** Фабрика `ShiftSystem`. Держит эфемерную клиентскую сессию (как inventory — свой ledger). */
export interface ShiftSystemExt extends ShiftSystem {
  /** Передать tentLevel/пул стока перед стартом (store вне зоны системы, §3 граница). */
  withStartOpts(opts: ShiftStartOpts): void
  /** Текущая локальная сессия (для чтения слайсом/сценой; вне контракта — расширение). */
  session(): ShiftSession | null
}

export function createShiftSystem(ctx: SystemContext): ShiftSystemExt {
  let current: ShiftSession | null = null
  let startOpts: ShiftStartOpts = {}

  /** Позволяет слайсу передать tentLevel/пул стока перед стартом (store не в зоне системы). */
  const withStartOpts = (opts: ShiftStartOpts): void => {
    startOpts = opts
  }

  const system = {
    // Экспонируем сеттер опций как свойство, чтобы слайс мог задать контекст старта.
    withStartOpts,

    async start() {
      const startedAt = ctx.serverNow()
      const tentLevel = startOpts.tentLevel ?? 1
      const durationSec = shiftDurationSec(tentLevel)
      // Детерминированный seed из времени старта (см. докстринг ShiftSession / TODO).
      const seed = (startedAt >>> 0) ^ 0x9e3779b9
      const dishPool = startOpts.dishPool ?? []

      current = {
        seed,
        startedAt,
        durationSec,
        queue: generateQueue({ seed, durationSec, tentLevel, dishPool }),
        elapsedMs: 0,
      }

      return { ok: true as const, data: { seed, startedAt, durationSec } }
    },

    tick(elapsedMs: number) {
      if (!current) return
      current.elapsedMs = Math.min(current.durationSec * 1000, Math.max(0, elapsedMs))
    },

    async submit(req: ShiftSubmitReq) {
      const res = await ctx.applyMutation<ShiftSubmitRes>('shift_submit', req)
      if (res.ok) current = null // смена закрыта, локальную сессию сбрасываем
      return res
    },

    session(): ShiftSession | null {
      return current
    },
  }

  return system
}

/** Текущая фаза активной сессии (удобный хелпер для UI). */
export function sessionPhase(session: ShiftSession): ReturnType<typeof phaseAt> {
  return phaseAt(session.elapsedMs / 1000)
}

// ════════════════════════════════════════════════════════════════════════════
// ContestSystem — конкурсы (§3.7/§3.8)
// ════════════════════════════════════════════════════════════════════════════

/** Фабрика `ContestSystem`. */
export function createContestSystem(ctx: SystemContext): ContestSystem {
  return {
    async enter(contestKey: ContestKey, payload: Record<string, unknown>) {
      const req: ContestEnterReq = { contestKey, payload }
      return ctx.applyMutation<ContestEnterRes>('contest_enter', req)
    },

    async vote(contestId: UUID, entryId: UUID) {
      const req: ContestVoteReq = { contestId, entryId }
      return ctx.applyMutation<void>('contest_vote', req)
    },
  }
}
