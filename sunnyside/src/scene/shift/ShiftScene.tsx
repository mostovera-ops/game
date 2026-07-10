/**
 * ShiftScene.tsx — активная смена у прилавка (21-client §3.3). Мини-игра подачи (соло, D4).
 * Тики локальны в пределах смены; итог — одна серверная мутация (§3.6). Каркас-заглушка.
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7,
 * registry-converge: свой мини-реестр `scene/assets/registry.ts` удалён).
 */

import { Lights, Ground, CameraRig } from '../common/Rig'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'

export function ShiftScene() {
  return (
    <>
      <Lights />
      <Ground size={16} />
      <CameraRig />
      <PlaceholderMesh id="bld_diner" position={[0, 1, -2]} />
    </>
  )
}
