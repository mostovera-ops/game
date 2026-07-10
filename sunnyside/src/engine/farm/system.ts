/**
 * engine/farm/system.ts — фабрика FarmSystem (engine/contracts.ts), 02-farm §3.4.
 *
 * Оркестрирует «намерение игрока» (посев/полив/сбор/апгрейд постройки): каждый
 * метод — тонкая обёртка над `SystemContext.applyMutation`, которая шлёт мутацию
 * через `BackendAdapter` и возвращает `RpcResult`. Системе НЕЛЬЗЯ считать награду
 * самой (AGENTS.md §0.3) — итог всегда берётся из ответа адаптера.
 *
 * ГРАНИЦА: зависит только от `@/types` и `@/engine/contracts`. Ноль three/react/net/state
 * (система не знает про zustand — оптимистичный патч, если нужен, накладывает вызывающая
 * сторона, замыкающая `SystemContext` поверх стора).
 */

import type { UUID } from '@/types'
import type { SowRes, WaterRes, HarvestRes, BuildingUpgradeRes } from '@/types'
import type { FarmSystem, SystemContext } from '@/engine/contracts'

/** Фабрика системы фермы — единственная точка входа для UI/сцены (AGENTS.md §2). */
export function createFarmSystem(ctx: SystemContext): FarmSystem {
  return {
    sow(slot: number, seedKey: string) {
      return ctx.applyMutation<SowRes>('sow', { slot, seedKey })
    },

    water(plotIds: UUID[]) {
      return ctx.applyMutation<WaterRes>('water', { plotIds })
    },

    harvest(plotIds: UUID[]) {
      return ctx.applyMutation<HarvestRes>('harvest', { plotIds })
    },

    upgradeBuilding(buildingKey: string) {
      return ctx.applyMutation<BuildingUpgradeRes>('building_upgrade', { buildingKey })
    },
  }
}
