/**
 * ui/shift/shiftSystemFallback.ts — тёплый no-op фолбэк `ShiftSystem` (adapter-seams).
 *
 * ПОЧЕМУ ПРОП, А НЕ AMBIENT-КОНТЕКСТ: `ui/` не имеет права ходить в `@/net` (AGENTS.md §3,
 * `lint:boundary`) — сборку `ShiftSystem` (адаптер + `SystemContext`, `createShiftSystem`
 * из `@/engine/fair`) делает композиция (`App.tsx`, зеркалит farm-ui-seams `scene/farm/
 * systems.tsx`). `App.tsx` строит `AppSystems` один раз и прокидывает `sys.shift` через
 * `scene/index.tsx` → `FairScene` → `ShiftHost` → `<ShiftScreen shiftSystem={...}>` пропом —
 * единственный потребитель здесь `ShiftScreen`, лишний Context-провайдер не нужен.
 *
 * `NOOP_SHIFT_SYSTEM` — фолбэк без прокинутой системы (юниты/смоук-рендер): `submit`
 * сразу резолвит `offline`, `ShiftScreen` печатает чек клиентскими числами как есть
 * (P3 — «чек из движка» всё равно показывается, реального начисления просто не было).
 */
import type { ShiftSystem } from '@/engine/contracts'

const offlineError = { code: 'offline' as const, message: 'система недоступна' }

export const NOOP_SHIFT_SYSTEM: ShiftSystem = {
  start: () => Promise.resolve({ ok: false, error: offlineError }),
  tick: () => {},
  submit: () => Promise.resolve({ ok: false, error: offlineError }),
}
