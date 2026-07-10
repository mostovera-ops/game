/**
 * farm.ts — грядки/постройки/животные/станки. Оптимистично локально, истина серверная.
 * Кэшируется в IndexedDB (быстрый старт), поверх — серверный ресинк.
 */

import type { FarmSnapshot } from '@/types'
import type { SliceCreator } from './types'

export interface FarmSlice {
  farm: FarmSnapshot | null
  setFarm: (farm: FarmSnapshot) => void
  /** Точечный патч (напр. после reconcile одной грядки). Реализуют farm-агенты. */
  patchFarm: (patch: Partial<FarmSnapshot>) => void
}

export const createFarmSlice: SliceCreator<FarmSlice> = (set) => ({
  farm: null,
  setFarm: (farm) => set({ farm }),
  patchFarm: (patch) => set((s) => ({ farm: s.farm ? { ...s.farm, ...patch } : s.farm })),
})
