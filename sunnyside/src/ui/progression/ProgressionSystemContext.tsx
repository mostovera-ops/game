/**
 * ui/progression/ProgressionSystemContext.tsx — DI-точка для `ProgressionSystem`
 * (engine/contracts.ts): исследование Know-How, назначение/апгрейд стаффа, стрик.
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `ProgressionSystem` (адаптер + SystemContext)
 * делает композиция (`App.tsx`/бутстрап). Наши компоненты получают уже готовый системный
 * объект через `<ProgressionSystemProvider value={progressionSystem}>` (см. `ui/kitchen`
 * `CraftSystemContext.tsx` — тот же паттерн для соседнего модуля).
 */
import { createContext, useContext } from 'react'
import type { ProgressionSystem } from '@/engine/contracts'

const ProgressionSystemContext = createContext<ProgressionSystem | null>(null)

export const ProgressionSystemProvider = ProgressionSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useProgressionSystem(): ProgressionSystem {
  const system = useContext(ProgressionSystemContext)
  if (!system) {
    throw new Error(
      'useProgressionSystem: нет ProgressionSystem в контексте — оберни дерево в ' +
        '<ProgressionSystemProvider value={createProgressionSystem(...)}>',
    )
  }
  return system
}
