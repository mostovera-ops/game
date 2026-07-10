/**
 * app/chatBridge.ts — мост «Realtime-канал чата → `state/chat.ts`» (W3 Street Chat,
 * 11-town §3.9, 19-ui-ux §3.6). Зеркалит `app/notifications.ts` один-в-один: `ui/chat/`
 * не имеет права ходить в `@/net` (граница, `lint:boundary`), поэтому подписку на
 * `BackendAdapter.subscribe('town_chat' | 'street_chat', …)` держит композиция
 * (`src/app/**`), а панель читает уже готовый кэш через `useStore(s => s.chat)`.
 *
 * ДВА КАНАЛА, ОДИН КОНТРАКТ: `local` эмитит по своим тикам (сейчас — не эмитит чат-events,
 * см. TODO(net-agent) в `net/adapters/local.ts` `chatPost` — локальный стаб пока не
 * рассылает отправленное сообщение обратно в канал; `ChatPanel.tsx` поэтому кладёт СВОЁ
 * подтверждённое сообщение в стор напрямую, см. докстринг `state/chat.ts`); `supabase`
 * рассылает реальный Postgres broadcast (20-backend §3.5) — этот мост не знает, какая
 * реализация активна, только конвертирует payload → `ChatMessage`.
 *
 * ГРАНИЦА: композиция (`src/app/**`, вне правил `lint:boundary`), как `notifications.ts`.
 */

import { useStore } from '@/state'
import type { BackendAdapter, Unsubscribe } from '@/engine/contracts'
import type { ChatMessage, RealtimeChannelKind } from '@/types'

const CHAT_CHANNELS: readonly RealtimeChannelKind[] = ['town_chat', 'street_chat']

/** Канал-ключ (`town:{id}`/`street:{id}`, БЕЗ `:chat` — см. `state/chat.ts` докстринг). */
function channelKeyFor(kind: RealtimeChannelKind, townId?: string, streetId?: string): string | null {
  if (kind === 'town_chat') return townId ? `town:${townId}` : null
  if (kind === 'street_chat') return streetId ? `street:${streetId}` : null
  return null
}

/** Монотонный счётчик — уникальный fallback-id, если payload его не дал (best-effort). */
let payloadSeq = 0

/**
 * Мап сырого Realtime-payload в `ChatMessage` (best-effort: сервер — истина, но точная
 * форма broadcast-payload для `chat_post`/CDC ещё не зафиксирована — RPC не задеплоен,
 * см. `supabase/APPLIED.md`). Понимает и camelCase (клиентские типы), и snake_case
 * (сырые строки Postgres) поля; неопознанный payload — тихо игнорируется (как в
 * `payloadToNotification`), не роняя мост.
 */
function payloadToChatMessage(fallbackChannel: string, payload: unknown, now: number): ChatMessage | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

  const body = str(p.body) ?? str(p.message)
  if (!body) return null

  payloadSeq += 1
  return {
    id: str(p.id) ?? `rt-chat-${now}-${payloadSeq}`,
    channel: str(p.channel) ?? fallbackChannel,
    authorId: str(p.authorId) ?? str(p.author_id) ?? 'unknown',
    body,
    stickerKey: str(p.stickerKey) ?? str(p.sticker_key),
    at: str(p.at) ?? str(p.created_at) ?? new Date(now).toISOString(),
  }
}

/**
 * Подписка на `town_chat`/`street_chat`. Вызывается один раз на бутстрапе
 * (`app/backend.ts`, зеркалит `subscribeNotifications`). Возвращает функцию отписки
 * от обоих каналов разом.
 */
export function subscribeChat(adapter: BackendAdapter): Unsubscribe {
  const unsubs: Unsubscribe[] = CHAT_CHANNELS.map((kind) =>
    adapter.subscribe(kind, (payload) => {
      const s = useStore.getState()
      const identity = s.session.identity
      const fallback = channelKeyFor(kind, identity?.townId, identity?.streetId)
      if (!fallback) return // контекст (town/street) ещё неизвестен — сообщение придёт снова при ресинке
      const msg = payloadToChatMessage(fallback, payload, s.serverNow())
      if (msg) s.pushChatMessage(msg.channel, msg)
    }),
  )
  return () => unsubs.forEach((u) => u())
}
