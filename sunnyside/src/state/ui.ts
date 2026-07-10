/**
 * ui.ts — DOM-оверлей: панели, тосты, локаль, lite mode, дебаг (21-client §3.4).
 * Персистятся ТОЛЬКО locale, liteMode, activePanel. toasts и debug — рантайм-only.
 */

import type { UiScreenKey, Locale, Toast, DebugParams, PerfState, NotificationItem, UUID } from '@/types'
import type { SliceCreator } from './types'

/** Кап хронологии уведомлений (HUD-зона, S4) — не растим неограниченно. */
const NOTIF_LOG_CAP = 50

export interface UiSlice {
  ui: {
    locale: Locale
    activePanel: UiScreenKey | null
    toasts: Toast[]
    debug: DebugParams
    perf: PerfState
    /** Хронология событий (S4 Notifications Center) + метка последнего просмотра для бейджа. */
    notifications: NotificationItem[]
    notifLastSeenAt: number
    /**
     * Слот грядки, для которого сцена (клик по пустой грядке, farm-ui-seams) запросила
     * Seed Picker (F1, 19-ui-ux §3.2). `null` — оверлей закрыт. F1 — контекстный `SHEET`
     * без canon `ui_*` ключа (AGENTS.md §0.7), поэтому НЕ идёт через `activePanel`/`Modal` —
     * рантайм-only, не персистится (как toasts/debug).
     */
    seedPickerSlot: number | null
    /**
     * Станок, по которому кликнули в сцене (`Machines.tsx`) — Kitchen-панель (`ui_recipe_box`,
     * хостит K1 Machine Queues) открывается с фокусом на нём. `null` — открыт обзорный K1
     * без фокуса (клик по постройке кухни). Рантайм-only.
     */
    kitchenMachineId: UUID | null
    /**
     * Открыт ли Storage (F4, 19-ui-ux §3.2) — клик по Silo/Icehouse в сцене. Как и Seed
     * Picker, F4 — контекстный `SHEET` без canon-ключа, не через `activePanel`. Рантайм-only.
     */
    storageOpen: boolean
  }
  setLocale: (locale: Locale) => void
  openPanel: (panel: UiScreenKey | null) => void
  pushToast: (toast: Toast) => void
  dismissToast: (id: string) => void
  setDebug: (debug: DebugParams) => void
  setLiteMode: (lite: boolean) => void
  /** Добавляет запись в ленту уведомлений (HUD-колокол). Кэп — старые вытесняются. */
  pushNotification: (item: NotificationItem) => void
  /** Отмечает всё прочитанным (снимает бейдж колокола) на момент `now`. */
  markNotificationsSeen: (now: number) => void
  /** Открыть/закрыть Seed Picker для слота грядки (`null` — закрыть). */
  setSeedPickerSlot: (slot: number | null) => void
  /** Запомнить станок-фокус Kitchen-панели (`null` — без фокуса). */
  setKitchenMachine: (machineId: UUID | null) => void
  /** Открыть/закрыть Storage оверлей. */
  setStorageOpen: (open: boolean) => void
}

const initial: UiSlice['ui'] = {
  locale: 'ru',
  activePanel: null,
  toasts: [],
  debug: {},
  perf: { liteMode: false, showHud: false, fps: 60 },
  notifications: [],
  notifLastSeenAt: 0,
  seedPickerSlot: null,
  kitchenMachineId: null,
  storageOpen: false,
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  ui: initial,
  setLocale: (locale) => set((s) => ({ ui: { ...s.ui, locale } })),
  openPanel: (activePanel) => set((s) => ({ ui: { ...s.ui, activePanel } })),
  pushToast: (toast) => set((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts, toast] } })),
  dismissToast: (id) =>
    set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } })),
  setDebug: (debug) => set((s) => ({ ui: { ...s.ui, debug } })),
  setLiteMode: (liteMode) => set((s) => ({ ui: { ...s.ui, perf: { ...s.ui.perf, liteMode } } })),
  pushNotification: (item) =>
    set((s) => ({
      ui: {
        ...s.ui,
        notifications: [item, ...s.ui.notifications].slice(0, NOTIF_LOG_CAP),
      },
    })),
  markNotificationsSeen: (notifLastSeenAt) =>
    set((s) => ({ ui: { ...s.ui, notifLastSeenAt } })),
  setSeedPickerSlot: (seedPickerSlot) => set((s) => ({ ui: { ...s.ui, seedPickerSlot } })),
  setKitchenMachine: (kitchenMachineId) => set((s) => ({ ui: { ...s.ui, kitchenMachineId } })),
  setStorageOpen: (storageOpen) => set((s) => ({ ui: { ...s.ui, storageOpen } })),
})
