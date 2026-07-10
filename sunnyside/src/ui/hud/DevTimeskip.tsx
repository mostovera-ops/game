/**
 * DevTimeskip.tsx — таймскип-кнопка dev-режима (задача зоны `hud-nav`).
 *
 * Сдвигает клиентский `clock.serverOffset` (единственный источник `serverNow()`,
 * 21-client §3.6) вперёд на 1 час за клик — все таймеры, читающие `serverNow()`
 * (плашка дня, `isReady`/`remainingMs` панелей), воспринимают время как прошедшее.
 * Полезно для ручного QA без ожидания.
 *
 * РЕАЛЬНОЕ ускорение бэкенда: `LocalBackendAdapter` получает часы из `net/index.ts`,
 * чей `now()` = `Date.now() + clock.serverOffset` — тот же оффсет, что двигает эта
 * кнопка. Значит сдвиг здесь дозревает грядки/крафт/котёл на локальном сервере, а не
 * только клиентское восприятие. Композиция (app/backend `bootstrap`) слушает изменение
 * `serverOffset` и перегидрирует слайсы истиной адаптера — поле обновляется сразу.
 *
 * Лента уведомлений (bell-лог) больше НЕ заполняется отсюда демо-записью — реальные
 * нотификации идут через событийный канал адаптера (`net/adapters/local.ts`
 * `emitDomainEvents`/`sync` → `app/notifications.ts` `subscribeNotifications`) и диф
 * снапшотов (`noteHydration`). Раз местный сервер реально дозревает от сдвига offset —
 * следующая гидрация сама поднимет события, которые «созрели» за пропущенный час
 * (почта, грузовик, ярмарка, кооп-заказ, сосед полил грядки). Тост ниже — про само
 * dev-действие (не игровое событие).
 *
 * Гейт `isDebugEnabled()` (bootstrap/debug, чистая функция) — не в проде.
 */

import { useStore } from '@/state'
import { isDebugEnabled } from '@/bootstrap/debug'

const SKIP_MS = 60 * 60 * 1000 // 1 час

export function DevTimeskip() {
  const setServerOffset = useStore((s) => s.setServerOffset)
  const serverOffset = useStore((s) => s.clock.serverOffset)
  const pushToast = useStore((s) => s.pushToast)
  const serverNow = useStore((s) => s.serverNow)

  if (!isDebugEnabled()) return null

  const handleClick = () => {
    setServerOffset(serverOffset + SKIP_MS)
    const now = serverNow()
    pushToast({
      id: `dev-timeskip-${now}`,
      kind: 'info',
      message: '⏩ +1ч (dev) — clock.serverOffset сдвинут',
      createdAt: Date.now(),
      ttlMs: 6000,
    })
  }

  return (
    <button
      type="button"
      data-testid="dev-timeskip"
      onClick={handleClick}
      title="Dev only: +1ч к clock.serverOffset"
      className="hud-tap-target pointer-events-auto flex items-center justify-center rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/80 hover:text-white"
    >
      ⏩ +1ч
    </button>
  )
}
