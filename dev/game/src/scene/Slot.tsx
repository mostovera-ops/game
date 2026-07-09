/**
 * <Slot> — одна клетка посадки. Рендерит культуру по состоянию из стора
 * (scale по стадии, tween ~400мс) и невидимый box-хитбокс для кликов/ховера.
 * Клик: пусто → посадить, растёт → полить, созрело → собрать.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, CROP_ASSET, type Palette, type Vec3 } from '../assets/scene'
import { useGameStore, type CropId } from '../game/store'

const STAGE_SCALE = [0.15, 0.55, 1.0]

function CropModel({ crop, palette }: { crop: CropId; palette: Palette }) {
  const { scene } = useGLTF(`/assets/props/${CROP_ASSET[crop]}.glb`)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette) // культуры не отбрасывают тень
    return clone
  }, [scene, palette])
  return <primitive object={object} />
}

export function Slot({
  slotId,
  position,
  palette,
}: {
  slotId: string
  position: Vec3
  palette: Palette
}) {
  const slot = useGameStore((s) => s.slots.find((x) => x.id === slotId)!)
  const plant = useGameStore((s) => s.plant)
  const water = useGameStore((s) => s.water)
  const harvest = useGameStore((s) => s.harvest)

  const [hover, setHover] = useState(false)
  const growRef = useRef<THREE.Group>(null)

  const target = slot.crop ? STAGE_SCALE[slot.stage] : 0
  useLayoutEffect(() => {
    growRef.current?.scale.setScalar(0.0001) // новый саженец растёт с нуля
  }, [slot.crop])
  useFrame((_, dt) => {
    const g = growRef.current
    if (!g) return
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 10, dt))
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!slot.crop) plant(slotId)
    else if (slot.stage < 2) water(slotId)
    else harvest(slotId)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHover(false)
    document.body.style.cursor = ''
  }

  return (
    <group position={position}>
      {slot.crop && (
        <group ref={growRef}>
          <CropModel crop={slot.crop} palette={palette} />
        </group>
      )}

      {/* невидимый хитбокс над слотом — рейкаст по нему, не по геометрии растения */}
      <mesh position={[0, 0.25, 0]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hover && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.16, 0.22, 24]} />
          <meshBasicMaterial color="#f4b942" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
