/**
 * engine/craft/system.ts — фабрика `CraftSystem` (engine/contracts.ts): станки кухни,
 * очереди/партии/цепочки (04-machines.md). Оркестрация «намерение игрока → мутация»:
 * локальная валидация (очередь заполнена? хватает ли сырья? совпадает ли станок с
 * рецептом?) ОТСЕИВАЕТ очевидный отказ до сети, но НИЧЕГО не начисляет сама — фактический
 * джоб/выход всегда приходит из `RpcResult` адаптера через `ctx.applyMutation`
 * (AGENTS.md §0.3 анти-чит: клиент не считает награду).
 *
 * Доступ к текущему состоянию станка/склада система получает через `CraftSystemPorts` —
 * тонкие read-порты, которые подключает вызывающий (state-слой держит фактический стор,
 * craft-система его не импортирует, см. AGENTS.md §3 границы импортов).
 */
import type { CraftSystem, SystemContext } from '@/engine/contracts'
import type {
  UUID,
  RpcResult,
  ProductKey,
  RecipeKey,
  MachineInstance,
  CraftStartRes,
  CraftCollectRes,
  RecipeExperimentReq,
  RecipeExperimentRes,
} from '@/types'
import { getRecipe, getMachineDef } from './catalog'
import { queueCapacity, maxBatch } from './levels'

export interface CraftSystemPorts {
  /** Снапшот станка (id/key/level/jobs) — источник истины держит farm-слайс, не мы. */
  getMachine(machineId: UUID): MachineInstance | undefined
  /** Остаток продукта на складе (inventory-слайс). */
  getInventoryQty(key: ProductKey): number
  /** Есть ли у станка прямо сейчас активный овертайм-слот (+1 к ёмкости очереди, §3.8). */
  hasActiveOvertime?(machineId: UUID): boolean
}

function fail<T>(code: 'not_found' | 'invalid_payload' | 'insufficient_stock' | 'cap_reached', message: string): RpcResult<T> {
  return { ok: false, error: { code, message } }
}

/** Сколько слотов очереди станка занято (готовые-но-не-собранные партии тоже держат слот, §3.3). */
function occupiedSlots(machine: MachineInstance): number {
  return machine.jobs.filter((job) => job.state !== 'collected').length
}

export function createCraftSystem(ctx: SystemContext, ports: CraftSystemPorts): CraftSystem {
  return {
    async start(machineId: UUID, recipeKey: RecipeKey, batch: number): Promise<RpcResult<CraftStartRes>> {
      if (!Number.isInteger(batch) || batch < 1) {
        return fail('invalid_payload', `batch должен быть целым числом ≥1, получено ${batch}`)
      }

      const machine = ports.getMachine(machineId)
      if (!machine) return fail('not_found', `станок ${machineId} не найден на ферме`)

      const machineDef = getMachineDef(machine.key)
      if (!machineDef) return fail('not_found', `станок «${machine.key}» отсутствует в каталоге machines.ts`)

      const recipe = getRecipe(recipeKey)
      if (!recipe) return fail('not_found', `рецепт «${recipeKey}» отсутствует в каталоге recipes.ts`)

      if (recipe.machineKey !== machine.key) {
        return fail(
          'invalid_payload',
          `рецепт «${recipeKey}» готовится на «${recipe.machineKey}», станок ${machineId} — «${machine.key}»`,
        )
      }

      const capacity = queueCapacity(machine.level) + (ports.hasActiveOvertime?.(machineId) ? 1 : 0)
      const occupied = occupiedSlots(machine)
      if (occupied >= capacity) {
        return fail('cap_reached', `очередь станка «${machine.key}» заполнена (${occupied}/${capacity})`)
      }

      const batchCap = maxBatch(machine.key, machine.level)
      if (batch > batchCap) {
        return fail(
          'invalid_payload',
          `батч ${batch} превышает максимум станка «${machine.key}» Ур.${machine.level} (${batchCap})`,
        )
      }

      for (const input of recipe.inputs) {
        const need = input.qty * batch
        const have = ports.getInventoryQty(input.key)
        if (have < need) {
          return fail('insufficient_stock', `не хватает «${input.key}»: нужно ${need}, есть ${have}`)
        }
      }

      return ctx.applyMutation<CraftStartRes>('craft_start', { machineId, recipeKey, batch })
    },

    async collect(jobIds: UUID[]): Promise<RpcResult<CraftCollectRes>> {
      if (jobIds.length === 0) return fail('invalid_payload', 'collect: пустой список jobIds')
      return ctx.applyMutation<CraftCollectRes>('craft_collect', { jobIds })
    },

    async experiment(inputs: RecipeExperimentReq['inputs']): Promise<RpcResult<RecipeExperimentRes>> {
      if (inputs.length === 0) return fail('invalid_payload', 'experiment: нужен хотя бы один вход')
      return ctx.applyMutation<RecipeExperimentRes>('recipe_experiment', { inputs })
    },
  }
}
