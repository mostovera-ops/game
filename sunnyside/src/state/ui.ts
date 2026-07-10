/**
 * ui.ts — DOM-оверлей: панели, тосты, локаль, lite mode, дебаг (21-client §3.4).
 * Персистятся ТОЛЬКО locale, liteMode, activePanel. toasts и debug — рантайм-only.
 */

import type { UiScreenKey, Locale, Toast, DebugParams, PerfState, NotificationItem, UUID } from '@/types'
import type { SliceCreator } from './types'

/** Кап хронологии уведомлений (HUD-зона, S4) — не растим неограниченно. */
const NOTIF_LOG_CAP = 50

/**
 * Громкость трёх звуковых шин (audio-wiring, 22-av §5 «Настройки звука — три независимых
 * слайдера: Музыка/SFX/Ambient»). Значения 0..1, зеркалят дефолты `assets/placeholders/
 * sound.ts` (`ensureBuses`). Экрана `ui_settings` пока нет в каноне (00-canon.md File Map,
 * 22-av §5/§9 п.8 — открытый вопрос), поэтому это НЕ отдельная canon-панель `ui_*`
 * (AGENTS.md §0.7 — не выдумываем ключ), а поле того же паттерна, что `seedPickerSlot`/
 * `storageOpen` ниже: контекстный оверлей без canon-ключа, свой backdrop
 * (`ui/hud/SoundSettingsPanel.tsx`), персистится через whitelist `state/index.ts`.
 */
export interface VolumeSettings {
  music: number
  sfx: number
  ambient: number
}

const DEFAULT_VOLUME: VolumeSettings = { music: 0.6, sfx: 0.8, ambient: 0.35 }

function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v))
}

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
     * UTC день-индекс (`ui/retention/shared.ts` `utcDayIndex`), на который игрок последний
     * раз открывал `ui_daily_specials` — `null` до первого открытия. Как `notifLastSeenAt`,
     * рантайм-only (не персистится): даёт бейдж «новые спецблюда дня» в `PanelLauncher`,
     * снимается открытием панели (`DailySpecials.tsx`).
     */
    dailySpecialsSeenDay: number | null
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
    /** Громкость трёх шин (persist whitelist, `state/index.ts`). */
    volume: VolumeSettings
    /** Мастер-выключатель ВСЕГО звука (music/sfx/ambient). По умолчанию ВЫКЛ — звук opt-in. */
    soundEnabled: boolean
    /** Открыта ли панель настроек звука (audio-wiring) — контекстный оверлей без canon-ключа. */
    soundSettingsOpen: boolean
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
  /** Отмечает Daily Specials текущего UTC-дня просмотренными (снимает бейдж лаунчера). */
  markDailySpecialsSeen: (dayIndex: number) => void
  /** Открыть/закрыть Seed Picker для слота грядки (`null` — закрыть). */
  setSeedPickerSlot: (slot: number | null) => void
  /** Запомнить станок-фокус Kitchen-панели (`null` — без фокуса). */
  setKitchenMachine: (machineId: UUID | null) => void
  /** Открыть/закрыть Storage оверлей. */
  setStorageOpen: (open: boolean) => void
  /** Установить громкость одной шины (клампится в [0,1]). */
  setVolume: (bus: keyof VolumeSettings, value: number) => void
  /** Включить/выключить весь звук игры (мастер). */
  setSoundEnabled: (on: boolean) => void
  /** Открыть/закрыть панель настроек звука. */
  setSoundSettingsOpen: (open: boolean) => void
}

const initial: UiSlice['ui'] = {
  locale: 'ru',
  activePanel: null,
  toasts: [],
  debug: {},
  perf: { liteMode: false, showHud: false, fps: 60 },
  notifications: [],
  notifLastSeenAt: 0,
  dailySpecialsSeenDay: null,
  seedPickerSlot: null,
  kitchenMachineId: null,
  storageOpen: false,
  volume: DEFAULT_VOLUME,
  soundEnabled: false,
  soundSettingsOpen: false,
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
  markDailySpecialsSeen: (dailySpecialsSeenDay) =>
    set((s) => ({ ui: { ...s.ui, dailySpecialsSeenDay } })),
  setSeedPickerSlot: (seedPickerSlot) => set((s) => ({ ui: { ...s.ui, seedPickerSlot } })),
  setKitchenMachine: (kitchenMachineId) => set((s) => ({ ui: { ...s.ui, kitchenMachineId } })),
  setStorageOpen: (storageOpen) => set((s) => ({ ui: { ...s.ui, storageOpen } })),
  setVolume: (bus, value) =>
    set((s) => ({ ui: { ...s.ui, volume: { ...s.ui.volume, [bus]: clampVolume(value) } } })),
  setSoundEnabled: (soundEnabled) => set((s) => ({ ui: { ...s.ui, soundEnabled } })),
  setSoundSettingsOpen: (soundSettingsOpen) => set((s) => ({ ui: { ...s.ui, soundSettingsOpen } })),
})
