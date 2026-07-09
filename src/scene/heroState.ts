/**
 * Живое состояние героя: мировая позиция и признак движения.
 *
 * Мутабельный синглтон, а не zustand: позиция меняется каждый кадр, и гнать её
 * через React значило бы перерисовывать девять слотов и камеру по 60 раз в
 * секунду. Читатели (Slot, CameraRig) смотрят сюда из useFrame.
 *
 * Отдельный модуль по той же причине, что и heroTarget: экспорт не-компонента
 * из файла с компонентом ломает Fast Refresh.
 */
import * as THREE from 'three'

export const hero = {
  /** Позиция в мировых координатах, y всегда 0. */
  pos: new THREE.Vector3(),
  /** Идёт ли герой прямо сейчас — по этому камера решает, подкатываться ли. */
  moving: false,
}

/** На каком расстоянии от слота герой может с ним работать. */
export const REACH = 1.5

/** Радиус тела героя для столкновений. */
export const HERO_RADIUS = 0.22

/** Расстояние от героя до точки на земле (XZ, высота не в счёт). */
export function distanceToHero(x: number, z: number): number {
  return Math.hypot(x - hero.pos.x, z - hero.pos.z)
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __hero?: unknown }).__hero = hero
}
