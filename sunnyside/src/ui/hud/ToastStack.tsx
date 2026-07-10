/**
 * ToastStack.tsx — тост-стек (19-ui-ux §3.1 S5 / §4.6). Авто-скрытие по `ttlMs`
 * (гипотеза 6с, §4.6). Тон всегда тёплый (canon P3) — даже `warn` не «красная тревога»,
 * просто акцент cherry (токены §4.5: «--cherry … ошибки-мягко»), никогда системный красный.
 */

import { useEffect } from 'react'
import { useStore } from '@/state'
import type { Toast } from '@/types'

const KIND_STYLE: Record<Toast['kind'], string> = {
  info: 'border-l-4 border-[var(--teal)]',
  success: 'border-l-4 border-[var(--mustard)]',
  warn: 'border-l-4 border-[var(--cherry)]',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useStore((s) => s.dismissToast)

  useEffect(() => {
    const elapsed = Date.now() - toast.createdAt
    const remaining = Math.max(0, toast.ttlMs - elapsed)
    const t = setTimeout(() => dismissToast(toast.id), remaining)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  return (
    <div
      data-testid={`toast-${toast.id}`}
      className={`hud-receipt pointer-events-auto px-4 py-2 text-sm shadow ${KIND_STYLE[toast.kind]}`}
      role="status"
    >
      {toast.message}
    </div>
  )
}

export function ToastStack() {
  const toasts = useStore((s) => s.ui.toasts)
  if (toasts.length === 0) return null

  return (
    <div
      data-testid="toast-stack"
      className="pointer-events-none absolute bottom-20 left-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
