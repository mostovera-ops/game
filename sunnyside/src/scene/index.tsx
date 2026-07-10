/**
 * scene/index.tsx — активная сцена по scene.active (21-client §3.2/§3.3).
 * App монтирует ровно ОДИН <Canvas> и внутри — этот свитч. Смена сцены размонтирует
 * старый граф (освобождение GPU). Code-splitting (React.lazy на *Scene) — задача §3.9,
 * добавляется scene-агентами; здесь прямой импорт ради простоты каркаса.
 */

import type { SceneKey } from '@/types'
import type { ShiftSystem } from '@/engine/contracts'
import { FarmScene } from './farm/FarmScene'
import type { InjectedSystems } from './farm/systems'
import { TownScene } from './town/TownScene'
import type { TownSystems } from './town/townSystemsFallback'
import { FairScene } from './fair/FairScene'
import { ShiftScene } from './shift/ShiftScene'

export function ActiveScene({
  active,
  farmSystems,
  townSystems,
  shiftSystem,
}: {
  active: SceneKey
  /**
   * Реальные `FarmSystem`/`AnimalSystem` (farm-ui-seams) — композиция (`App.tsx`) строит их
   * один раз и прокидывает сюда, чтобы клики фермы уходили на `BackendAdapter`, а не только
   * в локальный оптимистичный кэш (`scene/farm/systems.tsx`).
   */
  farmSystems?: InjectedSystems
  /** Реальные `SocialSystem`/`MailForagingSystem` (adapter-seams) — визит/помощь/подарок,
   *  форажинг обочины в `TownScene` (см. `scene/town/townSystemsFallback.ts`). */
  townSystems?: TownSystems
  /** Реальная `ShiftSystem` (adapter-seams) — `shift_submit` из смены прилавка (ярмарка). */
  shiftSystem?: ShiftSystem
}) {
  switch (active) {
    case 'farm':
      return <FarmScene systems={farmSystems} />
    case 'town':
      return <TownScene systems={townSystems} />
    case 'fair':
      return <FairScene shiftSystem={shiftSystem} />
    case 'shift':
      return <ShiftScene />
  }
}
