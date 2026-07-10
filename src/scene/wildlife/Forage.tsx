/**
 * Находки в лесу: грибы и птичьи гнёзда с яйцом.
 *
 * Клик по находке не подбирает её на месте — он ставит намерение и ведёт героя,
 * ровно как клик по грядке или по лавке. Подбирает <Interactions> в Farm.tsx,
 * когда герой дошёл.
 *
 * Собранный гриб исчезает целиком, а гнездо остаётся — гаснет только узел Egg:
 * гнездо птица не уносит. За ночь и то, и другое возвращается (endDay чистит
 * takenForage).
 */
import { useCallback, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
import { useGameStore } from '../../game/store'
import { REACH } from '../heroState'
import { heroTarget } from '../heroTarget'
import { setIntent } from '../intent'
import { critterUrl, node, useCreature } from './model'
import type { ForageSpot } from './forageSpots'

const MUSHROOM_URL = critterUrl('mushroom')
const NEST_URL = critterUrl('nest')

useGLTF.preload(MUSHROOM_URL)
useGLTF.preload(NEST_URL)

function Pickup({ spot, palette }: { spot: ForageSpot; palette: Palette }) {
  const url = spot.item === 'mushroom' ? MUSHROOM_URL : NEST_URL
  const model = useCreature(url, palette, { cast: true, clickable: true })
  const taken = useGameStore((s) => s.takenForage.includes(spot.id))

  // У гнезда прячем только яйцо: само гнездо остаётся лежать под деревом.
  const egg = useMemo(() => (spot.item === 'egg' ? node(model, 'Egg') : null), [model, spot.item])
  useEffect(() => {
    if (egg) egg.visible = !taken
  }, [egg, taken])

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.intersections[0]?.object !== e.object) return
      e.stopPropagation()
      const st = useGameStore.getState()
      if (st.phase !== 'farm' || st.takenForage.includes(spot.id)) return
      setIntent({ kind: 'forage', id: spot.id, item: spot.item, x: spot.x, z: spot.z, reach: REACH })
      heroTarget.set(spot.x, 0, spot.z)
    },
    [spot],
  )

  // Курсор ведёт себя как над грядкой: пустое гнездо брать нечего.
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = taken ? 'not-allowed' : 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
  }

  // Гриб уносят целиком; гнездо остаётся лежать и пустым.
  if (spot.item === 'mushroom' && taken) return null

  return (
    <primitive
      object={model}
      position={[spot.x, 0, spot.z]}
      rotation={[0, spot.rotationY, 0]}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
    />
  )
}

export function Forage({ spots, palette }: { spots: ForageSpot[]; palette: Palette }) {
  return (
    <>
      {spots.map((spot) => (
        <Pickup key={spot.id} spot={spot} palette={palette} />
      ))}
    </>
  )
}
