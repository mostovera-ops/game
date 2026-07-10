/**
 * scene.ts — активная 3D-сцена (21-client §3.3/§3.8). Прод-навигация = стор, не URL.
 * scene.active персистится (вернуть игрока туда, где был), ревалидируется на старте.
 */

import type { SceneKey } from '@/types'
import type { SliceCreator } from './types'

export interface SceneSlice {
  scene: {
    active: SceneKey
    /** Цель камеры (напр. фокус на стрите в town). */
    cameraTarget: [number, number, number] | null
  }
  /** Переход = размонтирование старого <Canvas> и монтирование нового (App.tsx). */
  goto: (active: SceneKey) => void
  setCameraTarget: (target: [number, number, number] | null) => void
}

const initial: SceneSlice['scene'] = { active: 'farm', cameraTarget: null }

export const createSceneSlice: SliceCreator<SceneSlice> = (set) => ({
  scene: initial,
  goto: (active) => set((s) => ({ scene: { ...s.scene, active } })),
  setCameraTarget: (cameraTarget) => set((s) => ({ scene: { ...s.scene, cameraTarget } })),
})
