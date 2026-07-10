/**
 * inventory.ts — склад и лимиты хранилищ. Кэш; истина серверная.
 */

import type { InventorySnapshot } from '@/types'
import type { SliceCreator } from './types'

export interface InventorySlice {
  inventory: InventorySnapshot | null
  setInventory: (inventory: InventorySnapshot) => void
}

export const createInventorySlice: SliceCreator<InventorySlice> = (set) => ({
  inventory: null,
  setInventory: (inventory) => set({ inventory }),
})
