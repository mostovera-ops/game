/**
 * GrimsbyBanner.tsx — V2 Event Boss / Glutton Phase Banner (`ui_appetite_meter` V2,
 * 19-ui-ux §3.5, 10-server-event §3.9/§4.8). Баннер множителей темы «Приехал Обжора»:
 * текущий каприз-фаза (craves ×2.0 / likes ×1.3 / bored ×0.6), таймер до смены фазы.
 *
 * ГРАНИЦА (AGENTS.md §0.3): фаза/множители — ЧИСТЫЕ формулы `@/engine/event`
 * (`phaseIndexAt`/`phaseDef`/`GLUTTON_PHASE_MS`), детерминированы от `serverNow()` и
 * начала окна вклада (`windowOpensAt` из `event.meter.window.opensAt`, серверная
 * истина) — предпросмотр для UI, не источник начисления (сервер считает M_theme сам,
 * §3.13).
 */

import { useEffect, useReducer } from 'react'
import { useStore } from '@/state'
import { GLUTTON_PHASE_MS, phaseDef, phaseIndexAt } from '@/engine/event'
import type { DishCategory } from '@/engine/event'
import { DINER } from '../market/tokens'
import { formatCountdown } from './format'

const CATEGORY_LABEL: Record<DishCategory, { en: string; ru: string }> = {
  cat_snacks: { en: 'Snacks', ru: 'Закуски' },
  cat_grill: { en: 'Grill', ru: 'Гриль' },
  cat_desserts: { en: 'Desserts', ru: 'Десерты' },
  cat_drinks: { en: 'Drinks', ru: 'Напитки' },
}

export interface GrimsbyBannerProps {
  /** Начало окна вклада уикенда (Сб 00:00 UTC) — якорь фаз (§3.9). */
  windowOpensAt: number
}

export function GrimsbyBanner({ windowOpensAt }: GrimsbyBannerProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const serverNow = useStore((s) => s.serverNow)

  // Тикающий таймер до смены фазы — визуально, не игровая логика.
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = Math.max(0, serverNow() - windowOpensAt)
  const phaseIndex = phaseIndexAt(elapsed)
  const def = phaseDef(phaseIndex)
  const untilNextPhase = GLUTTON_PHASE_MS - (elapsed % GLUTTON_PHASE_MS)

  return (
    <div
      data-testid="grimsby-banner"
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white"
      style={{ background: DINER.cherry }}
    >
      <span>
        {ru ? 'Гримсби хочет' : 'Grimsby craves'}{' '}
        <strong data-testid="grimsby-craves">{ru ? CATEGORY_LABEL[def.craves].ru : CATEGORY_LABEL[def.craves].en}</strong>{' '}
        ×2.0 · {ru ? 'любит' : 'likes'}{' '}
        <span data-testid="grimsby-likes">{ru ? CATEGORY_LABEL[def.likes].ru : CATEGORY_LABEL[def.likes].en}</span> ×1.3 ·{' '}
        {ru ? 'скучает по' : 'bored of'}{' '}
        <span data-testid="grimsby-bored">{ru ? CATEGORY_LABEL[def.bored].ru : CATEGORY_LABEL[def.bored].en}</span> ×0.6
      </span>
      <span data-testid="grimsby-phase-countdown" className="tabular-nums whitespace-nowrap opacity-90">
        {formatCountdown(untilNextPhase)}
      </span>
    </div>
  )
}
