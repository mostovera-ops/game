/**
 * useDayNightIntensity.tsx — реактивная обвязка над `dayNightClock.ts` для R3F-дерева
 * (`NeonSign`/`WindowGlow` в farm/town). Время берётся из `serverNow()` (`clock`-слайс,
 * AGENTS.md §0.4), НЕ `Date.now()` напрямую. Обновляется раз в секунду через `useFrame` —
 * это презентационный тик (как `anim.ts`), не игровая логика, поэтому не гоняем React-рендер
 * 60 раз/сек ради значения, которое физически меняется максимум раз в час (§4.5 переходы).
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/state'
import { hourUTC, neonIntensityForHour } from './dayNightClock'

/** Раз в секунду достаточно — доля меняется плавно в масштабе часа, не кадра. */
const UPDATE_INTERVAL_SEC = 1
/** Порог обновления React-стейта — не дёргаем рендер на шум меньше этого. */
const CHANGE_EPSILON = 0.004

/** Доля суточной неон/окна-эмиссии (0 день…1 ночь, 22-av §4.5) от реального времени сервера. */
export function useDayNightIntensity(): number {
  const serverNow = useStore((s) => s.serverNow)
  const [intensity, setIntensity] = useState(() => neonIntensityForHour(hourUTC(serverNow())))
  const acc = useRef(0)

  useFrame((_, delta) => {
    acc.current += delta
    if (acc.current < UPDATE_INTERVAL_SEC) return
    acc.current = 0
    const next = neonIntensityForHour(hourUTC(serverNow()))
    setIntensity((prev) => (Math.abs(prev - next) > CHANGE_EPSILON ? next : prev))
  })

  return intensity
}
