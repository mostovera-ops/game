/**
 * net.ts — сетевой слой: очередь мутаций, автомат состояний, Realtime-каналы (21-client §3.5).
 * Каждая мутация оптимистична → очередь (IndexedDB) → RPC → confirm/conflict.
 */

import type { EpochMs } from './common'

/**
 * Вид мутации = имя RPC 1:1 с 20-backend §3.4.1 (горячий путь).
 * net/rpc.ts — типизированные обёртки к этому списку.
 */
export type MutationKind =
  // ферма/производство
  | 'sow'
  | 'water'
  | 'harvest'
  | 'craft_start'
  | 'craft_collect'
  | 'sell_to_market'
  | 'building_upgrade'
  // животные
  | 'feed_animal'
  | 'collect_animal_product'
  | 'rename_pet'
  | 'affection_gift'
  // ярмарка/смена
  | 'fair_open'
  | 'fair_list'
  | 'fair_tent_upgrade'
  | 'contest_enter'
  | 'contest_vote'
  | 'shift_submit'
  // кооп/город/ивент
  | 'coop_contribute'
  | 'potluck_contribute'
  | 'event_contribute'
  // соц
  | 'help_neighbor'
  | 'gift_send'
  | 'neighbor_sit'
  | 'chat_post'
  // прогрессия/стафф
  | 'research_start'
  | 'staff_assign'
  | 'staff_upgrade'
  // экспедиции/почта/фуражинг
  | 'expedition_start'
  | 'expedition_collect'
  | 'mail_order'
  | 'mail_speedup'
  | 'mail_claim'
  | 'forage_claim'
  | 'forage_collect'
  | 'fish_cast'
  // стрик/отпуск/декор
  | 'streak_check'
  | 'streak_insure'
  | 'vacation_start'
  | 'vacation_end'
  | 'decor_purchase'
  | 'decor_place'
  | 'neon_save'
  | 'recipe_experiment'
  // монетизация/переезды (переезды — Edge, но инициируются как мутации)
  | 'prize_pull'
  | 'migration_propose'
  | 'migration_vote'
  | 'migrate_farm'

/** Автомат состояния мутации (21-client §3.5, §4.2). */
export type MutationState =
  | 'optimistic'
  | 'queued'
  | 'in_flight'
  | 'confirmed'
  | 'conflict'
  | 'rollback'

/**
 * Элемент оффлайн-очереди (IndexedDB через idb). Переживает перезагрузку/закрытие.
 * clientMutationId — локальный ключ (защита от повторного flush одного элемента).
 */
export interface QueuedMutation<P = unknown> {
  clientMutationId: string
  kind: MutationKind
  payload: P
  /** version объекта на момент оптимистичного применения (сервер-побеждает). */
  baseVersion?: number
  state: MutationState
  enqueuedAt: EpochMs
  attempts: number
}

/** Статус Realtime-канала. */
export type ChannelStatus = 'subscribed' | 'reconnecting' | 'closed' | 'error'

/** Каналы Realtime (20-backend §3.5). Только рассылка; клиент не пишет. */
export type RealtimeChannelKind =
  | 'calendar'
  | 'event'
  | 'foraging'
  | 'projects'
  | 'fair'
  | 'versus'
  | 'street_chat'
  | 'town_chat'
  | 'street_board'
  | 'inbox'

/** Состояние net-слайса (21-client §3.4). */
export interface NetState {
  online: boolean
  reconnecting: boolean
  queueLen: number
  lastSyncAt: EpochMs | null
  channelStatus: Partial<Record<RealtimeChannelKind, ChannelStatus>>
}

/** Тайминги сетевого слоя (21-client §4.3, гипотезы). */
export const NET_TIMINGS = {
  rpcTargetP50Ms: 250,
  serverOffsetRefreshMs: 10 * 60 * 1000,
  offsetSamples: 3,
  realtimeEventsPerSecond: 5,
  liteModeFpsFloor: 45,
  liteModeWindowMs: 2000,
  pollFallbackMs: 30_000,
  backoff: (n: number): number =>
    Math.min(30_000, 2 ** n * 500) * (0.8 + Math.random() * 0.4),
} as const
