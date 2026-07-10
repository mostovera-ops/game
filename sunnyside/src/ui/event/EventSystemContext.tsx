/**
 * ui/event/EventSystemContext.tsx — DI-точка для `EventSystem` (engine/contracts.ts:
 * `contribute(itemKey, qty, channel)` — вклад блюда в общий котёл ивента, §3.2).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `EventSystem` (адаптер + SystemContext)
 * делает композиция (`App.tsx`/бутстрап, владелец — архитектура/net-bootstrap-агент).
 * Зеркалит паттерн `ui/kitchen/CraftSystemContext.tsx` / `ui/orders/CoopSystemContext.tsx`
 * для единообразия между зонами.
 */
import { createContext, useContext } from 'react'
import type { EventSystem } from '@/engine/contracts'

const EventSystemContext = createContext<EventSystem | null>(null)

export const EventSystemProvider = EventSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useEventSystem(): EventSystem {
  const system = useContext(EventSystemContext)
  if (!system) {
    throw new Error(
      'useEventSystem: нет EventSystem в контексте — оберни дерево в <EventSystemProvider value={...}>',
    )
  }
  return system
}
