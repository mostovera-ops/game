/**
 * NetPlaque.tsx — мягкая плашка статуса сети (21-client §2.2/§5). Тёплый тон, не красный (P3).
 * `Working offline` / `Reconnecting…` / `All caught up!`.
 */

import { useStore } from '@/state'

export function NetPlaque() {
  const online = useStore((s) => s.net.online)
  const reconnecting = useStore((s) => s.net.reconnecting)
  const queueLen = useStore((s) => s.net.queueLen)

  if (online && !reconnecting && queueLen === 0) return null

  const label = !online
    ? 'Оффлайн — синхронизируем позже'
    : reconnecting
      ? 'Переподключаемся…'
      : 'Всё синхронизировано!'

  return (
    <div
      data-testid="net-plaque"
      className="pointer-events-none rounded-full bg-amber-200/90 px-3 py-1 text-sm font-medium text-amber-900 shadow"
    >
      {label}
      {queueLen > 0 ? ` · ${queueLen}` : ''}
    </div>
  )
}
