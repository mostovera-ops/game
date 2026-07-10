/**
 * daynight.ts — тон сцены по фазе игровой недели (01-core-loop, canon §2.3).
 *
 * Клиент НЕ вычисляет фазу от локального времени — берёт серверную (`clock.calendar.phase`,
 * 21-client §3.6). Здесь — чистое отображение фазы → визуальный тон (фон + свет). Суббота
 * (ярмарка) тёплый закат, воскресенье (ивент-финал) — вечер; будни — ясный день.
 *
 * ГРАНИЦА: чистые функции, ноль three/react. Импортирует только палитру заглушек (данные).
 */

import type { WeekPhase } from '@/types'
import { color } from '@/assets/placeholders/registry'

/** Визуальный тон сцены: фон-хекс + параметры света (интенсивности + цвет солнца). */
export interface SceneTone {
  /** hex фона канваса (небо). */
  background: string
  /** Интенсивность ambientLight. */
  ambient: number
  /** Интенсивность directionalLight («солнце»). */
  dirIntensity: number
  /** hex цвета солнечного света. */
  dirColor: string
}

const DAY: SceneTone = {
  background: color('env_sky_day'),
  ambient: 0.62,
  dirIntensity: 1.15,
  dirColor: '#fff6e2',
}

const DUSK: SceneTone = {
  background: color('env_sky_dusk'),
  ambient: 0.55,
  dirIntensity: 1.0,
  dirColor: '#ffcf9e',
}

/** Вечер воскресенья: не буквальная тьма (P1 «дружелюбно»), а сумеречный прохладный тон. */
const NIGHT: SceneTone = {
  background: '#4a5b78',
  ambient: 0.42,
  dirIntensity: 0.7,
  dirColor: '#aebfe0',
}

/** Тон по фазе недели. Явная карта → фолбэк день (в т.ч. `null` до синка календаря). */
const TONE_BY_PHASE: Record<WeekPhase, SceneTone> = {
  mon_plan: DAY,
  tue_produce: DAY,
  wed_expedition: DAY,
  thu_push: DAY,
  fri_prep: DUSK,
  sat_fair: DUSK,
  sun_event: NIGHT,
}

/** Тон сцены для фазы недели; `null`/неизвестная фаза → ясный день. */
export function phaseTone(phase: WeekPhase | null | undefined): SceneTone {
  if (phase == null) return DAY
  return TONE_BY_PHASE[phase] ?? DAY
}
