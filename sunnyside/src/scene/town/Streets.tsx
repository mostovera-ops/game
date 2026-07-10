/**
 * Streets.tsx — лучи стритов от площади с фермами соседей (11-town §3.1/§3.2).
 * Клик по чужой ферме поднимает панель визита (TownScene владеет выбором — этот
 * компонент только сообщает, какую ферму выбрали через `onSelectFarm`).
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7,
 * registry-converge: свой мини-реестр `scene/assets/registry.ts` удалён).
 *
 * ПЕРФ (21-client §3.9, scene-perf): город может нести 100–200 ферм соседей на стритах —
 * это главный source of draw calls в town (бюджет ≤150, canon 21-client §3.9). Дома соседей
 * (кроме своей фермы — она уникальна: акцентный масштаб + неон-вывеска игрока) собраны в
 * ОДИН `InstancedMesh` через `PlaceholderInstancedGroup` вместо N отдельных мешей. Поверх —
 * два независимых сокращения:
 *  - фрустум-отсечение (`useFrustumCulledItems`) — дома вне поля зрения камеры не попадают
 *    даже в инстансированный буфер (экономит треугольники, не только draw calls);
 *  - LOD по именным табличкам — билборд+`Text` дорог при большом N (troika-текст — свой
 *    draw call на лейбл), поэтому подпись показываем только ближайшим `LABEL_LIMIT` видимым
 *    фермам (§3.9 «дальние — импостер без деталей, ближние — полная детализация»).
 * Мемоизация: `React.memo` на компонент + плоский список ферм строится один раз в
 * `useMemo` от `(streets, roster)`, не пересчитывается на каждый ре-рендер родителя.
 */

import { memo, useCallback, useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { PlaceholderInstancedGroup, type PlaceholderInstanceItem } from '@/assets/placeholders/PlaceholderInstances'
import { useStore } from '@/state'
import { NeonSign } from '../common/NeonSign'
import { useDayNightIntensity } from '../common/useDayNightIntensity'
import { useFrustumCulledItems } from '../common/useFrustumCulledItems'
import { farmPosition, orderedStreets, streetSignPosition, type RosterEntry, type Vec3 } from './layout'
import type { NeonSignConfig, Street } from '@/types'

/** Сколько ближайших видимых ферм получают именную табличку (см. докстринг выше). */
const LABEL_LIMIT = 14

/** Высота/масштаб неон-вывески над своей фермой (маркер `bld_diner`, масштаб 1.15). */
const OWN_FARM_SIGN_Y = 2.9
const OWN_FARM_SIGN_SCALE = 0.6

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

interface FarmWithPosition extends RosterEntry {
  position: Vec3
}

function farmToPosition(farm: FarmWithPosition): Vec3 {
  return farm.position
}

/** Своя ферма — единичный объект, не инстансируется: уникальный акцент + неон-вывеска игрока
 *  (Neon Builder, `collections.neonSign`) поверх дневного/ночного тона (`useDayNightIntensity`). */
const OwnFarmMarker = memo(function OwnFarmMarker({
  entry,
  position,
  ownNeonSign,
  dayNightIntensity,
}: {
  entry: RosterEntry
  position: Vec3
  ownNeonSign?: NeonSignConfig | null
  dayNightIntensity: number
}) {
  return (
    <group position={position} data-testid={`town-farm-${entry.farmId}`}>
      <PlaceholderMesh id="bld_diner" position={[0, 1, 0]} scale={1.15} />
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.26} color="#2b2b2e" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
          {`${entry.displayName} (ты)`}
        </Text>
      </Billboard>
      <NeonSign
        config={ownNeonSign}
        dayNightIntensity={dayNightIntensity}
        position={[0, OWN_FARM_SIGN_Y, 0]}
        scale={OWN_FARM_SIGN_SCALE}
      />
    </group>
  )
})

/** Именные таблички ближайших видимых ферм — отдельная группа, не завязана на InstancedMesh. */
const FarmLabels = memo(function FarmLabels({ farms }: { farms: readonly FarmWithPosition[] }) {
  return (
    <>
      {farms.map((entry) => (
        <Billboard key={entry.farmId} position={[entry.position[0], 2.4, entry.position[2]]}>
          <Text fontSize={0.26} color="#2b2b2e" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
            {entry.displayName}
          </Text>
        </Billboard>
      ))}
    </>
  )
})

export const Streets = memo(function Streets({ streets, roster, ownFarmId, onSelectFarm }: StreetsProps) {
  const ordered = useMemo(() => orderedStreets(streets), [streets])
  const total = ordered.length
  const ownNeonSign = useStore((s) => s.collections?.neonSign)
  const dayNightIntensity = useDayNightIntensity()

  // Плоский список ферм с позициями — считается один раз на смену `streets`/`roster`
  // (тот же порядок обхода, что и раньше: улица знает свои фермы напрямую через `farmIds`,
  // ростер даёт имя/владельца; фермы без записи в ростере пропускаются).
  const { ownFarm, otherFarms } = useMemo(() => {
    const rosterByFarmId = new Map(roster.map((r) => [r.farmId, r]))
    let own: FarmWithPosition | undefined
    const others: FarmWithPosition[] = []
    ordered.forEach((street, streetIndex) => {
      const members = street.farmIds
        .map((farmId) => rosterByFarmId.get(farmId))
        .filter((e): e is RosterEntry => e !== undefined)
      members.forEach((entry, farmIndex) => {
        const withPos: FarmWithPosition = { ...entry, position: farmPosition(streetIndex, total, farmIndex) }
        if (entry.farmId === ownFarmId) {
          own = withPos
        } else {
          others.push(withPos)
        }
      })
    })
    return { ownFarm: own, otherFarms: others }
  }, [ordered, roster, ownFarmId, total])

  // Фрустум-отсечение (§3.9): дома соседей вне поля зрения не попадают в инстансированный
  // буфер вовсе — экономит треугольники поверх экономии draw calls от инстансинга.
  const visibleOtherFarms = useFrustumCulledItems(otherFarms, farmToPosition, { radius: 2.6 })
  // LOD-кап табличек с именем — дорогой троика-текст только ближайшим видимым фермам.
  const labeledFarms = useFrustumCulledItems(visibleOtherFarms, farmToPosition, {
    radius: 2.6,
    maxCount: LABEL_LIMIT,
  })

  const handleClickFarm = useCallback(
    (entry: RosterEntry) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelectFarm({ userId: entry.userId, farmId: entry.farmId, displayName: entry.displayName, streetId: entry.streetId })
    },
    [onSelectFarm],
  )

  const instanceItems = useMemo<PlaceholderInstanceItem[]>(
    () =>
      visibleOtherFarms.map((entry) => ({
        key: entry.farmId,
        position: [entry.position[0], 1, entry.position[2]],
        onClick: handleClickFarm(entry),
      })),
    [visibleOtherFarms, handleClickFarm],
  )

  return (
    <group>
      {ordered.map((street, streetIndex) => {
        const signPos = streetSignPosition(streetIndex, total)
        return (
          <Billboard key={street.id} position={[signPos[0], 1.4, signPos[2]]}>
            <Text fontSize={0.34} color="#e2523b" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
              {street.name}
            </Text>
          </Billboard>
        )
      })}

      {/* Дома соседей — один InstancedMesh на N ферм вместо N отдельных мешей (§3.9). */}
      <PlaceholderInstancedGroup id="bld_house" items={instanceItems} />
      <FarmLabels farms={labeledFarms} />

      {ownFarm && (
        <OwnFarmMarker
          entry={ownFarm}
          position={ownFarm.position}
          ownNeonSign={ownNeonSign}
          dayNightIntensity={dayNightIntensity}
        />
      )}
    </group>
  )
})
