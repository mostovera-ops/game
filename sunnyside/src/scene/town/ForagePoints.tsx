/**
 * ForagePoints.tsx — точки фуражинга обочины (`mech_foraging`, 08-mail-foraging §3.2,
 * 11-town §3.1 Roadside). Клик → `onCollect(pointId)`; TownScene решает, что это значит
 * (см. TODO(mail-foraging) там — реальный `MailForagingSystem.forageClaim/forageCollect`
 * ещё не реализован, сцена не имеет доступа к `@/net` напрямую — AGENTS.md §3).
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7,
 * registry-converge: свой мини-реестр `scene/assets/registry.ts` удалён).
 *
 * ПЕРФ (21-client §3.9, scene-perf): точки группируются по `kind` (один ассет-id на группу)
 * и рисуются `PlaceholderInstancedGroup` — 4 вида фуражинга = максимум 4 draw call вместо
 * одного на точку. Собранные точки (гашёный масштаб) исключены из фрустум-культинга —
 * их немного и они статичны до конца сессии, доп. хук не оправдан.
 */

import { memo, useCallback, useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { PlaceholderInstancedGroup, type PlaceholderInstanceItem } from '@/assets/placeholders/PlaceholderInstances'
import { useFrustumCulledItems } from '../common/useFrustumCulledItems'
import { FORAGE_ASSET_BY_KIND, type ForageLayoutPoint, type Vec3 } from './layout'
import type { ForageKind } from '@/types'

export interface ForagePointsProps {
  points: readonly ForageLayoutPoint[]
  /** Уже собранные в этой сессии (локально) — скрываются/гасятся. */
  collectedIds: ReadonlySet<string>
  onCollect: (pointId: string) => void
}

function pointPosition(point: ForageLayoutPoint): Vec3 {
  return point.position
}

/** Одна группа точек одного вида (`kind`) — общий ассет, инстансируется целиком. */
const ForageKindGroup = memo(function ForageKindGroup({
  kind,
  points,
  onCollect,
}: {
  kind: ForageKind
  points: readonly ForageLayoutPoint[]
  onCollect: (pointId: string) => void
}) {
  const visible = useFrustumCulledItems(points, pointPosition, { radius: 1 })

  const handleClick = useCallback(
    (pointId: string) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onCollect(pointId)
    },
    [onCollect],
  )

  const items = useMemo<PlaceholderInstanceItem[]>(
    () =>
      visible.map((point) => ({
        key: point.id,
        position: [point.position[0], 0.3, point.position[2]],
        scale: 0.8,
        onClick: handleClick(point.id),
      })),
    [visible, handleClick],
  )

  return (
    <>
      <PlaceholderInstancedGroup id={FORAGE_ASSET_BY_KIND[kind]} items={items} />
      {visible.map((point) => (
        <Billboard key={point.id} position={[point.position[0], 0.9, point.position[2]]}>
          <Text fontSize={0.22} color="#2b2b2e" outlineWidth={0.015} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
            {kind}
          </Text>
        </Billboard>
      ))}
    </>
  )
})

/** Собранная точка — единично, гашёный масштаб, клик больше ничего не делает. */
const CollectedForagePoint = memo(function CollectedForagePoint({ point }: { point: ForageLayoutPoint }) {
  const items = useMemo<PlaceholderInstanceItem[]>(
    () => [{ key: point.id, position: [point.position[0], 0.3, point.position[2]], scale: 0.4 }],
    [point],
  )
  return <PlaceholderInstancedGroup id={FORAGE_ASSET_BY_KIND[point.kind]} items={items} />
})

export const ForagePoints = memo(function ForagePoints({ points, collectedIds, onCollect }: ForagePointsProps) {
  const { activeByKind, collected } = useMemo(() => {
    const byKind = new Map<ForageKind, ForageLayoutPoint[]>()
    const done: ForageLayoutPoint[] = []
    for (const point of points) {
      if (collectedIds.has(point.id)) {
        done.push(point)
        continue
      }
      const bucket = byKind.get(point.kind)
      if (bucket) bucket.push(point)
      else byKind.set(point.kind, [point])
    }
    return { activeByKind: byKind, collected: done }
  }, [points, collectedIds])

  return (
    <group>
      {[...activeByKind.entries()].map(([kind, kindPoints]) => (
        <ForageKindGroup key={kind} kind={kind} points={kindPoints} onCollect={onCollect} />
      ))}
      {collected.map((point) => (
        <CollectedForagePoint key={point.id} point={point} />
      ))}
    </group>
  )
})
