/**
 * Загрузка модели существа: своя копия GLB на каждую особь.
 *
 * Копия нужна потому, что живность анимируется покадрово поворотом узлов
 * (крыло, нога, ухо), а useGLTF отдаёт одну общую сцену на url: два кролика
 * на одном объекте махали бы ушами как один.
 *
 * Лучи по живности не пускаем: кликать по ней нечего, а девять существ, каждое
 * из десятка мешей, попадали бы в каждый raycast курсора. Находки (гриб,
 * гнездо) — исключение, им клик и нужен.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette } from '../../assets/scene'

export const critterUrl = (asset: string) => `/assets/props/${asset}.glb`

const noRaycast: THREE.Object3D['raycast'] = () => {}

export interface CreatureOpts {
  /** Отбрасывает ли тень. У жуков и птиц выключено: тень мельче пикселя. */
  cast?: boolean
  /** Ловит ли клики. По умолчанию нет. */
  clickable?: boolean
}

export function useCreature(url: string, palette: Palette, opts: CreatureOpts = {}): THREE.Group {
  const { scene } = useGLTF(url)
  const { cast = false, clickable = false } = opts
  return useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast })
    if (!clickable) clone.traverse((o) => void (o.raycast = noRaycast))
    return clone as THREE.Group
  }, [scene, palette, cast, clickable])
}

/** Узел модели по имени. Бросает, а не молчит: опечатка в имени — это баг сборки. */
export function node(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name)
  if (!found) throw new Error(`wildlife: в модели нет узла ${name}`)
  return found
}
