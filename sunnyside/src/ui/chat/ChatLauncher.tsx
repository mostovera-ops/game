/**
 * ChatLauncher.tsx — вход в W3 Street Chat из HUD-марки, зеркалит `NotificationBell`
 * (19-ui-ux §4.3 «бейджи», hud-nav зона) буквально: тот же визуальный язык кружка-бейджа,
 * тот же приём открытия через общий `ui.activePanel`/`Modal` (`ui_chat`, `app/PanelHost.tsx`).
 * Бейдж — суммарный unread по Town+Street+Feed (детальный разбор по вкладкам — внутри
 * самой панели, `ChatPanel.tsx`), капается на 99+ как и колокол нотификаций.
 */

import { useStore } from '@/state'
import { capBadge, streetChannelKey, townChannelKey, unreadCount } from './format'

export function ChatLauncher() {
  const identity = useStore((s) => s.session.identity)
  const chatChannels = useStore((s) => s.chat.channels)
  const notifications = useStore((s) => s.ui.notifications)
  const notifLastSeenAt = useStore((s) => s.ui.notifLastSeenAt)
  const openPanel = useStore((s) => s.openPanel)

  const townKey = identity?.townId ? townChannelKey(identity.townId) : null
  const streetKey = identity?.streetId ? streetChannelKey(identity.streetId) : null

  const townUnread = townKey ? unreadCount(chatChannels[townKey]?.messages ?? [], chatChannels[townKey]?.lastSeenAt ?? 0) : 0
  const streetUnread = streetKey
    ? unreadCount(chatChannels[streetKey]?.messages ?? [], chatChannels[streetKey]?.lastSeenAt ?? 0)
    : 0
  const feedUnread = notifications.filter((n) => n.createdAt > notifLastSeenAt).length
  const total = townUnread + streetUnread + feedUnread

  return (
    <button
      type="button"
      data-testid="chat-launcher"
      aria-label="Chat"
      onClick={() => openPanel('ui_chat')}
      className="hud-tap-target pointer-events-auto relative flex items-center justify-center rounded-full bg-black/40 p-2 text-lg leading-none text-white/90 hover:text-white"
    >
      <span aria-hidden>💬</span>
      {total > 0 && (
        <span
          data-testid="chat-launcher-badge"
          className="tabular-nums absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ background: 'var(--cherry)' }}
        >
          {capBadge(total)}
        </span>
      )}
    </button>
  )
}
