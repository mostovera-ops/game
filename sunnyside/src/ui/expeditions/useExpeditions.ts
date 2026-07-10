/**
 * ui/expeditions/useExpeditions.ts — подтягивает снапшот роуд-трипа
 * (`ExpeditionSystem.list`, 07-expeditions §5) по требованию (не часть общего
 * бутстрап-снапшота, как `useTownListings`) и кэширует в локальном состоянии.
 *
 * `refetch` вызывается после `start`/`collect`, чтобы список активных рейсов и
 * слотов отражал подтверждённую сервером истину (AGENTS.md §0.3 — не считаем сами).
 * `res.ok===false` не тонет в пустой список: `error` отдаётся наружу, панель рисует
 * тёплый экран ошибки с ретраем.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ExpeditionsSnapshot, RpcError } from '@/types'
import { useExpeditionSystem } from './ExpeditionSystemContext'

export interface UseExpeditions {
  snapshot: ExpeditionsSnapshot | null
  loading: boolean
  error: RpcError | null
  refetch: () => void
}

export function useExpeditions(): UseExpeditions {
  const system = useExpeditionSystem()
  const [snapshot, setSnapshot] = useState<ExpeditionsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<RpcError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void system.list().then((res) => {
      if (cancelled) return
      if (res.ok) {
        setSnapshot(res.data)
        setError(null)
      } else {
        setError(res.error)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [system, attempt])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  return { snapshot, loading, error, refetch }
}
