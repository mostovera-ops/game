/**
 * ui/farm/FarmSystemContext.tsx — DI-точка для посева (F1 Seed Picker, farm-ui-seams).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: та же причина, что у `ui/kitchen/CraftSystemContext.tsx`
 * — `ui/` не имеет права ходить в `@/net` (AGENTS.md §3, `lint:boundary`), сборку `FarmSystem`
 * (адаптер + `SystemContext`) делает композиция (`src/app/backend.ts`/`SystemsProvider.tsx`).
 *
 * УЗКИЙ СРЕЗ (`Pick<FarmSystem, 'sow'>`): Seed Picker'у нужен только посев — полив/сбор/
 * апгрейд идут через сцену (`scene/farm/systems.tsx`) или другую панель
 * (`ui/progression/BuildingsSystemContext.tsx` — тот же приём: узкий `Pick`, композиция
 * передаёт ОДИН И ТОТ ЖЕ объект `AppSystems.farm` в оба контекста, не дублирует реализацию).
 */
import { createContext, useContext } from 'react'
import type { FarmSystem } from '@/engine/contracts'

export type SeedSystem = Pick<FarmSystem, 'sow'>

const FarmSystemContext = createContext<SeedSystem | null>(null)

export const FarmSystemProvider = FarmSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useFarmSystem(): SeedSystem {
  const system = useContext(FarmSystemContext)
  if (!system) {
    throw new Error(
      'useFarmSystem: нет FarmSystem в контексте — оберни дерево в <FarmSystemProvider value={farmSystem}>',
    )
  }
  return system
}
