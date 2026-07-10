/**
 * NotificationBell.tsx — колокол нотификаций (19-ui-ux §3.1 S4, §4.3 «бейджи»).
 * Красный кружок с числом, капается на 99+ (§4.3). Открывает `ui_notif_log` через
 * общий модальный каркас (`Modal`, `ui.activePanel`) — не рисует свой оверлей.
 */

import { useStore } from '@/state'

export function NotificationBell() {
  const notifications = useStore((s) => s.ui.notifications)
  const lastSeenAt = useStore((s) => s.ui.notifLastSeenAt)
  const openPanel = useStore((s) => s.openPanel)
  const markNotificationsSeen = useStore((s) => s.markNotificationsSeen)
  const serverNow = useStore((s) => s.serverNow)

  const unread = notifications.filter((n) => n.createdAt > lastSeenAt).length

  return (
    <button
      type="button"
      data-testid="notif-bell"
      aria-label="Notifications"
      onClick={() => {
        openPanel('ui_notif_log')
        markNotificationsSeen(serverNow())
      }}
      className="hud-tap-target pointer-events-auto relative flex items-center justify-center rounded-full bg-black/40 p-2 text-lg leading-none text-white/90 hover:text-white"
    >
      <span aria-hidden>🔔</span>
      {unread > 0 && (
        <span
          data-testid="notif-badge"
          className="tabular-nums absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ background: 'var(--cherry)' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
