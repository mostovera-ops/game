/**
 * coop.ts — кооп-заказы и potluck стрита (11-town). Кэш; истина серверная (Realtime board).
 */

import type { CoopOrder, Potluck } from '@/types'
import type { SliceCreator } from './types'

export interface CoopSlice {
  coop: {
    orders: CoopOrder[]
    potluck: Potluck | null
  }
  setCoopOrders: (orders: CoopOrder[]) => void
  setPotluck: (potluck: Potluck) => void
}

const initial: CoopSlice['coop'] = { orders: [], potluck: null }

export const createCoopSlice: SliceCreator<CoopSlice> = (set) => ({
  coop: initial,
  setCoopOrders: (orders) => set((s) => ({ coop: { ...s.coop, orders } })),
  setPotluck: (potluck) => set((s) => ({ coop: { ...s.coop, potluck } })),
})
