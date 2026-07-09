/**
 * Грядки: raised_bed.glb на позициях plots[] с их поворотом. Материал Soil
 * клонируется на каждую грядку, чтобы полив темнил почву именно этой грядки
 * (lerp к 0.6× базового цвета).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { lambert, type Palette, type Plot } from '../assets/scene'
import { bedOf, useGameStore } from '../game/store'

function Bed({ plot, palette }: { plot: Plot; palette: Palette }) {
  const { scene } = useGLTF('/assets/props/raised_bed.glb')

  const { object, soil } = useMemo(() => {
    const clone = scene.clone(true)
    let soilMat: THREE.MeshLambertMaterial | null = null
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const cur = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const name = (cur as THREE.Material).name
      if (name === 'Soil') {
        soilMat = lambert(name, palette).clone() // своя копия на грядку
        mesh.material = soilMat
      } else {
        mesh.material = lambert(name, palette)
      }
    })
    return { object: clone, soil: soilMat as THREE.MeshLambertMaterial | null }
  }, [scene, palette])

  const watered = useGameStore((s) =>
    s.slots.some((sl) => bedOf(sl.id) === plot.id && sl.watered),
  )
  const base = useMemo(() => new THREE.Color(palette.Soil ?? '#907661'), [palette])
  const dark = useMemo(() => base.clone().multiplyScalar(0.6), [base])

  useFrame(() => {
    if (soil) soil.color.lerp(watered ? dark : base, 0.12)
  })

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
