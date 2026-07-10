/**
 * session.ts — идентичность игрока (userId/townId/streetId/farmId). Истина серверная.
 * НЕ персистится (кроме токенов, которые держит supabase auth storage).
 */

import type { PlayerIdentity } from '@/types'
import type { SliceCreator } from './types'

export interface SessionSlice {
  session: {
    identity: PlayerIdentity | null
    authStatus: 'idle' | 'anon' | 'authenticated' | 'error'
  }
  /** Гидрация после ensureSession. */
  setIdentity: (identity: PlayerIdentity) => void
  resetSession: () => void
}

const initial: SessionSlice['session'] = { identity: null, authStatus: 'idle' }

export const createSessionSlice: SliceCreator<SessionSlice> = (set) => ({
  session: initial,
  setIdentity: (identity) =>
    set((s) => ({ session: { ...s.session, identity, authStatus: 'authenticated' } })),
  resetSession: () => set({ session: initial }),
})
