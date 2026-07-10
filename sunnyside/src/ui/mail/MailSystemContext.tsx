/**
 * ui/mail/MailSystemContext.tsx — DI-точка для `MailForagingSystem` (order/speedup/claim/
 * snapshot — Каталог почтой, 08-mail-foraging §3.1). Панели `ui_mail_catalog`/`ui_mailbox`
 * читают систему отсюда.
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не ходит в `@/net` минуя `contracts.ts`
 * (AGENTS.md §3). Провайдер регистрируется композицией (`app/SystemsProvider.tsx`),
 * значение — `sys.mailForaging` (`app/backend.ts`, тот же объект, что уходит в `scene/town`).
 */
import { createContext, useContext } from 'react'
import type { MailForagingSystem } from '@/engine/contracts'

const MailSystemContext = createContext<MailForagingSystem | null>(null)

export const MailSystemProvider = MailSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useMailSystem(): MailForagingSystem {
  const system = useContext(MailSystemContext)
  if (!system) {
    throw new Error(
      'useMailSystem: нет MailForagingSystem в контексте — оберни дерево в <MailSystemProvider value={...}>',
    )
  }
  return system
}
