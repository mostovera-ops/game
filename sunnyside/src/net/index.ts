/**
 * net/index.ts — фабрика BackendAdapter (21-client §3.5).
 *
 * Выбор реализации: VITE_BACKEND_ADAPTER ('local' | 'supabase'). Если 'supabase' выбран,
 * но URL/ключ не заданы — падаем на 'local' (dev по умолчанию).
 *
 * ЧАСЫ ЛОКАЛЬНОГО АДАПТЕРА: `LocalBackendAdapter` получает инъектируемый `clock`, чей
 * `now()` = `Date.now() + clock.serverOffset` (clock-слайс стора). Это и есть шов для
 * DevTimeskip (21-client §3.6): кнопка двигает `clock.serverOffset` через `setServerOffset`,
 * а локальный бэкенд читает тот же оффсет — грядки/крафт/котёл РЕАЛЬНО дозревают, не только
 * клиентское восприятие времени. Прод-`SupabaseBackendAdapter` этот оффсет игнорирует
 * (истина времени — сервер). `net/` может импортировать `@/state` (AGENTS.md §3).
 */

import type { BackendAdapter, BackendAdapterKind, CreateBackendAdapter } from '@/engine/contracts'
import type { EpochMs } from '@/types'
import { useStore } from '@/state'
import { createLocalAdapter } from './adapters/local'
import { createSupabaseAdapter } from './adapters/supabase'

/** Часы локального бэкенда, следующие за `clock.serverOffset` (двигается DevTimeskip). */
const storeClock = { now: (): EpochMs => Date.now() + useStore.getState().clock.serverOffset }

export const createBackendAdapter: CreateBackendAdapter = (
  kind?: BackendAdapterKind,
): BackendAdapter => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const requested = kind ?? import.meta.env.VITE_BACKEND_ADAPTER ?? 'local'

  if (requested === 'supabase' && url && key) {
    return createSupabaseAdapter({ url, publishableKey: key })
  }
  return createLocalAdapter({ clock: storeClock })
}

export type { BackendAdapter, BackendAdapterKind } from '@/engine/contracts'
