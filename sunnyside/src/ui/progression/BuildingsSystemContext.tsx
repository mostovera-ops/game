/**
 * ui/progression/BuildingsSystemContext.tsx — DI-точка для апгрейда построек (F3 Building
 * Upgrade, 19-ui-ux §3.2 F3 / 13-progression §3.3).
 *
 * Постройки — данные фермы (`FarmSnapshot.buildings`, зона `state/farm.ts` + `scene/farm`),
 * но мутация `building_upgrade` — метод контракта `FarmSystem` (engine/contracts.ts), не
 * `ProgressionSystem`. Экран построек при этом — наш UI-канон-пункт (13-progression §5
 * `ui_buildings`). Берём УЗКИЙ срез контракта (`Pick<FarmSystem,'upgradeBuilding'>`), чтобы
 * не тянуть зависимость на весь `FarmSystem` ради одного метода — композиция передаёт тот
 * же объект, что и в `farm`-зоне (не дублирует реализацию, см. AGENTS.md §2/§3).
 */
import { createContext, useContext } from 'react'
import type { FarmSystem } from '@/engine/contracts'

export type BuildingsSystem = Pick<FarmSystem, 'upgradeBuilding'>

const BuildingsSystemContext = createContext<BuildingsSystem | null>(null)

export const BuildingsSystemProvider = BuildingsSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useBuildingsSystem(): BuildingsSystem {
  const system = useContext(BuildingsSystemContext)
  if (!system) {
    throw new Error(
      'useBuildingsSystem: нет BuildingsSystem в контексте — оберни дерево в ' +
        '<BuildingsSystemProvider value={farmSystem}>',
    )
  }
  return system
}
