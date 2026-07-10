/**
 * ui/collections/CollectionSystemContext.tsx — DI-точка для `CollectionSystem`
 * (engine/contracts.ts): Prize Machine pulls, декор, Neon Builder save.
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `CollectionSystem` (адаптер +
 * SystemContext) делает композиция (App.tsx/бутстрап). Наши компоненты получают
 * уже готовый системный объект через `<CollectionSystemProvider value={...}>`.
 */
import { createContext, useContext } from 'react'
import type { CollectionSystem } from '@/engine/contracts'

const CollectionSystemContext = createContext<CollectionSystem | null>(null)

export const CollectionSystemProvider = CollectionSystemContext.Provider

export function useCollectionSystem(): CollectionSystem {
  const system = useContext(CollectionSystemContext)
  if (!system) {
    throw new Error(
      'useCollectionSystem: нет CollectionSystem в контексте — оберни дерево в <CollectionSystemProvider value={createCollectionSystem(ctx)}>',
    )
  }
  return system
}
