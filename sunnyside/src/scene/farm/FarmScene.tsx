/**
 * FarmScene.tsx — личная ферма (21-client §3.3): интерактивная 3D-сцена.
 *
 * Собирает: свет/тон по фазе недели (`DayNight`), землю и 3/4-камеру (`common/Rig`), сетку
 * A-слотов грядок (`PlotField`), постройки/станки/животных (заглушки по реестру), env-пропсы.
 * Действия игрока идут через `FarmActionsProvider` → системы движка/оптимистичный кэш —
 * сцена НЕ ходит в net напрямую (AGENTS.md §3).
 *
 * `systems` (farm-ui-seams) — реальные `FarmSystem`/`AnimalSystem`, которые строит и
 * прокидывает композиция (`App.tsx` → `scene/index.tsx`). Без них (`undefined`, напр. в
 * юнит-тестах компонента) клики остаются оптимистичным локальным кэшем (см. докстринг
 * `systems.tsx`), С НИМИ — реально уходят на `BackendAdapter`.
 *
 * Слайс `farm` наполняется РЕАЛЬНОЙ гидрацией из адаптера на бутстрапе (`app/backend.ts`
 * `bootstrap` → `getFarm` → `setFarm`); демо-сид снапшота убран. До прихода гидрации
 * подкомпоненты читают `s.farm?…` и рисуют пусто (кадр без грядок), затем перерисовываются
 * истиной сервера — сцена остаётся играбельной оффлайн через локальный адаптер.
 */

import { Ground, CameraRig } from '../common/Rig'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { DayNight } from './DayNightRig'
import { PlotField } from './PlotField'
import { Buildings } from './Buildings'
import { Machines } from './Machines'
import { Animals } from './Animals'
import { FarmActionsProvider, type InjectedSystems } from './systems'
import { ENV_BUSH_POSITIONS, ENV_TREE_POSITIONS } from './layout'

/** Env-пропсы (деревья/кусты) по углам участка — инстансинг-кандидаты (§3.9). */
function EnvProps() {
  return (
    <group>
      {ENV_TREE_POSITIONS.map((pos, i) => (
        <PlaceholderMesh key={`tree-${i}`} id="env_tree" position={pos} />
      ))}
      {ENV_BUSH_POSITIONS.map((pos, i) => (
        <PlaceholderMesh key={`bush-${i}`} id="env_bush" position={pos} />
      ))}
    </group>
  )
}

export function FarmScene({ systems }: { systems?: InjectedSystems } = {}) {
  return (
    <>
      <DayNight />
      <Ground size={40} />
      <CameraRig />

      <FarmActionsProvider systems={systems}>
        <Buildings />
        <PlotField />
        <Machines />
        <Animals />
        <EnvProps />
      </FarmActionsProvider>
    </>
  )
}
