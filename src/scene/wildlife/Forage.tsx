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
 * гнездо птица не уносит. По клику опустевшее гнездо тоже отвечает репликой,
 * а не отказом: пустой дом — это событие, а не сломанная кнопка.
 *
 * За ночь находки возвращаются не все и не наверняка (см. regrowForage), а
 * грибы к тому же вырастают на других деревьях (см. forestFinds).
 */
import { useCallback, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Palette } from '../../assets/scene'
import { useGameStore } from '../../game/store'
import { REACH } from '../heroState'
import { heroTarget } from '../heroTarget'
import { setIntent } from '../intent'
import { NEST_EMPTY, TOADSTOOL } from '../phrases'
import { critterUrl, node, useCreature } from './model'
import { isForage, type FindKind, type FindSpot } from './forageSpots'

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

      // Мухомор и опустевшее гнездо не дают ничего, кроме реплики. Гриба,
      // который уже сорвали, в сцене нет вовсе — сюда он не доходит.
      const empty = st.takenForage.includes(spot.id)
      if (!isForage(spot)) {
        setIntent({ kind: 'speak', text: TOADSTOOL, x: spot.x, z: spot.z, reach: REACH })
      } else if (empty) {
        setIntent({ kind: 'speak', text: NEST_EMPTY, x: spot.x, z: spot.z, reach: REACH })
      } else {
        setIntent({ kind: 'forage', id: spot.id, item: spot.kind, x: spot.x, z: spot.z, reach: REACH })
      }
      heroTarget.set(spot.x, 0, spot.z)
    },
    [spot],
  )

  /**
   * Курсор ведёт себя как над грядкой. Мухомор и опустевшее гнездо — не
   * «нельзя», а «можно посмотреть»: клик по ним даёт реплику, а не отказ.
   */
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = spot.kind === 'toadstool' || taken ? 'help' : 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
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
