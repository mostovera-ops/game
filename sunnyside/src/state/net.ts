/**
 * net.ts — статус сети, оффлайн-очередь, каналы (21-client §3.5).
 *
 * [STATE-4] Этот слайс НЕ персистится вообще (ни `queueLen`, ни остальное) — Zustand
 * `persist(partialize)` в `state/index.ts` белым списком пропускает только `ui.*` и
 * `scene.active` (21-client §3.4: «анти-подмена» — игровая истина/сеть не персистятся).
 * Сама очередь мутаций живёт в IndexedDB через `net/queue.ts` независимо от Zustand-persist
 * и ресинкается на бутстрапе оттуда — `queueLen` в этом слайсе лишь рантайм-зеркало её длины
 * для UI на время сессии, не источник истины и не персистентное поле.
 */

import type { NetState, QueuedMutation } from '@/types'
import type { SliceCreator } from './types'

export interface NetSlice {
  net: NetState & {
    /** Зеркало длины очереди для UI; сами элементы живут в IndexedDB. */
    pending: QueuedMutation[]
  }
  setOnline: (online: boolean) => void
  setReconnecting: (reconnecting: boolean) => void
  setQueueLen: (len: number) => void
  markSynced: (at: number) => void
}

const initial: NetSlice['net'] = {
  online: true,
  reconnecting: false,
  queueLen: 0,
  lastSyncAt: null,
  channelStatus: {},
  pending: [],
}

export const createNetSlice: SliceCreator<NetSlice> = (set) => ({
  net: initial,
  setOnline: (online) => set((s) => ({ net: { ...s.net, online } })),
  setReconnecting: (reconnecting) => set((s) => ({ net: { ...s.net, reconnecting } })),
  setQueueLen: (queueLen) => set((s) => ({ net: { ...s.net, queueLen } })),
  markSynced: (lastSyncAt) => set((s) => ({ net: { ...s.net, lastSyncAt } })),
})
