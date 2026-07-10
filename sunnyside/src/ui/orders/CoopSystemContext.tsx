/**
 * ui/orders/CoopSystemContext.tsx — DI-точка для `CoopSystem` (engine/contracts.ts:
 * `contribute(orderId, itemKey, qty)` — кооп-заказы; `potluck(weekIndex, itemKey, qty)` —
 * стол стрита).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `CoopSystem` делает композиция (вне зоны
 * ui-market-orders). Зеркалит паттерн `ui/kitchen/CraftSystemContext.tsx` /
 * `ui/market/FairSystemContext.tsx` для единообразия между зонами.
 */
import { createContext, useContext } from 'react'
import type { CoopSystem } from '@/engine/contracts'

const CoopSystemContext = createContext<CoopSystem | null>(null)

export const CoopSystemProvider = CoopSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useCoopSystem(): CoopSystem {
  const system = useContext(CoopSystemContext)
  if (!system) {
    throw new Error(
      'useCoopSystem: нет CoopSystem в контексте — оберни дерево в <CoopSystemProvider value={...}>',
    )
  }
  return system
}
