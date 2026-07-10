/**
 * ui/chat/format.ts — чистые хелперы панели чата (W3, 11-town §3.9, 19-ui-ux §3.6).
 * Ноль сети/подсчёта лимитов — те решает сервер (AGENTS.md §0.3); здесь только
 * презентация готовых данных, node-тестируемо (AGENTS.md §4 уровень 1).
 */

import type { ChatMessage, EpochMs, RpcErrorCode } from '@/types'

/** Канал города (`town:{id}`, БЕЗ `:chat` — см. `state/chat.ts` докстринг). */
export function townChannelKey(townId: string): string {
  return `town:${townId}`
}

/** Канал стрита (`street:{id}`). */
export function streetChannelKey(streetId: string): string {
  return `street:${streetId}`
}

/** Кол-во сообщений канала, пришедших ПОСЛЕ `lastSeenAt` — источник unread-бейджа вкладки. */
export function unreadCount(messages: readonly ChatMessage[], lastSeenAt: EpochMs): number {
  if (messages.length === 0) return 0
  return messages.filter((m) => Date.parse(m.at) > lastSeenAt).length
}

/** Кап отображаемого числа бейджа (19-ui-ux §4.3, зеркалит `NotificationBell`). */
export function capBadge(n: number): string {
  return n > 99 ? '99+' : String(n)
}

/** Тёплый (никогда не красный, P3) текст отказа отправки — presentation-only маппинг. */
export function warmChatError(code: RpcErrorCode, ru: boolean): string {
  switch (code) {
    case 'rate_limited':
      return ru ? 'Многовато сообщений подряд — переведи дух и повтори.' : 'Sending a bit fast — take a breath and retry.'
    case 'cap_reached':
      return ru ? 'На сегодня в этом канале тихо — загляни позже.' : 'This channel’s quiet for today — check back later.'
    case 'forbidden':
      return ru ? 'Этот канал пока не твой — вступи в стрит, чтобы писать.' : 'Not your channel yet — join a street to chat here.'
    case 'offline':
      return ru ? 'Оффлайн — сообщение не ушло, попробуй ещё раз.' : 'Offline — message didn’t send, try again.'
    default:
      return ru ? 'Не получилось отправить — попробуй ещё раз.' : 'Couldn’t send — try again.'
  }
}

/** Локальный anti-spam debounce (UX-подстраховка, НЕ бизнес-лимит — тот на сервере). */
export const CLIENT_SEND_COOLDOWN_MS = 1200

/** Максимальная длина тела сообщения (`chat_messages.body ≤500 симв`, 20-backend). */
export const CHAT_BODY_MAX_LEN = 500
