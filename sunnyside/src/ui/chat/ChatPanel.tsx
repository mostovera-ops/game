/**
 * ChatPanel.tsx — W3 Street Chat (19-ui-ux §3.6, 11-town §3.9). Три вкладки-скоупа
 * `Town / Street / Feed` (Город/Стрит/Лента); Лента — алиас S4 Notifications
 * («персональная лента событий» в этом контексте, 19-ui-ux §3.6 W3 дословно) —
 * переиспользуем готовую `NotificationsPanel`, а не дублируем рендер (DRY).
 *
 * ГРАНИЦА: `ui/` не ходит в `@/net` (AGENTS.md §3, `lint:boundary`) — отправка идёт
 * через `SocialSystem.chat()` (DI, `ui/street/SocialSystemContext`, тот же провайдер,
 * что уже собирает композиция для помощи/подарков), приём чужих сообщений — через
 * Realtime-мост композиции (`app/chatBridge.ts`) в `state/chat.ts`, читаем селектором.
 *
 * ОПТИМИСТИКА (AGENTS.md §0.3): своё сообщение кладём в стор ТОЛЬКО после `res.ok` —
 * см. докстринг `state/chat.ts`. Отказ (`rate_limited`/`cap_reached`/`forbidden`/
 * `offline`/…) — тёплый тост (никогда не красный, P3) + текст остаётся в поле ввода,
 * чтобы можно было просто нажать «Отправить» ещё раз (упрощённый X-state «повтор»,
 * 19-ui-ux §3.6 W3 X). Лимиты/кулдауны — СЕРВЕРНАЯ истина (11-town §4.1, гипотезы,
 * финал в `14-economy.md`); клиент никогда не считает остаток лимита сам — только
 * короткий anti-spam debounce после отправки/отказа (`CLIENT_SEND_COOLDOWN_MS`,
 * `format.ts`) — это UX-подстраховка, не бизнес-правило.
 */

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { UUID } from '@/types'
import { DINER } from '../market/tokens'
import { useSocialSystem } from '../street/SocialSystemContext'
import { NotificationsPanel } from '../hud/NotificationsPanel'
import { EMOTE_STICKERS } from './catalog'
import {
  CHAT_BODY_MAX_LEN,
  CLIENT_SEND_COOLDOWN_MS,
  capBadge,
  streetChannelKey,
  townChannelKey,
  unreadCount,
  warmChatError,
} from './format'

type ChatTab = 'town' | 'street' | 'feed'

const RATE_LIMIT_COOLDOWN_MS = 5000

export function ChatPanel() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const identity = useStore((s) => s.session.identity)
  const chatChannels = useStore((s) => s.chat.channels)
  const notifications = useStore((s) => s.ui.notifications)
  const notifLastSeenAt = useStore((s) => s.ui.notifLastSeenAt)
  const town = useStore((s) => s.town)
  const serverNow = useStore((s) => s.serverNow)
  const markChatSeen = useStore((s) => s.markChatSeen)
  const markNotificationsSeen = useStore((s) => s.markNotificationsSeen)
  const pushChatMessage = useStore((s) => s.pushChatMessage)
  const pushToast = useStore((s) => s.pushToast)
  const social = useSocialSystem()

  const [tab, setTab] = useState<ChatTab>('town')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  const townKey = identity?.townId ? townChannelKey(identity.townId) : null
  const streetKey = identity?.streetId ? streetChannelKey(identity.streetId) : null

  const townMessages = useMemo(
    () => (townKey ? (chatChannels[townKey]?.messages ?? []) : []),
    [chatChannels, townKey],
  )
  const streetMessages = useMemo(
    () => (streetKey ? (chatChannels[streetKey]?.messages ?? []) : []),
    [chatChannels, streetKey],
  )
  const townLastSeen = (townKey && chatChannels[townKey]?.lastSeenAt) || 0
  const streetLastSeen = (streetKey && chatChannels[streetKey]?.lastSeenAt) || 0

  const townUnread = unreadCount(townMessages, townLastSeen)
  const streetUnread = unreadCount(streetMessages, streetLastSeen)
  const feedUnread = notifications.filter((n) => n.createdAt > notifLastSeenAt).length

  const activeKey = tab === 'town' ? townKey : tab === 'street' ? streetKey : null
  const activeMessages = tab === 'town' ? townMessages : tab === 'street' ? streetMessages : []

  // Открыл вкладку → она прочитана (снимает бейдж, 19-ui-ux §4.3). Не трогаем вкладки,
  // которые сейчас не смотрим — только активную, при её смене/при новых сообщениях в ней.
  useEffect(() => {
    const now = serverNow()
    if (tab === 'town' && townKey) markChatSeen(townKey, now)
    else if (tab === 'street' && streetKey) markChatSeen(streetKey, now)
    else if (tab === 'feed') markNotificationsSeen(now)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, townKey, streetKey, townMessages.length, streetMessages.length, notifications.length])

  function authorName(authorId: UUID): string {
    if (identity && authorId === identity.userId) return ru ? 'Ты' : 'You'
    return town?.roster.find((r) => r.userId === authorId)?.displayName ?? authorId
  }

  async function send(text: string, stickerKey?: string) {
    if (!activeKey || busy) return
    const trimmed = text.trim().slice(0, CHAT_BODY_MAX_LEN)
    if (!trimmed) return
    if (Date.now() < cooldownUntil) return

    setBusy(true)
    try {
      const res = await social.chat(activeKey, trimmed, stickerKey)
      if (res.ok) {
        pushChatMessage(activeKey, {
          id: res.data.messageId,
          channel: activeKey,
          authorId: identity?.userId ?? 'me',
          body: trimmed,
          stickerKey,
          at: new Date(serverNow()).toISOString(),
        })
        setBody('')
        setPickerOpen(false)
        setCooldownUntil(Date.now() + CLIENT_SEND_COOLDOWN_MS)
      } else {
        pushToast({
          id: `chat_err_${Date.now()}`,
          kind: 'warn',
          message: warmChatError(res.error.code, ru),
          createdAt: Date.now(),
          ttlMs: 6000,
        })
        if (res.error.code === 'rate_limited') setCooldownUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS)
      }
    } finally {
      setBusy(false)
    }
  }

  const TABS: { key: ChatTab; label: string; unread: number }[] = [
    { key: 'town', label: ru ? 'Город' : 'Town', unread: townUnread },
    { key: 'street', label: ru ? 'Стрит' : 'Street', unread: streetUnread },
    { key: 'feed', label: ru ? 'Лента' : 'Feed', unread: feedUnread },
  ]

  return (
    <section
      data-testid="ui-chat-panel"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3"
      style={{ color: DINER.board }}
    >
      <nav data-testid="chat-tabs" className="flex gap-1 border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`chat-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className="relative flex-1 rounded-lg px-2 py-1.5 text-sm font-bold uppercase tracking-wide"
            style={{
              background: tab === t.key ? DINER.cherry : 'transparent',
              color: tab === t.key ? '#fff' : DINER.board,
            }}
          >
            {t.label}
            {t.unread > 0 && (
              <span
                data-testid={`chat-tab-badge-${t.key}`}
                className="tabular-nums absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: DINER.teal }}
              >
                {capBadge(t.unread)}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'feed' ? (
        <NotificationsPanel />
      ) : !activeKey ? (
        <p data-testid="chat-empty-no-channel" className="py-6 text-center italic opacity-70">
          {ru ? 'Стрит формируется — чат откроется, когда появятся соседи.' : 'Street’s still forming — chat opens once neighbors arrive.'}
        </p>
      ) : (
        <>
          <ul data-testid="chat-message-list" className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {activeMessages.length === 0 ? (
              <p data-testid="chat-empty-messages" className="py-6 text-center italic opacity-70">
                {ru ? 'Начни разговор.' : 'Start a conversation.'}
              </p>
            ) : (
              activeMessages.map((m) => {
                const sticker = m.stickerKey ? EMOTE_STICKERS.find((s) => s.key === m.stickerKey) : undefined
                return (
                  <li key={m.id} data-testid={`chat-message-${m.id}`} className="hud-ticket px-3 py-2 text-sm">
                    <span className="font-bold">{authorName(m.authorId)}</span>
                    {': '}
                    {sticker && <span aria-hidden>{sticker.glyph} </span>}
                    <span>{m.body}</span>
                  </li>
                )
              })
            )}
          </ul>

          <div className="flex flex-col gap-2">
            {pickerOpen && (
              <div data-testid="chat-sticker-picker" className="grid grid-cols-6 gap-1 rounded-lg border border-dashed p-2" style={{ borderColor: DINER.chrome }}>
                {EMOTE_STICKERS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    data-testid={`chat-sticker-${s.key}`}
                    title={ru ? s.label.ru : s.label.en}
                    disabled={busy}
                    onClick={() => void send(ru ? s.label.ru : s.label.en, s.key)}
                    className="rounded p-1.5 text-lg hover:bg-black/5 disabled:opacity-40"
                  >
                    {s.glyph}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="chat-sticker-toggle"
                aria-label={ru ? 'Стикеры' : 'Stickers'}
                onClick={() => setPickerOpen((v) => !v)}
                className="rounded-lg px-2 py-2 text-lg"
                style={{ background: DINER.paper }}
              >
                😊
              </button>
              <input
                data-testid="chat-composer-input"
                type="text"
                value={body}
                maxLength={CHAT_BODY_MAX_LEN}
                placeholder={ru ? 'Написать в чат…' : 'Write a message…'}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send(body)
                }}
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: DINER.chrome }}
              />
              <button
                type="button"
                data-testid="chat-send-btn"
                disabled={busy || !body.trim()}
                onClick={() => void send(body)}
                className="rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: DINER.cherry }}
              >
                {ru ? 'Отправить' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
