/**
 * state/chat.ts — кэш чата (W3 Street Chat, 11-town §3.9, 19-ui-ux §3.6). Истина —
 * серверная (`chat_messages` + Realtime broadcast, 20-backend §3.5); здесь только
 * кэш-снапшот на канал + метка последнего просмотра (unread-бейджи).
 *
 * НАПОЛНЕНИЕ (два источника, зеркалит `app/notifications.ts`):
 *  1) `app/chatBridge.ts` — Realtime-подписка на `town_chat`/`street_chat` (адаптер),
 *     сообщения других игроков приходят сюда broadcast'ом.
 *  2) `ui/chat/ChatPanel.tsx` — своё отправленное сообщение добавляется ЛОКАЛЬНО СРАЗУ
 *     ПОСЛЕ подтверждения `SocialSystem.chat()` (`res.ok`), а не оптимистично ДО ответа:
 *     у чата нет «отменяемой» половинки патча (в отличие от grядок/крафта), потому что
 *     нечего откатывать при отказе — сообщение либо есть, либо нет (rule AGENTS.md §0.3
 *     — сервер остаётся источником истины, id/at берутся из ответа RPC, не выдумываются).
 *
 * Канал-ключ = `channel` из `ChatPostReq`/`chat_messages.channel` (`town:{id}` |
 * `street:{id}`, 20-backend §3.4.2/§3.5) — БЕЗ суффикса `:chat` (тот — только имя
 * Realtime-топика в `net/adapters/*.ts`, `topicFor()`).
 */

import type { ChatMessage, EpochMs } from '@/types'
import type { SliceCreator } from './types'

/** Кап истории на канал (HUD-зона, зеркалит `NOTIF_LOG_CAP` в `state/ui.ts`). */
const CHAT_LOG_CAP = 200

export interface ChatChannelState {
  messages: ChatMessage[]
  /** Метка «прочитано до» для бейджа непрочитанных этой вкладки (19-ui-ux §4.3). */
  lastSeenAt: EpochMs
}

export interface ChatSlice {
  chat: {
    /** Ключ — `channel` (`town:{id}` | `street:{id}`). Отсутствует до первого сообщения/визита. */
    channels: Partial<Record<string, ChatChannelState>>
  }
  /** Добавляет сообщение в канал (дедуп по `id` — realtime-эхо своего же сообщения не дублирует). */
  pushChatMessage: (channel: string, message: ChatMessage) => void
  /** Отмечает канал прочитанным на момент `now` (снимает бейдж вкладки). */
  markChatSeen: (channel: string, now: EpochMs) => void
}

const emptyChannel = (): ChatChannelState => ({ messages: [], lastSeenAt: 0 })

export const createChatSlice: SliceCreator<ChatSlice> = (set) => ({
  chat: { channels: {} },

  pushChatMessage: (channel, message) =>
    set((s) => {
      const prev = s.chat.channels[channel] ?? emptyChannel()
      if (prev.messages.some((m) => m.id === message.id)) return s // дедуп (§ докстринг выше)
      const messages = [...prev.messages, message].slice(-CHAT_LOG_CAP)
      return { chat: { channels: { ...s.chat.channels, [channel]: { ...prev, messages } } } }
    }),

  markChatSeen: (channel, now) =>
    set((s) => {
      const prev = s.chat.channels[channel] ?? emptyChannel()
      return { chat: { channels: { ...s.chat.channels, [channel]: { ...prev, lastSeenAt: now } } } }
    }),
})
