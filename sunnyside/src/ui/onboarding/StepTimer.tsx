/**
 * StepTimer.tsx — сжатый таймер шага мини-недели (18-onboarding §4.1): секунды
 * вместо минут/часов, «ничего не ждётся по-настоящему» (§2.2). Чисто визуальный
 * акцент шага — НЕ гейт и НЕ игровое время (песочница офлайн-безопасна, §3.2),
 * поэтому обычный клиентский отсчёт (setInterval), без serverNow.
 *
 * P3/P4: таймер никогда не «проваливает» шаг — по нулю просто «готово», действие
 * остаётся доступным всё время (MiniWeek не блокирует кнопку по таймеру).
 */

import { useEffect, useRef, useState } from 'react'
import { OT } from './theme'

export interface StepTimerProps {
  seconds: number
  /** Метка (напр. «Растёт…», «Готовится…»). */
  label: string
  onComplete?: () => void
}

export function StepTimer({ seconds, label, onComplete }: StepTimerProps) {
  const [left, setLeft] = useState(seconds)
  const doneRef = useRef(false)

  useEffect(() => {
    setLeft(seconds)
    doneRef.current = false
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id)
          if (!doneRef.current) {
            doneRef.current = true
            onComplete?.()
          }
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  const pct = seconds > 0 ? (left / seconds) * 100 : 0

  return (
    <div data-testid="onboarding-timer" className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: OT.inkSoft }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{left}s</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: OT.chrome }}>
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${100 - pct}%`, background: OT.teal }}
        />
      </div>
    </div>
  )
}
