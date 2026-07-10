/**
 * state/index.ts — корневой useStore, скомпонованный из slice-фабрик (21-client §3.4).
 *
 * persist(subscribeWithSelector(...)):
 *  - subscribeWithSelector — точечные подписки для scene/ (перф, §3.9).
 *  - persist(partialize) — БЕЛЫЙ СПИСОК: только UI-настройки и scene.active.
 *    Балансы валют, игровая истина — НЕ персистятся (анти-подмена, §3.4).
 *  - version — версионированный ключ: при несовпадении сбрасываем кэш, не очередь (C11).
 *
 * Селекторы: используйте `useStore(useShallow(s => ...))` в scene/ и ui/.
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware'
import type { StoreState } from './types'
import { createSessionSlice } from './session'
import { createClockSlice } from './clock'
import { createNetSlice } from './net'
import { createFarmSlice } from './farm'
import { createInventorySlice } from './inventory'
import { createEconSlice } from './econ'
import { createDemandSlice } from './demand'
import { createCoopSlice } from './coop'
import { createFairSlice } from './fair'
import { createEventSlice } from './event'
import { createTownSlice } from './town'
import { createProgressionSlice } from './progression'
import { createCollectionsSlice } from './collections'
import { createShopSlice } from './shop'
import { createChatSlice } from './chat'
import { createUiSlice } from './ui'
import { createSceneSlice } from './scene'

/** Bump при изменении формы персистнутого стейта → авто-сброс кэша (C11). */
export const STORE_PERSIST_VERSION = 1
export const STORE_PERSIST_KEY = 'sunnyside.store'

export const useStore = create<StoreState>()(
  persist(
    subscribeWithSelector((...a) => ({
      ...createSessionSlice(...a),
      ...createClockSlice(...a),
      ...createNetSlice(...a),
      ...createFarmSlice(...a),
      ...createInventorySlice(...a),
      ...createEconSlice(...a),
      ...createDemandSlice(...a),
      ...createCoopSlice(...a),
      ...createFairSlice(...a),
      ...createEventSlice(...a),
      ...createTownSlice(...a),
      ...createProgressionSlice(...a),
      ...createCollectionsSlice(...a),
      ...createShopSlice(...a),
      ...createChatSlice(...a),
      ...createUiSlice(...a),
      ...createSceneSlice(...a),
    })),
    {
      name: STORE_PERSIST_KEY,
      version: STORE_PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Белый список персиста (21-client §3.4, §4.5). Всё остальное — рантайм/сервер.
      // Возврат сужен до whitelisted-полей; cast — т.к. persist по умолчанию ждёт полный
      // тип, а восстановление недостающего делает merge ниже.
      partialize: (s) =>
        ({
          ui: {
            locale: s.ui.locale,
            activePanel: s.ui.activePanel,
            perf: { liteMode: s.ui.perf.liteMode },
            // Громкость шин (audio-wiring, 22-av §5) — небольшое пользовательское
            // предпочтение, не игровая истина/валюта — безопасно для persist (AGENTS.md §0.5).
            volume: s.ui.volume,
            soundEnabled: s.ui.soundEnabled,
          },
          scene: { active: s.scene.active },
        }) as unknown as StoreState,
      // Глубокий merge: восстановленный белый список накладывается на свежий стейт,
      // сохраняя рантайм-поля (toasts/debug/fps) и методы слайсов.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as {
          ui?: {
            locale?: StoreState['ui']['locale']
            activePanel?: StoreState['ui']['activePanel']
            perf?: { liteMode?: boolean }
            volume?: Partial<StoreState['ui']['volume']>
            soundEnabled?: boolean
          }
          scene?: { active?: StoreState['scene']['active'] }
        }
        return {
          ...current,
          ui: {
            ...current.ui,
            ...(p.ui?.locale ? { locale: p.ui.locale } : {}),
            ...(p.ui && 'activePanel' in p.ui ? { activePanel: p.ui.activePanel ?? null } : {}),
            perf: { ...current.ui.perf, ...(p.ui?.perf ?? {}) },
            volume: { ...current.ui.volume, ...(p.ui?.volume ?? {}) },
            ...(typeof p.ui?.soundEnabled === 'boolean' ? { soundEnabled: p.ui.soundEnabled } : {}),
          },
          scene: { ...current.scene, ...(p.scene?.active ? { active: p.scene.active } : {}) },
        }
      },
      // Кэш-снапшоты town/fair/event и очередь мутаций — в IndexedDB (net/), не здесь.
    },
  ),
)

export type { StoreState, SliceCreator } from './types'
