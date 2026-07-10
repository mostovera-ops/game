/**
 * econ.ts — балансы валют + farm value. НИКОГДА не персистится (анти-подмена, 21-client §3.4).
 * Оптимистичная дельта показывается поверх серверного значения как pendingDelta.
 */

import type { Wallet, CurrencyKey, FarmValueAxes } from '@/types'
import type { SliceCreator } from './types'

export interface EconSlice {
  econ: {
    wallet: Wallet
    /** Оптимистичная дельта до подтверждения; схлопывается при confirmed. */
    pendingDelta: Partial<Record<CurrencyKey, number>>
    farmValue: FarmValueAxes | null
  }
  setWallet: (wallet: Wallet) => void
  addPendingDelta: (currency: CurrencyKey, delta: number) => void
  clearPendingDelta: (currency: CurrencyKey) => void
  setFarmValue: (farmValue: FarmValueAxes) => void
}

const initial: EconSlice['econ'] = {
  wallet: { bucks: 0, dimes: 0, tickets: 0, ribbons: 0 },
  pendingDelta: {},
  farmValue: null,
}

export const createEconSlice: SliceCreator<EconSlice> = (set) => ({
  econ: initial,
  setWallet: (wallet) => set((s) => ({ econ: { ...s.econ, wallet } })),
  addPendingDelta: (currency, delta) =>
    set((s) => ({
      econ: {
        ...s.econ,
        pendingDelta: {
          ...s.econ.pendingDelta,
          [currency]: (s.econ.pendingDelta[currency] ?? 0) + delta,
        },
      },
    })),
  clearPendingDelta: (currency) =>
    set((s) => {
      const next = { ...s.econ.pendingDelta }
      delete next[currency]
      return { econ: { ...s.econ, pendingDelta: next } }
    }),
  setFarmValue: (farmValue) => set((s) => ({ econ: { ...s.econ, farmValue } })),
})
