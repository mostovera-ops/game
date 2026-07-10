/**
 * PlaceholderInstances.tsx — инстансированный вариант `PlaceholderMesh` (21-client §3.9
 * «Инстансинг для всех повторяющихся пропсов»): рисует много копий ОДНОГО ассета реестра
 * (`registry.ts`) через `InstancedMesh` (drei `<Instances>`/`<Instance>`) — N объектов на
 * сцене схлопываются в 1 draw call на часть-примитив геометрии (простая заглушка — 1
 * draw call на N инстансов вместо N; group-заглушка из K частей — K draw calls вместо N×K).
 *
 * Использование (см. `scene/town/Streets.tsx` — дома соседей, `ForagePoints.tsx` — точки
 * фуражинга): подходит для повторяющихся ОДНОТИПНЫХ пропсов (один `id`, форма/цвет не
 * меняются между инстансами — только позиция/поворот/масштаб). Не подходит для объектов,
 * которые меняют форму/цвет индивидуально (напр. Town Project по стадии стройки — там
 * каждый инстанс визуально разный, инстансинг не даёт выигрыша, см. `TownProjects.tsx`).
 *
 * Клики: `<Instance>` (drei) — это `PositionMesh`, поддерживает raycast per-instance и
 * `onClick`/`onPointerOver` как обычный `<mesh>` (см. Streets.tsx `onSelectFarm`).
 * Дев-лейбл/magenta-маркер неизвестного `id` (PlaceholderMesh.tsx) намеренно НЕ дублируется
 * здесь — инстансинг предполагает уже провалидированный существующий ассет (заранее
 * известные повторяющиеся пропсы), а не универсальный путь рендера одиночного объекта.
 */

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Instance, Instances } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { color, getAsset, type PlaceholderPart, type PlaceholderSpec } from './registry'

export interface PlaceholderInstanceItem {
  key: string
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: number | readonly [number, number, number]
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

/** Раскладывает `PlaceholderSpec` в список частей — одна для простой формы, N для группы. */
function specToParts(spec: PlaceholderSpec | undefined): PlaceholderPart[] {
  if (spec === undefined) return []
  if (spec.shape === 'group') return spec.parts ?? []
  return [{ shape: spec.shape, size: spec.size ?? [1, 1, 1], color: spec.color ?? 'pal_chrome' }]
}

function PartGeometry({ shape, size }: { shape: PlaceholderPart['shape']; size: [number, number, number] }): ReactNode {
  const [w, h, d] = size
  switch (shape) {
    case 'box':
      return <boxGeometry args={[w, h, d]} />
    case 'sphere':
      return <sphereGeometry args={[w, 16, 12]} />
    case 'capsule':
      return <capsuleGeometry args={[w, h, 4, 8]} />
    case 'cone':
      return <coneGeometry args={[w, h, 16]} />
    case 'cylinder':
      return <cylinderGeometry args={[w, w, h, 16]} />
    case 'plane':
      return <planeGeometry args={[w, d]} />
    default:
      return null
  }
}

/** Один InstancedMesh на часть-примитив, покрывающий все `items` (§3.9 «одна матрица на инстанс»). */
function InstancedPart({ part, items }: { part: PlaceholderPart; items: readonly PlaceholderInstanceItem[] }) {
  const offset = part.offset ?? [0, 0, 0]
  return (
    <Instances limit={Math.max(items.length, 1)} range={items.length} castShadow receiveShadow>
      <PartGeometry shape={part.shape} size={part.size} />
      <meshLambertMaterial color={color(part.color)} />
      {items.map((item) => {
        const s = item.scale ?? 1
        const uniformScale = typeof s === 'number' ? s : undefined
        const vecScale = typeof s === 'number' ? undefined : [s[0], s[1], s[2]] as [number, number, number]
        return (
          <Instance
            key={item.key}
            position={[item.position[0] + offset[0], item.position[1] + offset[1], item.position[2] + offset[2]]}
            rotation={(part.rotation ?? item.rotation ?? [0, 0, 0]) as [number, number, number]}
            scale={uniformScale ?? vecScale}
            onClick={item.onClick}
            onPointerOver={item.onPointerOver}
            onPointerOut={item.onPointerOut}
          />
        )
      })}
    </Instances>
  )
}

/**
 * `<PlaceholderInstancedGroup id="bld_house" items={[...]} />` — рисует `items.length` копий
 * ассета `id` одним (или несколькими, для group-заглушек) `InstancedMesh`. Пустой список или
 * отсутствующий в реестре `id` → ничего не рендерит (вызывающая сторона решает, показывать ли
 * `PlaceholderMesh`-фолбэк с magenta-маркером для единичного случая).
 */
export function PlaceholderInstancedGroup({ id, items }: { id: string; items: readonly PlaceholderInstanceItem[] }) {
  const parts = useMemo(() => specToParts(getAsset(id)?.placeholder), [id])
  if (items.length === 0 || parts.length === 0) return null
  return (
    <group>
      {parts.map((part, i) => (
        <InstancedPart key={i} part={part} items={items} />
      ))}
    </group>
  )
}
