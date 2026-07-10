/**
 * animals.ts — животные, кормление, привязанность, продукт (03-animals).
 * Модель таймера — дедлайн product_ready_at; quality от affection/housing.
 */

import type { UUID, EpochMs, Versioned, Quality } from './common'
import type { ProductKey } from './ingredients'

/** Вид животного (гипотеза реестра; мастер — 03-animals). */
export type AnimalKind =
  | 'chicken' // яйца
  | 'cow' // молоко
  | 'pig' // бекон
  | 'goat' // молоко
  | 'sheep' // шерсть
  | 'bee' // мёд/воск (bld_apiary)

/** Где живёт (влияет на housing-бонус качества). */
export type AnimalHousing = 'bld_barn' | 'bld_coop' | 'bld_apiary'

/**
 * Экземпляр животного (animals, 20-backend §3.2.12).
 * feed_animal ставит product_ready_at (Clara −цикл); collect_animal_product выдаёт.
 */
export interface Animal extends Versioned {
  id: UUID
  kind: AnimalKind
  housing: AnimalHousing
  name?: string // rename_pet (уникально на ферме)
  /** Привязанность (affection_gift: 1/животное/неделя). Влияет на quality продукта. */
  affection: number
  productKey: ProductKey
  /** Готов ли продукт: serverNow() ≥ productReadyAt. */
  productReadyAt?: EpochMs
  lastQuality?: Quality
}
