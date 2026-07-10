/**
 * machines.ts — станки кухни и задания крафта (04-machines).
 * Модель таймера — «дедлайн, не отсчёт» (21-client §3.6): станок несёт readyAt.
 */

import type { UUID, EpochMs, Versioned, Quality } from './common'
import type { RecipeKey } from './recipes'
import type { ProductKey } from './ingredients'

/** Ключ станка (напр. `mac_stove`, `mac_grill`, `mac_oven`, `mac_churn`, `mac_smoker`). */
export type MachineKey = string

/** Пост стаффа (canon §3.2). */
export type StaffPost = 'Kitchen' | 'Field' | 'Counter' | 'Yard'

/** Определение станка (конфиг). */
export interface MachineDef {
  key: MachineKey
  post: StaffPost
  /** Сколько параллельных заданий (слотов очереди) держит станок. */
  slots: number
  /** Уровень апгрейда влияет на скорость/партию (×2.2 цена апгрейда, canon §2.2). */
  maxLevel: number
  assetKey?: string
}

/** Экземпляр станка на ферме (farm-слайс). */
export interface MachineInstance {
  id: UUID
  key: MachineKey
  level: number
  /** Активные задания в слотах. */
  jobs: MachineJob[]
}

/** Состояние задания крафта. */
export type CraftJobState = 'cooking' | 'ready' | 'collected'

/**
 * Задание крафта (machine_jobs, 20-backend §3.2.2).
 * craft_start списывает вход атомарно и ставит readyAt; craft_collect выдаёт выход.
 */
export interface MachineJob extends Versioned {
  id: UUID
  machineId: UUID
  recipeKey: RecipeKey
  batch: number
  state: CraftJobState
  startedAt: EpochMs
  /** Серверное время готовности. UI считает остаток readyAt − serverNow(). */
  readyAt: EpochMs
  output?: { key: ProductKey; qty: number; quality: Quality }
}
