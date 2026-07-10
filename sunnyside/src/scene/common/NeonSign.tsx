/**
 * NeonSign.tsx — 3D-вывеска игрока (Neon Builder, `collections.neonSign`, 17-collections
 * §3.7) над фасадом дайнера — используется и в `scene/farm` (над домашним `bld_diner`), и в
 * `scene/town` (над `isOwn`-маркером фермы на стрите). Буквы — плоские заглушки с эмиссией
 * (AGENTS.md §5): нет геометрии шрифта, каждая буква — подсвеченная плашка.
 *
 * Эмиссия ФЕЙКОВАЯ (`MeshBasicMaterial` + `toneMapped={false}` + аддитивный halo позади) —
 * в проекте нет postprocessing/bloom-пайплайна (см. package.json), это дешёвый стенд-ин до
 * прихода реального bloom (22-av §4.2 «эмиссивные (bloom-postprocess) неон-акценты»).
 *
 * Днём (`dayNightIntensity=0`) буква читается как выключенный хром-каркас (§4.2 примечание
 * `pal_chrome` «неоновые каркасы вывесок днём, без свечения»); ночью цвет плавно смещается к
 * выбранному неон-цвету (`resolveNeonHex`) с анимацией (`steady`/`blink`/`chase`, §3.7).
 * Ничего не гаснет до чистого чёрного (P1 «дружелюбно») — низ диапазона зажат.
 *
 * Билборд (`drei`): вывеска всегда развёрнута к камере, как прочие текстовые маркеры сцены
 * (см. `scene/town/Streets.tsx`), не завязана на ориентацию постройки-заглушки.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { Color, type Mesh, type MeshBasicMaterial } from 'three'
import type { NeonSignConfig } from '@/types'
import { color as canonColor } from '@/assets/placeholders/registry'
import { layoutNeonLine, neonGlowAt, resolveNeonHex } from './neonGlyphs'

const LINE_HEIGHT = 0.42
const GLYPH_W = 0.16
const GLYPH_H = 0.24
const MIN_NIGHT_MIX = 0 // днём (dayNightIntensity=0) буква полностью в цвете хрома

export interface NeonSignProps {
  /** `null`/отсутствие (вывеска ещё не собрана) — компонент ничего не рисует. */
  config: NeonSignConfig | null | undefined
  /** Доля суточного цикла 0..1 (`useDayNightIntensity`, 22-av §4.5). */
  dayNightIntensity: number
  position?: [number, number, number]
  scale?: number
}

export function NeonSign({ config, dayNightIntensity, position = [0, 0, 0], scale = 1 }: NeonSignProps) {
  const lines = useMemo(() => (config?.lines ?? []).filter((l) => l.trim().length > 0), [config?.lines])
  const animation = config?.animation ?? 'steady'
  const hex = useMemo(() => resolveNeonHex(config?.colorIds), [config?.colorIds])

  const rows = useMemo(() => {
    let idx = 0
    return lines.map((line) => layoutNeonLine(line).map((g) => ({ ...g, index: idx++ })))
  }, [lines])
  const glyphCount = rows.reduce((n, r) => n + r.length, 0)

  const chromeRef = useRef(new Color(canonColor('pal_chrome')))
  const neonRef = useRef(new Color(hex))
  neonRef.current.set(hex)

  const letterMats = useRef<(MeshBasicMaterial | null)[]>([])
  const haloMesh = useRef<Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const night = Math.max(MIN_NIGHT_MIX, Math.min(1, dayNightIntensity))
    let anyGlow = 0
    for (let i = 0; i < letterMats.current.length; i++) {
      const mat = letterMats.current[i]
      if (!mat) continue
      const glow = neonGlowAt(animation, t, i)
      anyGlow += glow
      mat.color.copy(chromeRef.current).lerp(neonRef.current, night * glow)
    }
    if (haloMesh.current) {
      const avgGlow = glyphCount > 0 ? anyGlow / glyphCount : 0
      const mat = haloMesh.current.material as MeshBasicMaterial
      mat.opacity = 0.32 * night * avgGlow
      mat.color.copy(neonRef.current)
    }
  })

  if (lines.length === 0) return null

  const boardWidth = 2.4
  const boardHeight = rows.length * LINE_HEIGHT + 0.3

  return (
    <Billboard position={position}>
      <group scale={scale}>
        {/* Тёмная подложка — видна и днём (табличка выключена), и ночью (рамка вывески). */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[boardWidth, boardHeight, 0.08]} />
          <meshLambertMaterial color={canonColor('pal_chrome_dark')} />
        </mesh>

        {/* Общий glow-задник — дешёвая замена реального bloom-постпроцесса (см. докстринг). */}
        <mesh ref={haloMesh} position={[0, 0, -0.01]}>
          <planeGeometry args={[boardWidth * 0.92, boardHeight * 0.85]} />
          <meshBasicMaterial color={hex} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>

        {rows.map((row, li) => (
          <group key={li} position={[0, (rows.length - 1 - li) * LINE_HEIGHT - ((rows.length - 1) * LINE_HEIGHT) / 2, 0.02]}>
            {row.map((g) => (
              <mesh key={g.index} position={[g.x, 0, 0]}>
                <planeGeometry args={[GLYPH_W, GLYPH_H]} />
                <meshBasicMaterial
                  ref={(m) => {
                    letterMats.current[g.index] = m
                  }}
                  color={canonColor('pal_chrome')}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </Billboard>
  )
}
