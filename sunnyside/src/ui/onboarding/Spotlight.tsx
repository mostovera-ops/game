/**
 * Spotlight.tsx — мягкая подсветка целевого элемента шага (18-onboarding §5):
 * «мягкое свечение целевого объекта + пульсирующая стрелка; БЕЗ блокировки
 * остального экрана (можно осмотреться)».
 *
 * Цель ищется по `[data-onboarding-target="<key>"]` в DOM (компоненты сцен/HUD
 * помечают свои POI этим атрибутом). Best-effort: если цель не в текущей сцене —
 * оверлей ничего не рисует и НЕ мешает (pointer-events: none на всём слое).
 */

import { useEffect, useState } from 'react'
import type { SpotlightTarget } from './scenario'
import { OT } from './theme'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface SpotlightProps {
  target: SpotlightTarget
}

export function Spotlight({ target }: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-onboarding-target="${target}"]`)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const loop = () => {
      measure()
      raf = requestAnimationFrame(loop)
    }
    // rAF-цикл: цель может двигаться (камера/скролл), пересчитываем дёшево.
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [target])

  if (!rect) return null

  const pad = 10
  const ringTop = rect.top - pad
  const ringLeft = rect.left - pad
  const ringW = rect.width + pad * 2
  const ringH = rect.height + pad * 2

  return (
    <div
      data-testid={`onboarding-spotlight-${target}`}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    >
      <style>{`
        @keyframes onbGlow { 0%,100% { box-shadow: 0 0 0 3px ${OT.mustard}, 0 0 18px 6px ${OT.mustard}66; } 50% { box-shadow: 0 0 0 4px ${OT.mustard}, 0 0 28px 12px ${OT.mustard}99; } }
        @keyframes onbArrow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        @media (prefers-reduced-motion: reduce) {
          .onb-glow, .onb-arrow { animation: none !important; }
        }
      `}</style>
      <div
        className="onb-glow absolute rounded-xl"
        style={{
          top: ringTop,
          left: ringLeft,
          width: ringW,
          height: ringH,
          border: `3px solid ${OT.mustard}`,
          borderRadius: 14,
          animation: 'onbGlow 1.4s ease-in-out infinite',
        }}
      />
      <div
        className="onb-arrow absolute font-black"
        style={{
          top: ringTop - 30,
          left: ringLeft + ringW / 2 - 10,
          color: OT.mustard,
          fontSize: 26,
          textShadow: `0 2px 0 ${OT.board}`,
          animation: 'onbArrow 1.1s ease-in-out infinite',
        }}
      >
        ▼
      </div>
    </div>
  )
}
