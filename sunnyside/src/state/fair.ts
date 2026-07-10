/**
 * fair.ts — прилавок, конкурсы, активная смена (09-fair). Прилавок/конкурсы серверные;
 * смена (shift) — локальный тик, итог валидируется сервером. НЕ персистится.
 */

import type { Stall, Contest, ShiftState } from '@/types'
import type { SliceCreator } from './types'

export interface FairSlice {
  fair: {
    stall: Stall | null
    contests: Contest[]
    shift: ShiftState | null
  }
  setStall: (stall: Stall) => void
  setContests: (contests: Contest[]) => void
  setShift: (shift: ShiftState | null) => void
}

const initial: FairSlice['fair'] = { stall: null, contests: [], shift: null }

export const createFairSlice: SliceCreator<FairSlice> = (set) => ({
  fair: initial,
  setStall: (stall) => set((s) => ({ fair: { ...s.fair, stall } })),
  setContests: (contests) => set((s) => ({ fair: { ...s.fair, contests } })),
  setShift: (shift) => set((s) => ({ fair: { ...s.fair, shift } })),
})
