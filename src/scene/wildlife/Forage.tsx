/**
 * Что растёт в лесу: съедобные грибы, птичьи гнёзда с яйцом и мухоморы.
 *
 * Клик не подбирает находку на месте — он ставит намерение и ведёт героя,
 * ровно как клик по грядке или по лавке. Дело доводит <Interactions> в
 * Farm.tsx, когда герой дошёл.
 *
 * Мухомор ходит по тому же пути, но с намерением 'speak': герой подойдёт и
 * скажет, что этим можно отравиться. В стор он не попадает вовсе — для правил
 * игры его не существует.
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
import { TOADSTOOL } from '../phrases'
import { hoverProp, unhoverProp } from '../propHover'
import { critterUrl, node, useCreature } from './model'
import type { FindKind, FindSpot } from './forageSpots'

const URLS: Record<FindKind, string> = {
  mushroom: critterUrl('mushroom'),
  egg: critterUrl('nest'),
  toadstool: critterUrl('toadstool'),
}

for (const url of Object.values(URLS)) useGLTF.preload(url)

function Find({ spot, palette }: { spot: FindSpot; palette: Palette }) {
  const model = useCreature(URLS[spot.kind], palette, { cast: true, clickable: true })
  // Мухомор не собирается, поэтому его id в takenForage не появится никогда.
  const taken = useGameStore((s) => s.takenForage.includes(spot.id))

  // У гнезда прячем только яйцо: само гнездо остаётся лежать под деревом.
  const egg = useMemo(() => (spot.kind === 'egg' ? node(model, 'Egg') : null), [model, spot.kind])
  useEffect(() => {
    if (egg) egg.visible = !taken
  }, [egg, taken])

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.intersections[0]?.object !== e.object) return
      e.stopPropagation()
      const st = useGameStore.getState()
      if (st.phase !== 'farm') return // день 7 — герой за прилавком

      if (spot.kind === 'toadstool') {
        setIntent({ kind: 'speak', text: TOADSTOOL, x: spot.x, z: spot.z, reach: REACH })
      } else {
        if (st.takenForage.includes(spot.id)) return
        setIntent({ kind: 'forage', id: spot.id, item: spot.kind, x: spot.x, z: spot.z, reach: REACH })
      }
      heroTarget.set(spot.x, 0, spot.z)
    },
    [spot],
  )

  /**
   * Курсор ведёт себя как над грядкой. Мухомор — не «нельзя», а «можно
   * посмотреть»: клик по нему всегда что-то даёт, пусть и одну реплику.
   */
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (spot.kind === 'toadstool') document.body.style.cursor = 'help'
    else document.body.style.cursor = taken ? 'not-allowed' : 'pointer'
  }
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = ''
    unhoverProp(e)
  }

  // Гриб уносят целиком; гнездо остаётся лежать и пустым, мухомор — навсегда.
  if (spot.kind === 'mushroom' && taken) return null

  return (
    <primitive
      object={model}
      position={[spot.x, 0, spot.z]}
      rotation={[0, spot.rotationY, 0]}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerMove={hoverProp}
      onPointerOut={onOut}
    />
  )
}

export function Forage({ spots, palette }: { spots: FindSpot[]; palette: Palette }) {
  return (
    <>
      {spots.map((spot) => (
        <Find key={spot.id} spot={spot} palette={palette} />
      ))}
    </>
  )
}
