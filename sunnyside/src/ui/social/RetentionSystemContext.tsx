/**
 * ui/social/RetentionSystemContext.tsx — DI-точка для `RetentionSystem`
 * (`@/engine/retention`: `vacationStart`/`vacationEnd`, те же сигнатуры, что
 * `BackendAdapter` — 16-retention §3.5 Gone Fishin' / Vacation Mode).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`/`@/engine`
 * минуя `contracts.ts`-барель (AGENTS.md §3). `createRetentionSystem` (engine/retention,
 * зона агента «retention») до этой задачи не был подключён ни к одному DOM-оверлею —
 * панель «Уехать» (`ui_vacation_toggle`) первая. Провайдер регистрируется композицией
 * (`app/SystemsProvider.tsx`), значение — `sys.retention` (`app/backend.ts`).
 */
import { createContext, useContext } from 'react'
import type { RetentionSystem } from '@/engine/retention'

const RetentionSystemContext = createContext<RetentionSystem | null>(null)

export const RetentionSystemProvider = RetentionSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useRetentionSystem(): RetentionSystem {
  const system = useContext(RetentionSystemContext)
  if (!system) {
    throw new Error(
      'useRetentionSystem: нет RetentionSystem в контексте — оберни дерево в <RetentionSystemProvider value={...}>',
    )
  }
  return system
}
