/**
 * engine/progression/system.ts — фабрика ProgressionSystem (engine/contracts.ts).
 *
 * Оркестрирует «намерение игрока» по прогрессии (исследование узла, назначение/апгрейд
 * стаффа, стрик): каждый метод — тонкая обёртка над `SystemContext.applyMutation`, которая
 * шлёт мутацию через `BackendAdapter` и возвращает `RpcResult`. Системе НЕЛЬЗЯ считать
 * результат самой (AGENTS.md §0.3) — итог всегда из ответа адаптера. Чистые формулы
 * (XP, Farm Value, стек модификаторов) — именованные экспорты барреля, не идут в adapter.
 *
 * ГРАНИЦА: зависит только от `@/types` и `@/engine/contracts`. Ноль three/react/net/state.
 */

import type {
  ResearchStartRes,
  StaffAssignReq,
  StaffUpgradeReq,
  StaffUpgradeRes,
  StreakCheckRes,
  StreakInsureRes,
} from '@/types'
import type { ProgressionSystem, SystemContext } from '@/engine/contracts'

/** Фабрика системы прогрессии — единственная точка входа для UI/сцены (AGENTS.md §2). */
export function createProgressionSystem(ctx: SystemContext): ProgressionSystem {
  return {
    research(nodeKey: string) {
      return ctx.applyMutation<ResearchStartRes>('research_start', { nodeKey })
    },

    assignStaff(req: StaffAssignReq) {
      return ctx.applyMutation<void>('staff_assign', req)
    },

    upgradeStaff(staffKey: StaffUpgradeReq['staffKey']) {
      return ctx.applyMutation<StaffUpgradeRes>('staff_upgrade', { staffKey })
    },

    streakCheck() {
      return ctx.applyMutation<StreakCheckRes>('streak_check', {})
    },

    streakInsure() {
      return ctx.applyMutation<StreakInsureRes>('streak_insure', {})
    },
  }
}
