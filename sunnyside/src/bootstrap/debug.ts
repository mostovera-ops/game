/**
 * debug.ts — парсер дебаг-параметров URL (21-client §3.8). Чистая функция (node-тестируема).
 * Игнорируются в проде гейтом isDebugEnabled() — игрок не откроет ярмарку в понедельник.
 */

import type { DebugParams, SceneKey, UiScreenKey } from '@/types'
import { SCENE_KEYS, UI_SCREEN_KEYS } from '@/types'

/** Дебаг-параметры разрешены только в dev или под e2e-флагом (§3.8, C9). */
export function isDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_BACKEND_ADAPTER === 'local'
}

/** Разобрать `location.search` в DebugParams. Невалидные значения отбрасываются. */
export function parseDebugParams(search: string): DebugParams {
  const q = new URLSearchParams(search)
  const out: DebugParams = {}

  const screen = q.get('screen')
  if (screen && (SCENE_KEYS as readonly string[]).includes(screen)) {
    out.screen = screen as SceneKey
  }

  const panel = q.get('panel')
  if (panel && (UI_SCREEN_KEYS as readonly string[]).includes(panel)) {
    out.panel = panel as UiScreenKey
  }

  const seed = q.get('seed')
  if (seed !== null && seed !== '' && !Number.isNaN(Number(seed))) {
    out.seed = Number(seed)
  }

  const town = q.get('town')
  if (town) out.town = town
  const street = q.get('street')
  if (street) out.street = street

  const net = q.get('net')
  if (net === 'offline' || net === 'online') out.net = net

  const perf = q.get('perf')
  if (perf === 'lite' || perf === 'hud') out.perf = perf

  const clock = q.get('clock')
  if (clock) out.clock = clock

  return out
}
