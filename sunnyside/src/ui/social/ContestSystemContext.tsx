/**
 * ui/social/ContestSystemContext.tsx — DI-точка для `ContestSystem` (engine/contracts.ts:
 * `enter(contestKey, payload)` / `vote(contestId, entryId)` — 09-fair §3.7/§3.8,
 * 20-backend §3.4.1 `contest_enter`/`contest_vote`).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — `createContestSystem` (`@/engine/fair`) уже
 * собран композицией в `sys.contest` (`app/backend.ts`), но до сих пор не имел
 * DOM-панели зрителя (Contest Gallery, `ui_contest_gallery`) — заявки/конкурсы
 * читались из стора (`state/fair.ts`), но клик «войти»/«голосовать» никуда не вёл
 * (задача «wire contest-screens к серверным contest_*, сейчас локально»). Провайдер
 * регистрируется композицией (`app/SystemsProvider.tsx`), значение — `sys.contest`.
 */
import { createContext, useContext } from 'react'
import type { ContestSystem } from '@/engine/contracts'

const ContestSystemContext = createContext<ContestSystem | null>(null)

export const ContestSystemProvider = ContestSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useContestSystem(): ContestSystem {
  const system = useContext(ContestSystemContext)
  if (!system) {
    throw new Error(
      'useContestSystem: нет ContestSystem в контексте — оберни дерево в <ContestSystemProvider value={...}>',
    )
  }
  return system
}
