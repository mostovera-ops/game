/**
 * ui/kitchen/CraftSystemContext.tsx — DI-точка для `CraftSystem` (engine/contracts.ts).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `CraftSystem` (адаптер + SystemContext)
 * делает композиция (`App.tsx`/бутстрап, владелец — архитектура/net-bootstrap-агент,
 * см. AGENTS.md §2). Наши компоненты получают уже готовый системный объект через
 * `<CraftSystemProvider value={craftSystem}>` и вызывают только его публичные методы.
 */
import { createContext, useContext } from 'react'
import type { CraftSystem } from '@/engine/contracts'

const CraftSystemContext = createContext<CraftSystem | null>(null)

export const CraftSystemProvider = CraftSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useCraftSystem(): CraftSystem {
  const system = useContext(CraftSystemContext)
  if (!system) {
    throw new Error(
      'useCraftSystem: нет CraftSystem в контексте — оберни дерево в <CraftSystemProvider value={createCraftSystem(...)}>',
    )
  }
  return system
}
