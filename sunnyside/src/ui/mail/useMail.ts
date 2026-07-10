/**
 * ui/mail/useMail.ts — хуки данных Каталога почтой: снапшот заказов (по требованию,
 * `MailForagingSystem.snapshot`) и секундный тик для обратных отсчётов ETA/Last Call.
 *
 * ГРАНИЦА: ноль three/net. Читает систему через контекст (`useMailSystem`), время —
 * через `serverNow()` стора (AGENTS.md §0.4). Снапшот — рантайм-only (не персист).
 */
import { useCallback, useEffect, useState } from 'react'
import type { MailOrder } from '@/types'
import { useMailSystem } from './MailSystemContext'

/** Заказы игрока + функция ручного обновления (после order/speedup/claim). */
export function useMailSnapshot(): { orders: MailOrder[]; refresh: () => void; loading: boolean } {
  const mail = useMailSystem()
  const [orders, setOrders] = useState<MailOrder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    let cancelled = false
    setLoading(true)
    void mail.snapshot().then((res) => {
      if (cancelled) return
      if (res.ok) setOrders(res.data.orders)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mail])

  useEffect(() => refresh(), [refresh])

  return { orders, refresh, loading }
}

/** Секундный тик — источник перерисовки живых таймеров (значение = счётчик кадров). */
export function useTick(active: boolean, everyMs = 1000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return tick
}
