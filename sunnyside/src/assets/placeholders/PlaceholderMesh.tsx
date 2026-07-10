/**
 * PlaceholderMesh.tsx — R3F-компонент: рендерит заглушку по `id` из registry.ts
 * (22-audio-visual.md §7 «Политика заглушек»).
 *
 * Использование:
 *   <PlaceholderMesh id="bld_diner" position={[0, 0, 0]} />
 *
 * Правила (22-av §7.4 «критерии достаточно для теста»):
 *  - Неизвестный `id` НИКОГДА не рендерится как «дыра»/крах сцены (V3 22-av §8) —
 *    рисуем явный magenta-маркер.
 *  - В dev-режиме (см. bootstrap/debug.ts `isDebugEnabled()`) над объектом всплывает
 *    билборд-лейбл с `id` — быстрый визуальный grep «это ещё заглушка, не финал».
 *  - Материал — MeshLambertMaterial, плоские цвета (22-av §3.1 «2-3 тона, cel-шейдинг»,
 *    здесь используем плоский Lambert как экономичный стенд-ин до toon-рампа).
 *
 * ЕДИНСТВЕННЫЙ компонент рендера заглушек в проекте (registry-converge): универсальный рендер
 * ЛЮБОГО ассета из полного мастер-каталога Фазы D — персонажей/животных/декор/town-projects/
 * env-пропсов/построек. Все 4 сцены (`farm`/`town`/`fair`/`shift`) используют его напрямую;
 * прежний параллельный тонкий рендер `src/scene/assets/Prop.tsx` (со своим мини-реестром) удалён.
 */

import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { isDebugEnabled } from '@/bootstrap/debug'
import {
  color,
  getAsset,
  type AssetEntry,
  type PlaceholderPart,
  type PlaceholderSpec,
} from './registry'

const MAGENTA_MARKER = '#ff00ff'

/** Один примитив-часть (сфера/бокс/капсула/плоскость/конус/цилиндр). */
function Primitive({ part }: { part: PlaceholderPart }) {
  const [w, h, d] = part.size
  const fill = color(part.color)
  const pos: [number, number, number] = part.offset ?? [0, 0, 0]
  const rot: [number, number, number] = part.rotation ?? [0, 0, 0]
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      {part.shape === 'box' && <boxGeometry args={[w, h, d]} />}
      {part.shape === 'sphere' && <sphereGeometry args={[w, 16, 12]} />}
      {part.shape === 'capsule' && <capsuleGeometry args={[w, h, 4, 8]} />}
      {part.shape === 'cone' && <coneGeometry args={[w, h, 16]} />}
      {part.shape === 'cylinder' && <cylinderGeometry args={[w, w, h, 16]} />}
      {part.shape === 'plane' && <planeGeometry args={[w, d]} />}
      <meshLambertMaterial color={fill} />
    </mesh>
  )
}

/** Fallback-акцент: тонкая полоса/бейдж поверх основной формы (§7.1 «постройка/персонаж»). */
function AccentBadge({ spec }: { spec: PlaceholderSpec }) {
  if (spec.accent === undefined) return null
  const [w, h] = spec.size ?? [1, 1, 1]
  return (
    <mesh position={[0, h * 0.55, w * 0.35]} castShadow>
      <boxGeometry args={[w * 0.4, h * 0.12, 0.03]} />
      <meshLambertMaterial color={color(spec.accent)} />
    </mesh>
  )
}

function renderSpec(spec: PlaceholderSpec) {
  if (spec.shape === 'group') {
    return <>{(spec.parts ?? []).map((part, i) => <Primitive key={i} part={part} />)}</>
  }
  const part: PlaceholderPart = {
    shape: spec.shape,
    size: spec.size ?? [1, 1, 1],
    color: spec.color ?? 'pal_chrome',
  }
  return (
    <>
      <Primitive part={part} />
      <AccentBadge spec={spec} />
    </>
  )
}

/** Заметный маркер для отсутствующего в реестре id — никогда не «дыра» в сцене (22-av V3). */
function UnknownAssetMarker({ id }: { id: string }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshLambertMaterial color={MAGENTA_MARKER} />
      </mesh>
      <DevLabel text={`⚠ unknown asset: ${id}`} height={0.6} />
    </group>
  )
}

/** Билборд-подпись, видна только в дев-режиме (bootstrap/debug.ts). */
function DevLabel({ text, height }: { text: string; height: number }) {
  if (!isDebugEnabled()) return null
  return (
    <Billboard position={[0, height, 0]}>
      <Text fontSize={0.16} color="#111111" outlineWidth={0.01} outlineColor="#ffffff" anchorX="center" anchorY="bottom">
        {text}
      </Text>
    </Billboard>
  )
}

export interface PlaceholderMeshProps {
  /** Ключ ассета из registry.ts (напр. `bld_diner`, `an_cow`, `mch_grill`, `toy_cosmos_57_rare`). */
  id: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  /** Принудительно показать/скрыть dev-лейбл, игнорируя isDebugEnabled(). */
  forceLabel?: boolean
}

/**
 * Рендерит заглушку ассета `id`. Категории без 3D-геометрии (`ui`/`texture`/`music`/`sfx`)
 * рисуются как плоская подписанная плашка — этого достаточно, чтобы место было «занято»
 * и видно в дев-лейбле, но такие id обычно не кладут в 3D-сцену напрямую.
 */
export function PlaceholderMesh({ id, position, rotation, scale, forceLabel }: PlaceholderMeshProps) {
  const entry = useMemo<AssetEntry | undefined>(() => getAsset(id), [id])

  if (entry === undefined) {
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <UnknownAssetMarker id={id} />
      </group>
    )
  }

  const showLabel = forceLabel === true || isDebugEnabled()
  const labelHeight = entry.placeholder?.size?.[1] ?? entry.placeholder?.parts?.[0]?.size[1] ?? 1

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {entry.placeholder !== undefined ? (
        renderSpec(entry.placeholder)
      ) : (
        // Категория без геометрии (ui/texture/music/sfx) — плоская подписанная плашка-заглушка.
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshLambertMaterial color={MAGENTA_MARKER} />
        </mesh>
      )}
      {showLabel && <DevLabel text={`${entry.id} (${entry.category})`} height={labelHeight * 0.6 + 0.3} />}
    </group>
  )
}
