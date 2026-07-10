/**
 * PerfHud.tsx — drei/`r3f-perf` профайлер (fps/draw calls/треугольники) за флагом `?perf=1`
 * (задача scene-perf; AGENTS.md §6 упоминает `?perf=hud` как гипотезу — здесь фиксируем
 * конкретный флаг по спецификации задачи). Dev-only через `isDebugEnabled()`
 * (bootstrap/debug.ts, читаем — не меняем чужой owned-файл, AGENTS.md §0.6).
 *
 * Монтируется сценой (см. `TownScene.tsx`) — ноль влияния на прод-бандл по количеству кода,
 * но `r3f-perf` всё равно попадает в чанк сцены (см. `package.json` — уже задекларированная
 * dev-зависимость прод-канона 21-client §4.1).
 */

import { Perf } from 'r3f-perf'
import { isDebugEnabled } from '@/bootstrap/debug'

function readPerfFlag(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('perf')
}

/** `true`, только если дев-режим разрешён И явно передан `?perf=1`. */
export function isPerfHudEnabled(): boolean {
  return isDebugEnabled() && readPerfFlag() === '1'
}

export function PerfHud() {
  if (!isPerfHudEnabled()) return null
  return <Perf position="top-left" matrixUpdate />
}
