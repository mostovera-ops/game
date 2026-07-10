/**
 * mail-foraging.ts — каталог почтой + фуражинг + рыбалка (08-mail-foraging).
 * mech_mail_catalog, mech_foraging. Обновление точек ежедневно (foraging_respawn).
 */

import type { UUID, EpochMs, Versioned, Quality } from './common'
import type { ProductKey } from './ingredients'

export type MailOrderState = 'in_transit' | 'delivered' | 'claimed'

/**
 * Заказ каталогом (mail_order). ≤5 в пути; лимиты Rare3/Decor1/Tools5; deliver_at +8–20ч.
 * mail_speedup — скип за ◉ (кэп ◉5, R3).
 */
export interface MailOrder extends Versioned {
  id: UUID
  itemKey: ProductKey
  qty: number
  state: MailOrderState
  orderedAt: EpochMs
  deliverAt: EpochMs
}

/**
 * Тип точки фуражинга. Лимит forage_daily — суммарный по типу/день (08 §3.2.3).
 * Канон-типы карты города — 4 точки (08 §3.2): грибы, ягоды, дикий мёд, рыбалка.
 * `fishing` — единственная активная мини-игра (08 §3.2.4); `wild_beehive` — дикий улей.
 */
export type ForageKind = 'mushroom' | 'berry' | 'herb' | 'flower' | 'fishing' | 'wild_beehive'

/**
 * Точка фуражинга на общей карте (Realtime `town:{id}:foraging`).
 * forage_claim/forage_collect — атомарный декремент пула (F6).
 */
export interface ForagePoint {
  id: UUID
  kind: ForageKind
  itemKey: ProductKey
  /** Остаток пула (декрементится атомарно). */
  remaining: number
  respawnAt?: EpochMs
}

/** Улов рыбалки (fish_cast). Гарантированный минимум Common (P3, «нет провала»). */
export interface FishCatch {
  itemKey: ProductKey
  quality: Quality
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

/** Снапшот почты/фуражинга (mail/foraging часть town-слайса или отдельно). */
export interface MailForagingSnapshot {
  orders: MailOrder[]
  foragePoints: ForagePoint[]
}
