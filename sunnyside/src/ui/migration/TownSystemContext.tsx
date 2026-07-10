/**
 * ui/migration/TownSystemContext.tsx — DI-точка для `TownSystem` (engine/contracts.ts:
 * `proposeMigration`/`voteMigration` — Street Caravan/Town Merge (12-migration §3.2/§3.3);
 * `listTowns` — Town Browser (§3.1.3); `moveFarm` — личный Moving Van, Уровень 1 (§3.1/§3.4)).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `TownSystem` делает композиция
 * (`app/backend.ts createSystems` → `app/SystemsProvider.tsx`). Зеркалит паттерн
 * `ui/street/SocialSystemContext.tsx` / `ui/orders/CoopSystemContext.tsx`.
 */
import { createContext, useContext } from 'react'
import type { TownSystem } from '@/engine/contracts'

const TownSystemContext = createContext<TownSystem | null>(null)

export const TownSystemProvider = TownSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useTownSystem(): TownSystem {
  const system = useContext(TownSystemContext)
  if (!system) {
    throw new Error(
      'useTownSystem: нет TownSystem в контексте — оберни дерево в <TownSystemProvider value={...}>',
    )
  }
  return system
}
