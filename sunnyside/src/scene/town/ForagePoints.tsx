/**
 * ForagePoints.tsx — точки фуражинга обочины (`mech_foraging`, 08-mail-foraging §3.2,
 * 11-town §3.1 Roadside). Клик → `onCollect(pointId)`; TownScene решает, что это значит
 * (см. TODO(mail-foraging) там — реальный `MailForagingSystem.forageClaim/forageCollect`
 * ещё не реализован, сцена не имеет доступа к `@/net` напрямую — AGENTS.md §3).
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7,
 * registry-converge: свой мини-реестр `scene/assets/registry.ts` удалён).
 */

import { Billboard, Text } from '@react-three/drei'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { FORAGE_ASSET_BY_KIND, type ForageLayoutPoint } from './layout'

export interface ForagePointsProps {
  points: readonly ForageLayoutPoint[]
  /** Уже собранные в этой сессии (локально) — скрываются/гасятся. */
  collectedIds: ReadonlySet<string>
  onCollect: (pointId: string) => void
}

export function ForagePoints({ points, collectedIds, onCollect }: ForagePointsProps) {
  return (
    <group>
      {points.map((point) => {
        const collected = collectedIds.has(point.id)
        return (
          <group
            key={point.id}
            position={point.position}
            data-testid={`forage-point-${point.id}`}
            onClick={(e) => {
              e.stopPropagation()
              if (collected) return
              onCollect(point.id)
            }}
          >
            <PlaceholderMesh id={FORAGE_ASSET_BY_KIND[point.kind]} position={[0, 0.3, 0]} scale={collected ? 0.4 : 0.8} />
            {!collected && (
              <Billboard position={[0, 0.9, 0]}>
                <Text fontSize={0.22} color="#2b2b2e" outlineWidth={0.015} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
                  {point.kind}
                </Text>
              </Billboard>
            )}
          </group>
        )
      })}
    </group>
  )
}
