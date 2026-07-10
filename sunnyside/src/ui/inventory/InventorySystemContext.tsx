/**
 * ui/inventory/InventorySystemContext.tsx — DI-точка для `InventorySystem`
 * (engine/contracts.ts). Тот же приём, что и `ui/kitchen/CraftSystemContext.tsx`:
 * `ui/` не имеет права ходить в `@/net` (AGENTS.md §3), а `InventorySystem` — чистая
 * локальная бухгалтерия (лимиты/резервы/буфер перелива), которую собирает композиция
 * один раз (`createInventorySystem()`, `engine/inventory`) и прокидывает через контекст.
 */
import { createContext, useContext } from 'react'
import type { InventorySystem } from '@/engine/contracts'

const InventorySystemContext = createContext<InventorySystem | null>(null)

export const InventorySystemProvider = InventorySystemContext.Provider

export function useInventorySystem(): InventorySystem {
  const system = useContext(InventorySystemContext)
  if (!system) {
    throw new Error(
      'useInventorySystem: нет InventorySystem в контексте — оберни дерево в <InventorySystemProvider value={createInventorySystem()}>',
    )
  }
  return system
}
