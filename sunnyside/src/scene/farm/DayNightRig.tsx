/**
 * DayNight.tsx — свет и тон сцены по фазе игровой недели (01-core-loop, canon §2.3).
 * Фаза берётся из серверного календаря (`clock.calendar.phase`); чистое отображение
 * фаза→тон живёт в `daynight.ts`. Суббота — тёплый закат, воскресенье — вечер, будни — день.
 *
 * Смена фазы недели (Realtime-канал календаря) — дискретный скачок цели, поэтому фон/свет
 * плавно ДОТЯГИВАЮТСЯ к новому тону экспоненциальным lerp (`TONE_TWEEN_SECONDS`), а не
 * щёлкают мгновенно (22-av §3.6 «плавная интерполяция цвета неба/интенсивности» — тот же
 * принцип, применённый здесь к смене недельного тона, не только суточного). Отдельное
 * НЕПРЕРЫВНОЕ суточное измерение (реальный UTC-час сервера → доля неон-эмиссии/окна-светятся)
 * живёт в `../common/dayNightClock.ts` + `../common/useDayNightIntensity.tsx` — читается
 * `NeonSign`/`WindowGlow` напрямую, эта рамка не занимается неоном.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, type DirectionalLight as ThreeDirectionalLight, type AmbientLight as ThreeAmbientLight } from 'three'
import { useStore } from '@/state'
import { phaseTone } from './daynight'

/** Постоянная времени твина тона (сек) — «лёгкий» переход, не мгновенный щелчок. */
const TONE_TWEEN_SECONDS = 2.5

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function DayNight() {
  const phase = useStore((s) => s.clock.calendar?.phase ?? null)
  const tone = useMemo(() => phaseTone(phase), [phase])
  const scene = useThree((s) => s.scene)

  const ambientRef = useRef<ThreeAmbientLight>(null)
  const dirRef = useRef<ThreeDirectionalLight>(null)

  const targetBg = useMemo(() => new Color(tone.background), [tone.background])
  const targetDirColor = useMemo(() => new Color(tone.dirColor), [tone.dirColor])
  const currentBg = useRef<Color | null>(null)
  const currentAmbient = useRef(tone.ambient)
  const currentDirIntensity = useRef(tone.dirIntensity)

  useEffect(() => {
    if (!currentBg.current) currentBg.current = targetBg.clone()
    scene.background = currentBg.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useFrame((_, delta) => {
    if (!currentBg.current) return
    const t = Math.min(1, Math.max(0, delta) / TONE_TWEEN_SECONDS)
    currentBg.current.lerp(targetBg, t)
    currentAmbient.current = lerpNum(currentAmbient.current, tone.ambient, t)
    currentDirIntensity.current = lerpNum(currentDirIntensity.current, tone.dirIntensity, t)
    if (ambientRef.current) ambientRef.current.intensity = currentAmbient.current
    if (dirRef.current) {
      dirRef.current.intensity = currentDirIntensity.current
      dirRef.current.color.lerp(targetDirColor, t)
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={tone.ambient} />
      <directionalLight
        ref={dirRef}
        position={[6, 10, 4]}
        intensity={tone.dirIntensity}
        color={tone.dirColor}
        castShadow
      />
    </>
  )
}
