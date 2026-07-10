/**
 * ui/social/AnimalSystemContext.tsx — DI-точка для `AnimalSystem` (engine/contracts.ts:
 * `feed`/`collect`/`rename`/`gift` — 03-animals, 20-backend §3.4.1 `rename_pet`/`affection_gift`).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку `AnimalSystem` (`createAnimalSystem`,
 * `@/engine/animals`) делает композиция (`app/backend.ts` уже строит `sys.animals`
 * для сцены фермы, farm-ui-seams). Эта зона (`ui-social-misc`) переиспользует ТОТ ЖЕ
 * системный объект для DOM-панели «карточка питомца» (`ui_pet_card`) — переименование
 * и подарок-ласка ласке не требуют канваса. Провайдер регистрируется композицией
 * (`app/SystemsProvider.tsx`) рядом с остальными, значение — `sys.animals`.
 */
import { createContext, useContext } from 'react'
import type { AnimalSystem } from '@/engine/contracts'

const AnimalSystemContext = createContext<AnimalSystem | null>(null)

export const AnimalSystemProvider = AnimalSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useAnimalSystem(): AnimalSystem {
  const system = useContext(AnimalSystemContext)
  if (!system) {
    throw new Error(
      'useAnimalSystem: нет AnimalSystem в контексте — оберни дерево в <AnimalSystemProvider value={...}>',
    )
  }
  return system
}
