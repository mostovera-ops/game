/**
 * clock.ts — serverOffset + серверный календарь/фазы (21-client §3.6).
 * serverNow() = Date.now() + serverOffset. Date.now() напрямую в game/ запрещён.
 * НЕ персистится — замеряется при коннекте.
 */

import type { ClockState, ServerCalendar, EpochMs } from '@/types'
import type { SliceCreator } from './types'

export interface ClockSlice {
  clock: ClockState & {
    calendar: ServerCalendar | null
  }
  setServerOffset: (offset: number) => void
  setCalendar: (calendar: ServerCalendar) => void
  /** serverNow() — единственный источник игрового времени. */
  serverNow: () => EpochMs
}

const initial: ClockSlice['clock'] = {
  serverOffset: 0,
  synced: false,
  lastSyncAt: null,
  calendar: null,
}

export const createClockSlice: SliceCreator<ClockSlice> = (set, get) => ({
  clock: initial,
  setServerOffset: (offset) =>
    set((s) => ({
      clock: { ...s.clock, serverOffset: offset, synced: true, lastSyncAt: Date.now() },
    })),
  setCalendar: (calendar) => set((s) => ({ clock: { ...s.clock, calendar } })),
  serverNow: () => Date.now() + get().clock.serverOffset,
})
