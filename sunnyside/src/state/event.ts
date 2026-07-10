/**
 * event.ts — серверный ивент, Appetite Meter (10-server-event). Кэш; Realtime. v0.4.
 */

import type { EventSnapshot } from '@/types'
import type { SliceCreator } from './types'

export interface EventSlice {
  event: EventSnapshot | null
  setEvent: (event: EventSnapshot) => void
  patchEvent: (patch: Partial<EventSnapshot>) => void
}

export const createEventSlice: SliceCreator<EventSlice> = (set) => ({
  event: null,
  setEvent: (event) => set({ event }),
  patchEvent: (patch) => set((s) => ({ event: s.event ? { ...s.event, ...patch } : s.event })),
})
