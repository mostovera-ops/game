/**
 * engine/animals/system.ts — реализация `AnimalSystem` (engine/contracts.ts).
 *
 * Оркестрирует «намерение игрока»: кормление/сбор/переименование/подарок идут ЧЕРЕЗ
 * `SystemContext.applyMutation` → `BackendAdapter` (анти-чит, AGENTS.md §0.3). Система
 * сама ничего не начисляет — сервер реконструирует affection/quality/продукт; чистые
 * формулы предсказания живут в `./formulas.ts` и используются только для UI-предпросмотра.
 *
 * Оптимистичный патч в стор — забота вызывающего слайса (эта система его не знает,
 * граница `engine/ → state/` односторонняя, AGENTS.md §3): `optimistic` в
 * `applyMutation` передаётся опционально самим слайсом при подключении, здесь —
 * заглушка-noop по умолчанию, чтобы система была вызываема автономно (тесты/сборка).
 */

import type { AnimalSystem, SystemContext } from '@/engine/contracts'
import type {
  FeedAnimalReq,
  FeedAnimalRes,
  CollectAnimalProductReq,
  CollectAnimalProductRes,
  RenamePetReq,
  AffectionGiftReq,
  AffectionGiftRes,
} from '@/types'
import type { UUID } from '@/types/common'

/** Фабрика системы животных (владелец: agent «animals», AGENTS.md §2). */
export function createAnimalSystem(ctx: SystemContext): AnimalSystem {
  return {
    async feed(animalIds: UUID[]) {
      const payload: FeedAnimalReq = { animalIds }
      return ctx.applyMutation<FeedAnimalRes>('feed_animal', payload)
    },

    async collect(animalIds: UUID[]) {
      const payload: CollectAnimalProductReq = { animalIds }
      return ctx.applyMutation<CollectAnimalProductRes>('collect_animal_product', payload)
    },

    async rename(animalId: UUID, name: string) {
      const payload: RenamePetReq = { animalId, name }
      return ctx.applyMutation<void>('rename_pet', payload)
    },

    async gift(animalId: UUID, giftKey: string) {
      const payload: AffectionGiftReq = { animalId, giftKey: giftKey as AffectionGiftReq['giftKey'] }
      return ctx.applyMutation<AffectionGiftRes>('affection_gift', payload)
    },
  }
}
