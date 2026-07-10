/**
 * Сетка двора и призрак переносимой грядки. Живёт только в режиме планировки.
 *
 * Линии сетки рисуются одним LineSegments поверх земли — по одному отрезку на
 * границу клетки внутри двора. Пока грядка «в руках» (store.drag), над сеткой
 * ездит её полупрозрачная копия, зелёная там, где встанет, и красная там, где
 * нет. Клик по земле опускает грядку в клетку под курсором.
 */
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  CELL,
  YARD,
  cellCenter,
  placementCenter,
  rotatedSize,
  worldToCell,
  type Placed,
} from '../game/grid'
import { footprintOf, placeable } from '../game/buildables'
import { useGameStore } from '../game/store'

const LINE_Y = 0.03
const GHOST_Y = 0.08
const OK_COLOR = '#4caf50'
const BAD_COLOR = '#e05a4a'

/** Геометрия линий сетки — считается один раз, двор не меняется. */
function useGridLines(): THREE.BufferGeometry {
  return useMemo(() => {
    const pts: number[] = []
    const x0 = YARD.gx0 * CELL
    const x1 = (YARD.gx1 + 1) * CELL
    const z0 = YARD.gz0 * CELL
    const z1 = (YARD.gz1 + 1) * CELL
    for (let gx = YARD.gx0; gx <= YARD.gx1 + 1; gx++) {
      const x = gx * CELL
      pts.push(x, LINE_Y, z0, x, LINE_Y, z1)
    }
    for (let gz = YARD.gz0; gz <= YARD.gz1 + 1; gz++) {
      const z = gz * CELL
      pts.push(x0, LINE_Y, z, x1, LINE_Y, z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])
}

/** Куда встанет грядка, если опустить её под курсором: курсор — её середина. */
function anchorUnderCursor(x: number, z: number, rot: 0 | 1 | 2 | 3, w: number, d: number): Placed {
  const s = rotatedSize({ w, d }, rot)
  const cell = worldToCell(x, z)
  return { gx: cell.gx - Math.floor(s.w / 2), gz: cell.gz - Math.floor(s.d / 2), rot }
}

export function GridOverlay() {
  const buildMode = useGameStore((s) => s.buildMode)
  const drag = useGameStore((s) => s.drag)
  const lines = useGridLines()
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null)

  const linesMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 }),
    [],
  )

  // Ушли из режима стройки — забываем, где был курсор.
  useEffect(() => {
    if (!buildMode) setCursor(null)
  }, [buildMode])

  if (!buildMode) return null

  const yardW = (YARD.gx1 - YARD.gx0 + 1) * CELL
  const yardD = (YARD.gz1 - YARD.gz0 + 1) * CELL
  const yardCx = cellCenter(YARD.gx0, YARD.gz0).x - CELL / 2 + yardW / 2
  const yardCz = cellCenter(YARD.gx0, YARD.gz0).z - CELL / 2 + yardD / 2

  // Призрак: где встанет грядка и можно ли.
  let ghost: { p: Placed; ok: boolean; def: string } | null = null
  if (drag && cursor) {
    const st = useGameStore.getState()
    const placement = st.placements.find((x) => x.id === drag.id)
    if (placement) {
      const fp = footprintOf(placement.def)
      const p = anchorUnderCursor(cursor.x, cursor.z, drag.rot, fp.w, fp.d)
      const ok = placeable(st.placements, st.staticCells, placement.def, p, drag.id)
      ghost = { p, ok, def: placement.def }
    }
  }

  return (
    <>
      <lineSegments geometry={lines} material={linesMat} />

      {/* Плоскость-ловушка над всем двором: ведёт курсор и опускает грядку. */}
      <mesh
        position={[yardCx, GHOST_Y / 2, yardCz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          setCursor({ x: e.point.x, z: e.point.z })
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (!drag) return
          const st = useGameStore.getState()
          const placement = st.placements.find((x) => x.id === drag.id)
          if (!placement) return
          const fp = footprintOf(placement.def)
          const anchor = anchorUnderCursor(e.point.x, e.point.z, drag.rot, fp.w, fp.d)
          st.dropPlacement(anchor.gx, anchor.gz)
        }}
      >
        <planeGeometry args={[yardW, yardD]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {ghost && <Ghost p={ghost.p} ok={ghost.ok} def={ghost.def} />}
    </>
  )
}

function Ghost({ p, ok, def }: { p: Placed; ok: boolean; def: string }) {
  const fp = footprintOf(def as never)
  const s = rotatedSize(fp, p.rot)
  const c = placementCenter(p, fp)
  // Стороны уже переставлены в rotatedSize под мировые оси — сам меш не крутим.
  return (
    <mesh position={[c.x, GHOST_Y, c.z]}>
      <boxGeometry args={[s.w * CELL, 0.3, s.d * CELL]} />
      <meshBasicMaterial color={ok ? OK_COLOR : BAD_COLOR} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  )
}
