/**
 * OverlayHost.tsx — точка монтирования Shell-оверлеев (19-ui-ux §3.1) поверх HUD.
 *
 * Единая система оверлеев = `Modal` (`./Modal.tsx`) + `ui.activePanel` (стор). Этот
 * компонент монтирует Modal-обёртки для панелей, которыми владеет зона `hud-nav`
 * (сейчас — только Notifications Center). Другие ui-агенты для СВОИХ панелей (Recipe
 * Box, Demand Board, Fair Stall…) делают то же самое в своих файлах: рендерят
 * `<Modal panelKey="ui_xxx" title="…">…</Modal>` где угодно в дереве — источник
 * истины один (`ui.activePanel`), так что открытых модалок не бывает больше одной.
 */

import { useStore } from '@/state'
import { Modal } from './Modal'
import { NotificationsPanel } from './NotificationsPanel'
import { panelTitle } from './labels'

export function OverlayHost() {
  const locale = useStore((s) => s.ui.locale)

  return (
    <Modal panelKey="ui_notif_log" title={panelTitle('ui_notif_log', locale)} variant="sheet">
      <NotificationsPanel />
    </Modal>
  )
}
