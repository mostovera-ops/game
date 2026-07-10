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
import { NeonSign } from '../common/NeonSign'
import { WindowGlow } from '../common/WindowGlow'
import { useDayNightIntensity } from '../common/useDayNightIntensity'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useStore } from '@/state'
import { DayNight } from './DayNightRig'
import { PlotField } from './PlotField'
import { Buildings } from './Buildings'
import { Machines } from './Machines'
import { Animals } from './Animals'
import { Mailbox } from './Mailbox'
import { FarmActionsProvider, type InjectedSystems } from './systems'
import { ENV_BUSH_POSITIONS, ENV_TREE_POSITIONS, BUILDING_LAYOUT } from './layout'
import { buildingWindowPositions } from './windowGlow'

/** Вывеска дайнера — над крышей `bld_diner` (см. `layout.ts` BUILDING_LAYOUT), лицом к камере. */
const NEON_SIGN_OFFSET: [number, number, number] = [0, 2.7, 0.4]

/** Неон-вывеска игрока (Neon Builder, `collections.neonSign`) + окна-акценты фермы ночью
 *  (22-audio-visual §3.6/§4.5) — читают день/ночь-долю независимо от недельного тона. */
function NeonAndGlow() {
  const neonSign = useStore((s) => s.collections?.neonSign)
  const buildings = useStore((s) => s.farm?.buildings)
  const dayNightIntensity = useDayNightIntensity()
  const dinerPos = BUILDING_LAYOUT.bld_diner
  const signPosition: [number, number, number] = dinerPos
    ? [dinerPos[0] + NEON_SIGN_OFFSET[0], dinerPos[1] + NEON_SIGN_OFFSET[1], dinerPos[2] + NEON_SIGN_OFFSET[2]]
    : NEON_SIGN_OFFSET

  return (
    <>
      {buildings?.bld_diner && (
        <NeonSign config={neonSign} dayNightIntensity={dayNightIntensity} position={signPosition} />
      )}
      <WindowGlow positions={buildingWindowPositions(buildings)} dayNightIntensity={dayNightIntensity} />
    </>
  )
}

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
        <Mailbox />
        <EnvProps />
        <NeonAndGlow />
      </FarmActionsProvider>
    </>
  )
}
