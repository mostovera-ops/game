/**
 * Живность фермы: жуки при кустах, кролики и кабан в лесу, птицы над головой.
 *
 * Ни один из них в scene-layout.json не записан — расстановки у живности нет,
 * позиции ей каждый кадр считает код. Из раскладки берём только опоры: где
 * стоят кусты (жукам садиться) и стволы (кроликам и кабану обходить).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import type { Palette, SceneLayout } from '../../assets/scene'
import { Birds } from './Birds'
import { Boar } from './Boar'
import { Bugs, bushPatches } from './Bugs'
import { Forage } from './Forage'
import { forageSpots } from './forageSpots'
import { critterUrl } from './model'
import { Rabbits } from './Rabbits'
import type { Point } from './roam'

const ASSETS = [
  'critter_butterfly',
  'critter_ladybug',
  'critter_beetle',
  'critter_bee',
  'bird',
  'rabbit',
  'boar',
] as const

for (const a of ASSETS) useGLTF.preload(critterUrl(a))

export function Wildlife({ layout, palette }: { layout: SceneLayout; palette: Palette }) {
  // Высота куста — из bbox самой GLB: подрастёт куст в Blender, поднимутся и жуки.
  const bushScene = useGLTF('/assets/props/bush.glb').scene
  const bushHeight = useMemo(
    () => new THREE.Box3().setFromObject(bushScene).getSize(new THREE.Vector3()).y,
    [bushScene],
  )

  const patches = useMemo(
    () => bushPatches(layout.props.filter((p) => p.asset === 'bush'), bushHeight),
    [layout, bushHeight],
  )

  const trees = useMemo<Point[]>(
    () =>
      layout.props
        .filter((p) => p.asset === 'tree')
        .map((p) => ({ x: p.position[0], z: p.position[2] })),
    [layout],
  )

  const spots = useMemo(() => forageSpots(trees), [trees])

  return (
    <>
      <Bugs patches={patches} palette={palette} />
      <Rabbits trees={trees} palette={palette} />
      <Boar trees={trees} palette={palette} />
      <Birds palette={palette} />
      <Forage spots={spots} palette={palette} />
    </>
  )
}
