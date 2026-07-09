/**
 * Грядки: raised_bed.glb на позициях plots[] с их поворотом.
 *
 * Полив показывается не грядкой целиком, а мокрым пятном под конкретным
 * ростком (см. Slot.tsx): раньше темнела вся грядка, если полит хоть один
 * слот, и понять, какое семечко уже полито, было нельзя.
 */
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { applyPalette, type Palette, type Plot } from '../assets/scene'

function Bed({ plot, palette }: { plot: Plot; palette: Palette }) {
  const { scene } = useGLTF('/assets/props/raised_bed.glb')

  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette, { cast: true, receive: true })
    return clone
  }, [scene, palette])

  return (
    <primitive object={object} position={plot.bed} rotation={[0, plot.bedRotationY, 0]} />
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
