/**
 * state/types.ts — общий тип стора и хелпер фабрики слайса.
 *
 * Один корневой useStore, скомпонованный из slice-фабрик (21-client §3.4).
 * ГРАНИЦА: state/ импортирует @/types и @/engine (контракты), НЕ импортирует
 * three / @react-three / scene. Node-тестируемо.
 */

import type { StateCreator } from 'zustand'
import type { SessionSlice } from './session'
import type { ClockSlice } from './clock'
import type { NetSlice } from './net'
import type { FarmSlice } from './farm'
import type { InventorySlice } from './inventory'
import type { EconSlice } from './econ'
import type { DemandSlice } from './demand'
import type { CoopSlice } from './coop'
import type { FairSlice } from './fair'
import type { EventSlice } from './event'
import type { TownSlice } from './town'
import type { ChatSlice } from './chat'
import type { ProgressionSlice } from './progression'
import type { CollectionsSlice } from './collections'
import type { ShopSlice } from './shop'
import type { UiSlice } from './ui'
import type { SceneSlice } from './scene'

/** Полное состояние стора = пересечение всех слайсов. */
export type StoreState = SessionSlice &
  ClockSlice &
  NetSlice &
  FarmSlice &
  InventorySlice &
  EconSlice &
  DemandSlice &
  CoopSlice &
  FairSlice &
  EventSlice &
  TownSlice &
  ChatSlice &
  ProgressionSlice &
  CollectionsSlice &
  ShopSlice &
  UiSlice &
  SceneSlice

/**
 * Тип фабрики слайса с мутаторами subscribeWithSelector + persist (21-client §3.4).
 * `createXSlice: SliceCreator<XSlice>`.
 */
export type SliceCreator<TSlice> = StateCreator<
  StoreState,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  TSlice
>
