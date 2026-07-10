/**
 * engine/expedition/system.ts — фабрика `ExpeditionSystem` (engine/contracts.ts).
 *
 * Оркестрирует «намерение игрока» (отправить/собрать рейс): локальная валидация
 * (штат существует в каталоге? слот маршрута — целое неотрицательное?) отсеивает
 * очевидный отказ до сети, но НИЧЕГО не начисляет сама — фактический seed/лут/
 * returnAt всегда приходит из `RpcResult` адаптера через `ctx.applyMutation`
 * (AGENTS.md §0.3 анти-чит: клиент не считает награду).
 */
import type { ExpeditionSystem, SystemContext } from '@/engine/contracts'
import type { UUID, RpcResult, ExpeditionStartReq, ExpeditionStartRes, ExpeditionCollectRes } from '@/types'
import { getStateContent } from './catalog'

function fail<T>(code: 'not_found' | 'invalid_payload', message: string): RpcResult<T> {
  return { ok: false, error: { code, message } }
}

/** Фабрика системы экспедиций (владелец: agent «expedition-mail», AGENTS.md §2). */
export function createExpeditionSystem(ctx: SystemContext): ExpeditionSystem {
  return {
    async start(req: ExpeditionStartReq) {
      const state = getStateContent(req.stateKey)
      if (!state) {
        return fail<ExpeditionStartRes>('not_found', `штат «${req.stateKey}» отсутствует в каталоге states.ts`)
      }
      if (!Number.isInteger(req.routeSlot) || req.routeSlot < 0) {
        return fail<ExpeditionStartRes>('invalid_payload', `routeSlot должен быть целым неотрицательным, получено ${req.routeSlot}`)
      }
      return ctx.applyMutation<ExpeditionStartRes>('expedition_start', req)
    },

    async collect(expIds: UUID[]) {
      if (expIds.length === 0) {
        return fail<ExpeditionCollectRes>('invalid_payload', 'collect: пустой список expIds')
      }
      return ctx.applyMutation<ExpeditionCollectRes>('expedition_collect', { expIds })
    },

    // Чтение по требованию (не часть общего бутстрап-снапшота) — как `TownSystem.listTowns`:
    // чистый снапшот без оптимистики/патча, UI вызывает на открытии панели и после мутаций.
    list() {
      return ctx.adapter.getExpeditions()
    },
  }
}
