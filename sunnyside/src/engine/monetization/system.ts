/**
 * engine/monetization/system.ts — фабрика `MonetizationSystem` (engine/contracts.ts).
 *
 * Единственная ответственность: провести подтверждённую покупку `◉` Dimes (реал →
 * дайм-пакет, `docs/specs/15-monetization.md §9`) через `BackendAdapter.iapVerify`.
 * ЭТО НЕ мутация очереди (`applyMutation`) — покупка не переживает офлайн-реплей как
 * оптимистичный патч фермы: чек/receipt приходит от платёжного провайдера ПОСЛЕ факта
 * оплаты (в проде — Apple/Google/Stripe webhook подтверждение), поэтому вызывается
 * `ctx.adapter.iapVerify` напрямую (SystemContext даёт прямой доступ к `adapter` для
 * именно таких «не queue-able» операций, см. контракт `SystemContext`).
 *
 * ПЛАТЕЖИ — ЗАГЛУШКА (зона ui-shop-pass, AGENTS.md §2): реальный биллинг вне скоупа.
 * UI (`ui/shop/PaymentDialog.tsx`) эмулирует ответ провайдера (OK/FAIL) ДО вызова этого
 * метода — при FAIL система вообще не вызывается (ничего не спишется/не начислится).
 *
 * ГРАНИЦА: зависит только от `@/types` и `@/engine/contracts`. Ноль three/react/net/state.
 */

import type { IapVerifyReq, IapVerifyRes, RpcResult } from '@/types'
import type { MonetizationSystem, SystemContext } from '@/engine/contracts'

function fail<T>(message: string): RpcResult<T> {
  return { ok: false, error: { code: 'invalid_payload', message } }
}

/** Фабрика системы монетизации (владелец: зона `ui-shop-pass`, AGENTS.md §2). */
export function createMonetizationSystem(ctx: SystemContext): MonetizationSystem {
  return {
    async verifyPurchase(req: IapVerifyReq): Promise<RpcResult<IapVerifyRes>> {
      if (!req.provider) return fail('verifyPurchase: пустой provider')
      if (!req.sku) return fail('verifyPurchase: пустой sku')
      if (!req.receipt) return fail('verifyPurchase: пустой receipt (dev-эмуляция должна подставить псевдо-чек)')
      return ctx.adapter.iapVerify(req)
    },
  }
}
