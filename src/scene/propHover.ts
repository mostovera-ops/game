/**
 * Подпись пропса по ховеру: «Дом», «Ель», «Гриб».
 *
 * Имя берётся из материала под курсором — так же, как реплика в phrases.ts.
 * У одного пропса оно одно на все его части: фудтрак откликается хоть колесом,
 * хоть маркизой.
 *
 * Ключом подписи служит само имя. Наводя курсор с ёлки на соседнюю, мы получаем
 * сперва over новой, потом out старой, и без ключа новая подпись гасла бы сразу
 * после появления.
 */
import type { ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { clearHoverLabel, setHoverLabel } from './hoverLabel'
import { PROP_NAMES } from './phrases'

/** Имя материала объекта, либо '' если материала нет. */
export function materialName(object: THREE.Object3D): string {
  const mat = (object as THREE.Mesh).material
  if (!mat) return ''
  return Array.isArray(mat) ? (mat[0]?.name ?? '') : mat.name
}

/** Имя пропса под курсором. У инстансов материал живёт на eventObject. */
function nameOf(e: ThreeEvent<PointerEvent>): string | undefined {
  return PROP_NAMES[materialName(e.object) || materialName(e.eventObject)]
}

export function hoverProp(e: ThreeEvent<PointerEvent>): void {
  // Сверяем eventObject, а не object: у инстансов (деревья, кусты) object —
  // это прокси drei, и его никогда нет среди пересечений.
  if (e.intersections[0]?.eventObject !== e.eventObject) return
  const title = nameOf(e)
  if (!title) return
  e.stopPropagation()
  setHoverLabel({ key: title, title, x: e.clientX, y: e.clientY })
}

export function unhoverProp(e: ThreeEvent<PointerEvent>): void {
  const title = nameOf(e)
  if (title) clearHoverLabel(title)
}
