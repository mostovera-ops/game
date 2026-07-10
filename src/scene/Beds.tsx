/**
 * Грядки: raised_bed.glb на позициях plots[] с их поворотом.
 *
 * Полив показывается не грядкой целиком, а мокрым пятном под конкретным
 * ростком (см. Slot.tsx): раньше темнела вся грядка, если полит хоть один
 * слот, и понять, какое семечко уже полито, было нельзя.
 */
import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette, type Plot } from '../assets/scene'
import { clearHoverLabel, setHoverLabel } from './hoverLabel'

/** Подпись грядки. Слоты посадки перехватывают ховер сами — см. Slot.tsx. */
const BED_LABEL = 'Грядка'

function Bed({ plot, palette }: { plot: Plot; palette: Palette }) {
  const { scene } = useGLTF('/assets/props/raised_bed.glb')

  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast: true, receive: true })
    return clone
  }, [scene, palette])

  return (
    <primitive
      object={object}
      position={plot.bed}
      rotation={[0, plot.bedRotationY, 0]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (e.intersections[0]?.object !== e.object) return
        e.stopPropagation()
        setHoverLabel({ key: BED_LABEL, title: BED_LABEL, x: e.clientX, y: e.clientY })
      }}
      onPointerOut={() => clearHoverLabel(BED_LABEL)}
    />
  )
}

export function Beds({ plots, palette }: { plots: Plot[]; palette: Palette }) {
  return (
    <>
      {plots.map((plot) => (
        <Bed key={plot.id} plot={plot} palette={palette} />
      ))}
    </>
  )
}
