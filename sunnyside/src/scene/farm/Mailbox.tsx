/**
 * Mailbox.tsx — почтовый ящик у входа на ферму (08-mail-foraging §3.1.3: «визуальный
 * объект у входа на ферму с иконкой конверта; сбор — 1 клик»). Клик → панель `ui_mailbox`
 * (заказы «в пути» + забор посылок). Заглушка `decor_rustic_mailbox` (реестр ассетов).
 *
 * ГРАНИЦА: только рендер + вызов действия сцены (`useFarmActions().openMailbox`) — ноль
 * бизнес-правил/сети (AGENTS.md §3). Апдейт «пришла посылка» ведёт лента уведомлений
 * (`emit('inbox', …)` в адаптере), не этот компонент.
 */
import { memo } from 'react'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useHoverCursor } from '../common/useHoverCursor'
import { useFarmActions } from './systems'

/** Позиция у въезда на ферму (перед домом/гаражом, ближняя к камере кромка). */
const MAILBOX_POSITION: [number, number, number] = [-6.2, 0, 4.2]

export const Mailbox = memo(function Mailbox() {
  const actions = useFarmActions()
  const { onPointerOver, onPointerOut } = useHoverCursor()
  return (
    <group
      position={MAILBOX_POSITION}
      onClick={(e) => {
        e.stopPropagation()
        actions.openMailbox()
      }}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <PlaceholderMesh id="decor_rustic_mailbox" />
    </group>
  )
})
