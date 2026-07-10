/**
 * scene/town/townSystemsFallback.ts — типы систем + no-op фолбэк для `TownScene` (adapter-seams).
 *
 * ПОЧЕМУ ПРОП, А НЕ AMBIENT-КОНТЕКСТ: `scene/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку систем (адаптер + `SystemContext`, `SocialSystem`/
 * `MailForagingSystem`) делает композиция (`App.tsx`, зеркалит farm-ui-seams `scene/farm/
 * systems.tsx`). `App.tsx` строит `AppSystems` один раз и прокидывает `{ social,
 * mailForaging }` через `scene/index.tsx` (`ActiveScene`) пропом `townSystems` в
 * `<TownScene systems={...}>` — без лишнего Context-провайдера над `<Canvas>` (единственный
 * потребитель — сама `TownScene`, дочерним компонентам системы не нужны).
 *
 * `NOOP_TOWN_SYSTEMS` — тёплый фолбэк (P3) для юнитов/сторибука сцены без композиции:
 * методы сразу резолвят `offline`, `TownScene` показывает обычный «не получилось» тост,
 * без падения и без обращения к сети.
 */
import type { MailForagingSystem, SocialSystem } from '@/engine/contracts'
import type { RpcResult } from '@/types'

export interface TownSystems {
  social: SocialSystem
  mailForaging: MailForagingSystem
}

function offline<T>(): Promise<RpcResult<T>> {
  return Promise.resolve({ ok: false, error: { code: 'offline', message: 'система недоступна' } })
}

export const NOOP_TOWN_SYSTEMS: TownSystems = {
  social: {
    help: () => offline(),
    gift: () => offline(),
    sit: () => offline(),
    chat: () => offline(),
  },
  mailForaging: {
    order: () => offline(),
    speedup: () => offline(),
    claim: () => offline(),
    forageClaim: () => offline(),
    forageCollect: () => offline(),
    fish: () => offline(),
  },
}
