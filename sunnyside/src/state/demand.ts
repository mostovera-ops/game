/**
 * demand.ts — Demand Board (ui_demand_board). Кэш; серверный seed, клиент не влияет.
 */

import type { DemandBoard } from '@/types'
import type { SliceCreator } from './types'

export interface DemandSlice {
  demand: DemandBoard | null
  setDemand: (demand: DemandBoard) => void
}

export const createDemandSlice: SliceCreator<DemandSlice> = (set) => ({
  demand: null,
  setDemand: (demand) => set({ demand }),
})
