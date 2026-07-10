/**
 * Streets.tsx — лучи стритов от площади с фермами соседей (11-town §3.1/§3.2).
 * Клик по чужой ферме поднимает панель визита (TownScene владеет выбором — этот
 * компонент только сообщает, какую ферму выбрали через `onSelectFarm`).
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7,
 * registry-converge: свой мини-реестр `scene/assets/registry.ts` удалён).
 */

import { Billboard, Text } from '@react-three/drei'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { farmPosition, orderedStreets, streetSignPosition, type RosterEntry } from './layout'
import type { Street } from '@/types'

export interface VisitTarget {
  /** userId соседа (roster) — нужен для соц-RPC (`HelpNeighborReq.targetId`/`GiftSendReq.toId`,
   *  adapter-seams): local-адаптер матчит по userId npc, НЕ по farmId. */
  userId: string
  farmId: string
  displayName: string
  streetId: string
}

export interface StreetsProps {
  streets: readonly Street[]
  roster: readonly RosterEntry[]
  /** Своя ферма (session.identity.farmId) — подсвечивается, клик по ней не открывает визит. */
  ownFarmId?: string
  onSelectFarm: (farm: VisitTarget) => void
}

function FarmMarker({
  entry,
  position,
  isOwn,
  onSelectFarm,
}: {
  entry: RosterEntry
  position: [number, number, number]
  isOwn: boolean
  onSelectFarm: (farm: VisitTarget) => void
}) {
  return (
    <group
      position={position}
      data-testid={`town-farm-${entry.farmId}`}
      onClick={(e) => {
        e.stopPropagation()
        if (isOwn) return
        onSelectFarm({
          userId: entry.userId,
          farmId: entry.farmId,
          displayName: entry.displayName,
          streetId: entry.streetId,
        })
      }}
    >
      <PlaceholderMesh id={isOwn ? 'bld_diner' : 'bld_house'} position={[0, 1, 0]} scale={isOwn ? 1.15 : 1} />
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.26} color="#2b2b2e" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
          {isOwn ? `${entry.displayName} (ты)` : entry.displayName}
        </Text>
      </Billboard>
    </group>
  )
}

export function Streets({ streets, roster, ownFarmId, onSelectFarm }: StreetsProps) {
  const ordered = orderedStreets(streets)
  const total = ordered.length
  // Улица знает свои фермы напрямую (`Street.farmIds`, canon §2.4) — рендерим по ним,
  // а ростер даёт имя/владельца по `farmId`. Фермы без записи в ростере пропускаем.
  const rosterByFarmId = new Map(roster.map((r) => [r.farmId, r]))

  return (
    <group>
      {ordered.map((street, streetIndex) => {
        const members = street.farmIds
          .map((farmId) => rosterByFarmId.get(farmId))
          .filter((e): e is RosterEntry => e !== undefined)
        const signPos = streetSignPosition(streetIndex, total)
        return (
          <group key={street.id}>
            <Billboard position={[signPos[0], 1.4, signPos[2]]}>
              <Text fontSize={0.34} color="#e2523b" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
                {street.name}
              </Text>
            </Billboard>
            {members.map((entry, farmIndex) => (
              <FarmMarker
                key={entry.farmId}
                entry={entry}
                position={farmPosition(streetIndex, total, farmIndex)}
                isOwn={entry.farmId === ownFarmId}
                onSelectFarm={onSelectFarm}
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}
