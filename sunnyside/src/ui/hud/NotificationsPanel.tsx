/**
 * NotificationsPanel.tsx — содержимое S4 Notifications Center (19-ui-ux §3.1).
 * Хронология событий из `ui.notifications` (HUD-слайс). E: «Тихий день в Санисайде».
 */

import { useStore } from '@/state'
import { pick, EMPTY_NOTIF_LOG } from './labels'

const KIND_ICON: Record<string, string> = { social: '🧑‍🌾', server: '📣', system: '⏱️' }

export function NotificationsPanel() {
  const notifications = useStore((s) => s.ui.notifications)
  const locale = useStore((s) => s.ui.locale)

  if (notifications.length === 0) {
    return (
      <p data-testid="notif-empty" className="py-6 text-center text-sm opacity-70">
        {pick(EMPTY_NOTIF_LOG, locale)}
      </p>
    )
  }

  return (
    <ul data-testid="notif-list" className="max-h-80 space-y-2 overflow-y-auto">
      {notifications.map((n) => (
        <li key={n.id} className="hud-ticket flex items-start gap-2 px-3 py-2 text-sm">
          <span aria-hidden>{KIND_ICON[n.kind] ?? '•'}</span>
          <span>{n.message}</span>
        </li>
      ))}
    </ul>
  )
}
