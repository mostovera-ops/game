/**
 * ui/market/FairSystemContext.tsx — DI-точка для `FairSystem` (engine/contracts.ts).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `FairSystem` (адаптер + SystemContext,
 * `createFairSystem` из `@/engine/fair`) делает композиция (App.tsx/бутстрап, вне
 * зоны ui-market-orders, см. main.tsx `TODO(net-bootstrap)`). Компоненты этой зоны
 * получают уже готовый системный объект через `<FairSystemProvider value={fairSystem}>`
 * и вызывают только его публичные методы (`list`, `upgradeTent`).
 */
import { createContext, useContext } from 'react'
import type { FairSystem } from '@/engine/contracts'

const FairSystemContext = createContext<FairSystem | null>(null)

export const FairSystemProvider = FairSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useFairSystem(): FairSystem {
  const system = useContext(FairSystemContext)
  if (!system) {
    throw new Error(
      'useFairSystem: нет FairSystem в контексте — оберни дерево в <FairSystemProvider value={createFairSystem(...)}>',
    )
  }
  return system
}
