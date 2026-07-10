/**
 * Грядки: raised_bed.glb на клетках сетки (см. store.placements).
 *
 * Полив показывается не грядкой целиком, а мокрым пятном под конкретным
 * ростком (см. Slot.tsx): раньше темнела вся грядка, если полит хоть один
 * слот, и понять, какое семечко уже полито, было нельзя.
 *
 * В режиме планировки грядка становится кнопкой: клик поднимает её в руки
 * (store.grabPlacement), поднятая приподнимается и тускнеет, а по двору за
 * курсором едет её призрак — его рисует GridOverlay, не этот компонент.
 */
import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette } from '../assets/scene'
import { useGameStore, type Placement } from '../game/store'
import { bedTransform } from './yard'
import { clearHoverLabel, setHoverLabel } from './hoverLabel'

const BED_LABEL = 'Грядка'
const BED_LABEL_MOVE = 'Грядка — клик, чтобы взять'

/** Приподнимаем поднятую грядку, чтобы было видно, что она «в руках». */
const LIFT = 0.25

function Bed({ placement, palette }: { placement: Placement; palette: Palette }) {
  const { scene } = useGLTF('/assets/props/raised_bed.glb')
  const buildMode = useGameStore((s) => s.buildMode)
  const dragging = useGameStore((s) => s.drag?.id === placement.id)
  const grab = useGameStore((s) => s.grabPlacement)

  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast: true, receive: true })
    return clone
  }, [scene, palette])

  const t = bedTransform(placement, placement.def)

  return (
    <primitive
      object={object}
      position={[t.x, dragging ? LIFT : 0, t.z]}
      rotation={[0, t.rotationY, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!buildMode) return
        e.stopPropagation()
        grab(placement.id)
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (e.intersections[0]?.object !== e.object) return
        e.stopPropagation()
        const title = buildMode ? BED_LABEL_MOVE : BED_LABEL
        setHoverLabel({ key: BED_LABEL, title, x: e.clientX, y: e.clientY })
        if (buildMode) document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        clearHoverLabel(BED_LABEL)
        if (buildMode) document.body.style.cursor = ''
      }}
    />
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
