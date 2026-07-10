/**
 * ui/migration/useTownListings.ts — подтягивает Town Browser (`TownSystem.listTowns`,
 * 12-migration §3.1.3) по требованию (не часть общего бутстрап-снапшота, см.
 * `app/backend.ts hydrateAll` докстринг) и кэширует в локальном состоянии компонента.
 */
import { useEffect, useState } from 'react'
import type { TownListing } from '@/types'
import { useTownSystem } from './TownSystemContext'

export interface UseTownListings {
  listings: TownListing[]
  loading: boolean
}

export function useTownListings(): UseTownListings {
  const town = useTownSystem()
  const [listings, setListings] = useState<TownListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void town.listTowns().then((res) => {
      if (cancelled) return
      setListings(res.ok ? res.data : [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [town])

  return { listings, loading }
}
