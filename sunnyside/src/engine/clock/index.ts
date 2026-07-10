/**
 * engine/clock — система календаря/времени (01-core-loop).
 *
 * СОСТАВ:
 *   • constants — каноничные UTC-якоря/длительности (§4.1).
 *   • calendar  — чистые функции недели: фазы, якоря, окна, снапшот, сезоны (§3).
 *   • tutorial  — Tutorial Mini-Week + вливание новичка / Grand Opening (§3.9/§3.10).
 *   • system    — фабрика ClockSystem (serverNow/isReady/sync, §3.3/§3.6).
 *
 * Импорт: `import { clock } from '@/engine'` → `clock.phaseAt(...)`,
 * `clock.createClockSystem(...)`, `clock.buildCalendar(...)`.
 *
 * ГРАНИЦА: чистая логика, ноль three/react/net. Node-тестируемо (clock.test.ts).
 */

export * from './constants'
export * from './calendar'
export * from './tutorial'
export * from './system'
