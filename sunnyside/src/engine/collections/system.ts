/**
 * engine/collections/system.ts — фабрика `CollectionSystem` (engine/contracts.ts):
 * Prize Machine pulls, декор (покупка/расстановка), Neon Builder save.
 *
 * Оркестрация «намерение игрока → мутация» (тот же паттерн, что `craft/system.ts`):
 * локальная валидация payload ДО сети (не начисляет ничего сама, AGENTS.md §0.3
 * анти-чит) → `ctx.applyMutation` → адаптер/сервер — единственный источник истины
 * по фактическому дропу/pity (см. докстринг `./prizeMachine.ts`).
 */
import type { CollectionSystem, SystemContext } from '@/engine/contracts'
import type { RpcResult, PrizePullReq, PrizePullRes, DecorPlaceReq } from '@/types'
import { TOY_SERIES_KEYS } from '@/types/collections'

function fail<T>(code: 'invalid_payload', message: string): RpcResult<T> {
  return { ok: false, error: { code, message } }
}

/** Фабрика системы коллекций (владелец: agent «collections», AGENTS.md §2). */
export function createCollectionSystem(ctx: SystemContext): CollectionSystem {
  return {
    async pullPrize(req: PrizePullReq): Promise<RpcResult<PrizePullRes>> {
      if (!TOY_SERIES_KEYS.includes(req.seriesKey)) {
        return fail('invalid_payload', `pullPrize: неизвестная серия «${req.seriesKey}»`)
      }
      if (!Number.isInteger(req.count) || req.count < 1) {
        return fail('invalid_payload', `pullPrize: count должен быть целым числом ≥1, получено ${req.count}`)
      }
      return ctx.applyMutation<PrizePullRes>('prize_pull', req)
    },

    async purchaseDecor(decorKey: string): Promise<RpcResult<void>> {
      if (!decorKey) return fail('invalid_payload', 'purchaseDecor: пустой decorKey')
      return ctx.applyMutation<void>('decor_purchase', { decorKey })
    },

    async placeDecor(req: DecorPlaceReq): Promise<RpcResult<void>> {
      if (!req.decorKey) return fail('invalid_payload', 'placeDecor: пустой decorKey')
      return ctx.applyMutation<void>('decor_place', req)
    },

    async saveNeon(config: Record<string, unknown>): Promise<RpcResult<void>> {
      return ctx.applyMutation<void>('neon_save', { config })
    },
  }
}
