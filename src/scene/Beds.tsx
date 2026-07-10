/**
 * Грядки: raised_bed.glb на клетках сетки (см. store.placements).
 *
 * Полив показывается не грядкой целиком, а мокрым пятном под конкретным
 * ростком (см. Slot.tsx): раньше темнела вся грядка, если полит хоть один
 * слот, и понять, какое семечко уже полито, было нельзя.
 *
 * В режиме планировки у всех подвижных грядок появляется зелёная обводка — по
 * ней видно, что их можно двигать. Клик выбирает грядку: она остаётся на месте,
 * но становится полупрозрачной, а над ней всплывают кнопки «повернуть» и
 * «отменить». Куда она встанет, показывает призрак у курсора (см. GridOverlay).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette } from '../assets/scene'
import { BUILDABLES, footprintOf } from '../game/buildables'
import { CELL, rotatedSize } from '../game/grid'
import { useGameStore, type Placement } from '../game/store'
import { bedTransform } from './yard'
import { clearHoverLabel, setHoverLabel } from './hoverLabel'

const BED_LABEL = 'Грядка'
const BED_LABEL_MOVE = 'Грядка — клик, чтобы взять'

/** Высота обводки: чуть выше рамки грядки, чтобы охватить её целиком. */
const OUTLINE_H = 0.34

/** Единичный каркас куба — общий для всех обводок, масштабируется под размер. */
const OUTLINE_GEO = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
const OUTLINE_MAT = new THREE.LineBasicMaterial({ color: '#5cd65c' })

function Bed({ placement, palette }: { placement: Placement; palette: Palette }) {
  const { scene } = useGLTF('/assets/props/raised_bed.glb')
  const buildMode = useGameStore((s) => s.buildMode)
  const movable = BUILDABLES[placement.def].movable
  // Пока грядка выбрана, она поворачивается прямо на месте: показываем её с
  // накрученным поворотом, а в placements он ляжет только при опускании.
  const dragRot = useGameStore((s) => (s.drag?.id === placement.id ? s.drag.rot : null))
  const dragging = dragRot !== null
  const grab = useGameStore((s) => s.grabPlacement)
  const rotate = useGameStore((s) => s.rotateDrag)
  const exit = useGameStore((s) => s.toggleBuild)

  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast: true, receive: true })
    return clone
  }, [scene, palette])

  // Выбранная грядка полупрозрачна. Материалы в палитре общие, поэтому клонируем
  // их только этой грядке, а на выходе возвращаем оригиналы — иначе поблёкли бы
  // все грядки разом.
  useEffect(() => {
    const meshes: THREE.Mesh[] = []
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })
    for (const m of meshes) {
      if (dragging) {
        const orig = (m.userData.orig as THREE.Material) ?? (m.userData.orig = m.material as THREE.Material)
        const ghost = (orig as THREE.MeshLambertMaterial).clone()
        ghost.transparent = true
        ghost.opacity = 0.4
        ghost.depthWrite = false
        m.material = ghost
      } else if (m.userData.orig) {
        m.material = m.userData.orig as THREE.Material
      }
    }
  }, [dragging, object])

  // Выбранная грядка живёт с накрученным поворотом, остальные — со своим.
  const shown = dragRot !== null ? { ...placement, rot: dragRot } : placement
  const t = bedTransform(shown, shown.def)
  const s = rotatedSize(footprintOf(shown.def), shown.rot)

  return (
    <group>
      <primitive
        object={object}
        position={[t.x, 0, t.z]}
        rotation={[0, t.rotationY, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!buildMode || !movable) return
          e.stopPropagation()
          grab(placement.id)
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.intersections[0]?.object !== e.object) return
          e.stopPropagation()
          const title = buildMode ? BED_LABEL_MOVE : BED_LABEL
          setHoverLabel({ key: BED_LABEL, title, x: e.clientX, y: e.clientY })
          if (buildMode && movable) document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          clearHoverLabel(BED_LABEL)
          if (buildMode) document.body.style.cursor = ''
        }}
      />

      {/* Обводка: только у подвижных грядок и только в планировке. */}
      {buildMode && movable && (
        <lineSegments
          geometry={OUTLINE_GEO}
          material={OUTLINE_MAT}
          position={[t.x, OUTLINE_H / 2, t.z]}
          scale={[s.w * CELL, OUTLINE_H, s.d * CELL]}
        />
      )}

      {/* Кнопки над выбранной грядкой: повернуть и выйти из режима. */}
      {dragging && (
        <Html position={[t.x, 0.95, t.z]} center zIndexRange={[20, 0]}>
          <div className="flex gap-1.5" style={{ pointerEvents: 'auto' }}>
            <button
              title="Повернуть (R)"
              onClick={(e) => {
                e.stopPropagation()
                rotate()
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#2f6f6b] text-lg text-white shadow-lg transition hover:brightness-125"
            >
              ↻
            </button>
            <button
              title="Выйти из планировки (Esc)"
              onClick={(e) => {
                e.stopPropagation()
                exit()
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#a5453a] text-lg text-white shadow-lg transition hover:brightness-125"
            >
              ✕
            </button>
          </div>
        </Html>
      )}
    </group>
  )
}

export function Beds({ placements, palette }: { placements: Placement[]; palette: Palette }) {
  return (
    <>
      {placements.map((p) => (
        <Bed key={p.id} placement={p} palette={palette} />
      ))}
    </>
  )
}
