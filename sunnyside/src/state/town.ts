/**
 * town.ts — город, стриты, town projects, переезды (11-town, 12-migration). Кэш; Realtime.
 * Требует свежих серверных данных (не играбельно офлайн — показывает снапшот).
 */

import type { TownSnapshot } from '@/types'
import type { SliceCreator } from './types'

export interface TownSlice {
  town: TownSnapshot | null
  setTown: (town: TownSnapshot) => void
  patchTown: (patch: Partial<TownSnapshot>) => void
}

export const createTownSlice: SliceCreator<TownSlice> = (set) => ({
  town: null,
  setTown: (town) => set({ town }),
  patchTown: (patch) => set((s) => ({ town: s.town ? { ...s.town, ...patch } : s.town })),
})
