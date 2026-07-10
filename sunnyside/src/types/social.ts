/**
 * social.ts — соц-структура и соц-действия (canon §2.4, §3.13; 11-town).
 * Ферма → Стрит (10–20) → Город (100–200) → [v2] Регион.
 */

import type { UUID, ISOTimestamp } from './common'

/** Слои соц-структуры. */
export type SocialLayer = 'farm' | 'street' | 'town' | 'region'

/** Идентичность игрока в графе (session-слайс). */
export interface PlayerIdentity {
  userId: UUID
  farmId: UUID
  streetId: UUID
  townId: UUID
  displayName: string
  authStatus: 'anon' | 'authenticated' | 'guest'
}

/** Соседская помощь (help_neighbor, 20-backend §3.4.1). Лимит ≤3/target/day. */
export type HelpActionType = 'water' | 'feed' | 'cheer' | 'sit'

export interface HelpAction {
  actorId: UUID
  targetId: UUID
  type: HelpActionType
  gameDay: string
  at: ISOTimestamp
}

/** Подарок соседу (gift_send). NP-кэп, ≤3 одному/день. */
export interface Gift {
  fromId: UUID
  toId: UUID
  itemKey: string
  qty: number
  at: ISOTimestamp
}

/** Присмотр за фермой в отпуске (neighbor_sit). 1 награда/ферма/день. */
export interface NeighborSit {
  hostId: UUID
  sitterId: UUID
  gameDay: string
}

/** Сообщение чата стрита/города (chat_post). */
export interface ChatMessage {
  id: UUID
  channel: string
  authorId: UUID
  body: string
  stickerKey?: string
  at: ISOTimestamp
}

/** Presence (кто онлайн) — эфемерно, Realtime Presence, не в БД. */
export interface PresenceEntry {
  userId: UUID
  displayName: string
  onlineAt: ISOTimestamp
}

/** Менторство «Heroes → Staff» соц-часть: ментор ≤2 менти (20-backend §3.7). */
export interface MentorLink {
  mentorId: UUID
  menteeId: UUID
  since: ISOTimestamp
}
