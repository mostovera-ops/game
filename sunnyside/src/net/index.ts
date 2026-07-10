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
  // Явно запрошенный адаптер (аргумент или env). undefined = «выбор не сделан».
  const requestedExplicit = kind ?? import.meta.env.VITE_BACKEND_ADAPTER
  const requested = requestedExplicit ?? 'local'

  if (requested === 'supabase' && url && key) {
    return createSupabaseAdapter({ url, publishableKey: key })
  }

  // NET-5: fail-closed против МОЛЧАЛИВОГО отката. Локальный адаптер клиент-авторитетный
  // (минтит ресурсы в браузере, DevTimeskip) — в проде он опасен ТОЛЬКО когда включился сам,
  // без явного выбора («чит-песочница под видом прода»). Поэтому:
  //   • ЯВНЫЙ VITE_BACKEND_ADAPTER=local (демо/сингл-плеер сборка) — честный выбор, разрешён;
  //   • прод БЕЗ явного выбора — бросаем громко (иначе тихо станем песочницей);
  //   • VITE_REQUIRE_SUPABASE=true — жёсткое требование supabase, перекрывает даже явный local.
  const explicitLocal = requestedExplicit === 'local'
  const requireSupabase = import.meta.env.VITE_REQUIRE_SUPABASE === 'true'
    || (import.meta.env.PROD && !explicitLocal)
  if (requireSupabase) {
    throw new Error(
      `[net] fail-closed: требуется supabase-адаптер, но requested='${requested}', `
      + `VITE_SUPABASE_URL=${url ? 'set' : 'MISSING'}, `
      + `VITE_SUPABASE_PUBLISHABLE_KEY=${key ? 'set' : 'MISSING'}. `
      + `Задай VITE_BACKEND_ADAPTER=supabase и оба ключа проекта, `
      + `либо VITE_BACKEND_ADAPTER=local для демо-сборки на локальном адаптере.`,
    )
  }
  return createLocalAdapter({ clock: storeClock })
}

export type { BackendAdapter, BackendAdapterKind } from '@/engine/contracts'
