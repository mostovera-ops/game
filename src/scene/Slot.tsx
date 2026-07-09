/**
 * <Slot> — одна клетка посадки. Рендерит культуру по состоянию из стора
 * (scale по стадии, tween ~400мс) и невидимый box-хитбокс для кликов/ховера.
 *
 * Клик зависит от инструмента в руках:
 *   семена — пусто → посадить, созрело → собрать;
 *   лейка  — растёт → полить.
 *
 * Политый слот показывается двумя способами сразу: мокрое пятно на почве
 * и капля над ростком. Пятно читается сверху, капля — при косой камере.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { applyPalette, CROP_ASSET, type Palette, type Vec3 } from '../assets/scene'
import { useGameStore, type CropId } from '../game/store'

const STAGE_SCALE = [0.15, 0.55, 1.0]

// Мокрая земля — темнее сухой, но всё ещё земля: чистый чёрный читался дырой.
const WET_COLOR = '#4f3826'
const DROP_COLOR = '#6db3f2'

function CropModel({ crop, palette }: { crop: CropId; palette: Palette }) {
  const { scene } = useGLTF(`/assets/props/${CROP_ASSET[crop]}.glb`)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    applyPalette(clone, palette) // культуры не отбрасывают тень
    return clone
  }, [scene, palette])
  return <primitive object={object} />
}

/** Капля над политым ростком: покачивается, чтобы цеплять глаз. */
function Droplet() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    g.position.y = 0.46 + Math.sin(state.clock.elapsedTime * 2.2) * 0.035
    g.rotation.y = state.clock.elapsedTime * 0.8
  })
  return (
    <group ref={ref} position={[0, 0.46, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <coneGeometry args={[0.05, 0.1, 8]} />
        <meshBasicMaterial color={DROP_COLOR} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshBasicMaterial color={DROP_COLOR} />
      </mesh>
    </group>
  )
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
  const tool = useGameStore((s) => s.tool)
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

  const growing = !!slot.crop && slot.stage < 2
  const ripe = !!slot.crop && slot.stage === 2

  // Что произойдёт по клику этим инструментом — от этого же зависит курсор.
  const actionable = tool === 'can' ? growing : !slot.crop || ripe

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (tool === 'can') {
      if (growing) water(slotId)
      return
    }
    if (!slot.crop) plant(slotId)
    else if (ripe) harvest(slotId)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = actionable ? 'pointer' : 'not-allowed'
  }
  const onOut = () => {
    setHover(false)
    document.body.style.cursor = ''
  }

  return (
    <group position={position}>
      {slot.watered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <circleGeometry args={[0.2, 20]} />
          <meshBasicMaterial color={WET_COLOR} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {slot.crop && (
        <group ref={growRef}>
          <CropModel crop={slot.crop} palette={palette} />
        </group>
      )}

      {slot.watered && <Droplet />}

      {/* невидимый хитбокс над слотом — рейкаст по нему, не по геометрии растения */}
      <mesh position={[0, 0.25, 0]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {hover && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.16, 0.22, 24]} />
          <meshBasicMaterial
            color={actionable ? '#f4b942' : '#8a8378'}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
