/**
 * ui/street/SocialSystemContext.tsx — DI-точка для `SocialSystem` (engine/contracts.ts:
 * `help(targetId, actionType)` / `gift(toId, itemKey, qty)` / `sit(hostId)` /
 * `chat(channel, body, stickerKey?)` — 11-town §3.3/§3.4/§3.9).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `SocialSystem` (адаптер + SystemContext)
 * делает композиция (`App.tsx`/бутстрап, владелец — архитектура/net-bootstrap-агент).
 * Зеркалит паттерн `ui/orders/CoopSystemContext.tsx` / `ui/kitchen/CraftSystemContext.tsx`.
 */
import { createContext, useContext } from 'react'
import type { SocialSystem } from '@/engine/contracts'

const SocialSystemContext = createContext<SocialSystem | null>(null)

export const SocialSystemProvider = SocialSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useSocialSystem(): SocialSystem {
  const system = useContext(SocialSystemContext)
  if (!system) {
    throw new Error(
      'useSocialSystem: нет SocialSystem в контексте — оберни дерево в <SocialSystemProvider value={...}>',
    )
  }
  return system
}
