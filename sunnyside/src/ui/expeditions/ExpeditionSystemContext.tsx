/**
 * ui/expeditions/ExpeditionSystemContext.tsx — DI-точка для `ExpeditionSystem`
 * (engine/contracts.ts: `start`/`collect` — отправка/сбор рейса грузовика, 07-expeditions
 * §3.2/§3.3; `list` — снапшот роуд-трипа для экрана `ui_expeditions`, §5).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку системы делает композиция
 * (`app/backend.ts createSystems` → `app/SystemsProvider.tsx`). Зеркалит паттерн
 * `ui/migration/TownSystemContext.tsx`.
 */
import { createContext, useContext } from 'react'
import type { ExpeditionSystem } from '@/engine/contracts'

const ExpeditionSystemContext = createContext<ExpeditionSystem | null>(null)

export const ExpeditionSystemProvider = ExpeditionSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useExpeditionSystem(): ExpeditionSystem {
  const system = useContext(ExpeditionSystemContext)
  if (!system) {
    throw new Error(
      'useExpeditionSystem: нет ExpeditionSystem в контексте — оберни дерево в <ExpeditionSystemProvider value={...}>',
    )
  }
  return system
}
