/**
 * engine/event/system.ts — фабрика EventSystem (engine/contracts.ts), 10-server-event §3.2.
 *
 * Оркестрирует «намерение игрока» — вклад блюда в общий котёл (`Cauldron`): тонкая
 * обёртка над `SystemContext.applyMutation`, которая шлёт `event_contribute` через
 * `BackendAdapter` и возвращает `RpcResult`. Система НЕ считает FP/вехи сама
 * (AGENTS.md §0.3, анти-чит §3.13): истину меры/личного FP/пересечения вех
 * реконструирует сервер (Edge Function атомарно, EV8). Локальные чистые формулы
 * (`conversion`/`milestones`/...) — ТОЛЬКО предпросмотр для UI (`Cauldron`).
 *
 * ГРАНИЦА: зависит только от `@/types` и `@/engine/contracts`. Ноль three/react/net/state
 * (оптимистичный патч, если нужен, накладывает вызывающая сторона поверх стора).
 */

import type { EventContributeRes } from '@/types'
import type { EventSystem, SystemContext } from '@/engine/contracts'

/** Фабрика системы ивента — единственная точка входа для UI/сцены (AGENTS.md §2). */
export function createEventSystem(ctx: SystemContext): EventSystem {
  return {
    contribute(itemKey: string, qty: number, channel: 'donate' | 'passive') {
      return ctx.applyMutation<EventContributeRes>('event_contribute', {
        itemKey,
        qty,
        channel,
      })
    },
  }
}
