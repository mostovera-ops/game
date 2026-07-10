/**
 * ui/migration/useTownListings.ts — подтягивает Town Browser (`TownSystem.listTowns`,
 * 12-migration §3.1.3) по требованию (не часть общего бутстрап-снапшота, см.
 * `app/backend.ts hydrateAll` докстринг) и кэширует в локальном состоянии компонента.
 *
 * Фикс UI-3: `res.ok===false` больше не тонет молча в пустой список — это выглядело
 * неотличимо от «реально нет городов». `error` (RpcError | null) отдаётся наружу,
 * `TownBrowser` рисует отдельный тёплый экран ошибки с ретраем (`refetch`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { RpcError, TownListing } from '@/types'
import { useTownSystem } from './TownSystemContext'

export interface UseTownListings {
  listings: TownListing[]
  loading: boolean
  error: RpcError | null
  refetch: () => void
}

export function useTownListings(): UseTownListings {
  const town = useTownSystem()
  const [listings, setListings] = useState<TownListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<RpcError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void town.listTowns().then((res) => {
      if (cancelled) return
      if (res.ok) {
        setListings(res.data)
        setError(null)
      } else {
        setListings([])
        setError(res.error)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [town, attempt])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  return { listings, loading, error, refetch }
}
