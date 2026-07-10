/**
 * progression.ts — уровень, Know-How, стафф, Route Pass, стрик (13-progression). Кэш.
 */

import type { ProgressionSnapshot } from '@/types'
import type { SliceCreator } from './types'

export interface ProgressionSlice {
  progression: ProgressionSnapshot | null
  setProgression: (progression: ProgressionSnapshot) => void
  patchProgression: (patch: Partial<ProgressionSnapshot>) => void
}

export const createProgressionSlice: SliceCreator<ProgressionSlice> = (set) => ({
  progression: null,
  setProgression: (progression) => set({ progression }),
  patchProgression: (patch) =>
    set((s) => ({ progression: s.progression ? { ...s.progression, ...patch } : s.progression })),
})
