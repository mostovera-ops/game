/**
 * AppetiteMeter.tsx — V1 Appetite Meter (`ui_appetite_meter`, 19-ui-ux §3.5,
 * 10-server-event §3.3/§3.4). Главный экран серверного ивента: коллективная шкала
 * сытости города 0..100%+ с вехами `25/50/75/100` (+ stretch `125/150`), таймер до
 * финала Вс 20:00 UTC, тема недели, строка личного вклада, вымпел стрита.
 *
 * ГРАНИЦА (AGENTS.md §0.3): читает `event`-слайс (серверная истина, Realtime-кэш).
 * Пороги вех/подписи считает `@/engine/event` (чистые формулы — предпросмотр,
 * `milestoneThresholds` того же Goal_100, что уже пришёл в снапшоте), НЕ дублирует
 * инкремент меры — та приходит готовой (`event.meter.meterPct/meterFp`).
 */

import { useEffect, useReducer } from 'react'
import { useStore } from '@/state'
import { milestoneThresholds } from '@/engine/event'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { clampPct, formatCountdown, formatFp } from './format'
import { GrimsbyBanner } from './GrimsbyBanner'

const THEME_LABEL: Record<string, { en: string; ru: string }> = {
  ev_glutton: { en: 'The Glutton Comes to Town', ru: 'Приехал Обжора' },
  ev_big_festival: { en: 'The Big Festival', ru: 'Большой фестиваль' },
  ev_harvest_homecoming: { en: 'Harvest Homecoming', ru: 'Праздник урожая' },
  ev_drivein_night: { en: 'Drive-in Night', ru: 'Ночь автокино' },
  ev_state_fair_showdown: { en: 'State Fair Showdown', ru: 'Ярмарка штата' },
}

function AppetiteMeterBody() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const event = useStore((s) => s.event)
  const serverNow = useStore((s) => s.serverNow)

  // Тикающий таймер countdown — чисто визуально, не игровая логика (мимикрия DayPhaseBanner).
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!event) {
    return (
      <p data-testid="appetite-meter-empty" className="py-6 text-center italic opacity-70">
        {ru ? 'Ивент стартует в выходные.' : 'The event kicks off this weekend.'}
      </p>
    )
  }

  const { meter, personalFp, streetPennant } = event
  const pct = clampPct(meter.meterPct)
  const theme = THEME_LABEL[meter.eventKey]
  const remaining = meter.finalAt - serverNow()
  const thresholds = milestoneThresholds(meter.goalFp)
  const barPct = Math.min(100, pct)

  return (
    <div data-testid="ui-appetite-meter-body" className="flex flex-col gap-3">
      <header className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {theme ? (ru ? theme.ru : theme.en) : meter.eventKey}
        </span>
        <span data-testid="appetite-meter-countdown" className="tabular-nums text-xs opacity-70">
          {ru ? 'До финала' : 'Until finale'}: {formatCountdown(remaining)}
        </span>
      </header>

      {meter.eventKey === 'ev_glutton' && <GrimsbyBanner windowOpensAt={meter.window.opensAt} />}

      <div className="relative">
        <div className="flex items-baseline justify-between text-sm">
          <span data-testid="appetite-meter-pct" className="tabular-nums text-2xl font-black">
            {pct}%
          </span>
          <span className="tabular-nums text-xs opacity-70">
            {formatFp(meter.meterFp)} / {formatFp(meter.goalFp)} FP
          </span>
        </div>
        <div
          className="relative mt-2 h-4 w-full overflow-hidden rounded-full"
          style={{ background: DINER.chrome }}
        >
          <div
            data-testid="appetite-meter-bar"
            className="h-full"
            style={{ width: `${barPct}%`, background: DINER.cherry }}
          />
          {thresholds
            .filter((t) => !t.stretch)
            .map((t) => (
              <span
                key={t.pct}
                data-testid={`appetite-meter-milestone-${t.pct}`}
                className="absolute top-0 h-full w-0.5"
                style={{ left: `${t.pct}%`, background: DINER.board, opacity: 0.5 }}
                title={`${t.pct}%`}
              />
            ))}
        </div>
        <ul className="mt-1 flex justify-between text-[10px] tabular-nums opacity-70" data-testid="appetite-meter-milestone-labels">
          {event.meter.milestones.map((m) => (
            <li key={m.pct} data-testid={`appetite-meter-reward-${m.pct}`} className={m.hit ? 'font-bold' : undefined}>
              {m.pct}% {m.hit ? '✓' : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-dashed p-2 text-sm" style={{ borderColor: DINER.chrome }}>
        <span>{ru ? 'Твой вклад' : 'Your contribution'}</span>
        <span data-testid="appetite-meter-personal-fp" className="tabular-nums font-bold">
          {formatFp(personalFp)} FP
        </span>
      </div>

      <div
        data-testid="appetite-meter-pennant"
        className="flex items-center justify-between rounded-lg p-2 text-sm text-white"
        style={{ background: streetPennant ? DINER.teal : DINER.chrome, color: streetPennant ? undefined : DINER.board }}
      >
        <span>{ru ? 'Вымпел стрита' : 'Street pennant'}</span>
        <span>{streetPennant ? '🚩 ' + (ru ? 'взят' : 'earned') : ru ? 'пока нет' : 'not yet'}</span>
      </div>
    </div>
  )
}

export function AppetiteMeter() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'

  return (
    <section
      data-testid="ui-appetite-meter"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="text-lg font-black uppercase tracking-wide">
        {ru ? 'Аппетитометр' : 'Appetite Meter'}
      </h2>
      <AppetiteMeterBody />
    </section>
  )
}
