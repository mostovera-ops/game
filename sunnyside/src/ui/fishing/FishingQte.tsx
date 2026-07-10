/**
 * ui/fishing/FishingQte.tsx — оверлей мини-игры рыбалки (`ui_fishing_qte`, канон
 * нейминг-кандидат, 08-mail-foraging §3.2.4, BACKLOG BL-1).
 *
 * КОНТЕКСТНЫЙ `POI → SHEET` без canon-ключа (как F1 `ui/farm/SeedPicker.tsx`/F4
 * `StorageHost` в `PanelHost.tsx`) — свой backdrop, не через общий `Modal`/`ui.activePanel`
 * (тот каркас — только для зафиксированных canon-панелей, AGENTS.md §0.7). Открывается
 * из `TownScene` кликом по точке фуражинга вида `kind === 'fishing'`.
 *
 * ФАЗЫ (§3.2.4 п.1-3): `casting` (анимация заброса, 2с) → `bar` (Catch Bar, 3 попытки
 * «Тяни!», интервал прохода ~1.2с) → `done` (итог, зовёт `onCastComplete`). ВСЯ чистая
 * математика (позиция маркера/попадание/ширина зоны) — в `engine/mail-foraging/fishing.ts`
 * (node-тестируемо); здесь — только таймеры/DOM/клики (ui-граница, AGENTS.md §3).
 *
 * АНТИ-ЧИТ (см. докстринг `engine/mail-foraging/fishing.ts` `resolveFishCast`/
 * `FishCastReq` в `types/rpc.ts`): `hits`, который эта панель передаёт наверх — ЛОКАЛЬНАЯ
 * оценка навыка для UX/оптимистики, отправляется адаптеру лишь как МОДИФИКАТОР
 * вероятностей (не гарантия) — реальный ролл делает `TownScene`/adapter через
 * `mailForaging.fish(hits)`, эта панель НИЧЕГО не начисляет сама.
 *
 * Закрытие (крестик/клик по фону) ДО фазы `done` — отмена заброса без вызова
 * `onCastComplete` (ничего не тратится/не портится, P3 — «нет провала», не «нет попытки»).
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/state'
import { DINER, PRINT_SHADOW } from '@/ui/kitchen/tokens'
import { catchBarMarkerPosition, greenZoneWidth, isHit } from '@/engine/mail-foraging/fishing'
import { FISHING_ATTEMPTS_PER_CAST } from '@/engine/mail-foraging/constants'

/** Длительность анимации заброса (§3.2.4 п.1 — «2 сек»). */
const CAST_ANIM_MS = 2000
/** Интервал прохода маркера через полосу (§3.2.4 п.3 — «~1.2с, гипотеза»). */
const PASS_PERIOD_MS = 1200
/** Тик перерисовки маркера — косметическая анимация активного оверлея, НЕ игровое время
 *  (AGENTS.md §0.4 — `serverNow()` только для персистируемой логики, не для 50мс-тика UI). */
const MARKER_TICK_MS = 50

type Phase = 'casting' | 'bar' | 'done'

export interface FishingQteProps {
  /** Тир удочки игрока (0 Bamboo..2 Chrome) — бонус ширины зоны (§3.2.7). TODO(mail-catalog
   *  owner, BL-2 — открытый вопрос ОВ-3 спеки 08): реальное владение/покупка удочки живёт в
   *  Каталоге почтой, которого ещё нет — до него дефолт Bamboo (tier 0, без бонуса). */
  rodTier?: number
  onClose: () => void
  /** Итог заброса — число попаданий (0..`FISHING_ATTEMPTS_PER_CAST`) за 3 попытки. */
  onCastComplete: (hits: number) => void
}

export function FishingQte({ rodTier = 0, onClose, onCastComplete }: FishingQteProps) {
  const locale = useStore((s) => s.ui.locale)
  const [phase, setPhase] = useState<Phase>('casting')
  const [attempt, setAttempt] = useState(0)
  const [hits, setHits] = useState(0)
  const [markerPos, setMarkerPos] = useState(0)
  const barStartRef = useRef(Date.now())

  const zoneWidth = greenZoneWidth(rodTier)
  const t = (ru: string, en: string) => (locale === 'ru' ? ru : en)

  // Фаза заброса — 2с анимации, затем открываем Catch Bar (п.1).
  useEffect(() => {
    if (phase !== 'casting') return
    const timer = window.setTimeout(() => {
      barStartRef.current = Date.now()
      setPhase('bar')
    }, CAST_ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  // Анимация маркера, пока идёт Catch Bar — чистая математика в engine/mail-foraging/fishing.
  useEffect(() => {
    if (phase !== 'bar') return
    const id = window.setInterval(() => {
      setMarkerPos(catchBarMarkerPosition(Date.now() - barStartRef.current, PASS_PERIOD_MS))
    }, MARKER_TICK_MS)
    return () => window.clearInterval(id)
  }, [phase])

  // Итог — зовём наверх ровно один раз, когда фаза переходит в `done`.
  useEffect(() => {
    if (phase === 'done') onCastComplete(hits)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function pull() {
    if (phase !== 'bar') return
    const hit = isHit(markerPos, zoneWidth)
    const nextAttempt = attempt + 1
    setAttempt(nextAttempt)
    if (hit) setHits((h) => h + 1)
    if (nextAttempt >= FISHING_ATTEMPTS_PER_CAST) setPhase('done')
  }

  return (
    <div
      data-testid="fishing-qte"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={phase !== 'done' ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Рыбалка', 'Fishing')}
        className="hud-receipt pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-t-2xl p-4 md:m-4 md:rounded-[var(--radius-diner)]"
        onClick={(e) => e.stopPropagation()}
        style={{ background: DINER.paper }}
      >
        <header className="hud-kicker flex items-center justify-between pb-2 text-sm">
          <span>{t('Рыболовное место', 'Fishing Spot')}</span>
          <button
            type="button"
            data-testid="fishing-qte-close"
            aria-label="Close"
            onClick={onClose}
            className="hud-tap-target flex items-center justify-center rounded-full px-2 text-base leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </header>

        {phase === 'casting' && (
          <p
            data-testid="fishing-qte-casting"
            className="py-6 text-center font-black uppercase"
            style={{ color: DINER.ink }}
          >
            {t('Забрасываем удочку…', 'Casting the line…')}
          </p>
        )}

        {phase === 'bar' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs opacity-80" style={{ color: DINER.ink }}>
              {t(
                `Попытка ${attempt + 1} из ${FISHING_ATTEMPTS_PER_CAST}`,
                `Attempt ${attempt + 1} of ${FISHING_ATTEMPTS_PER_CAST}`,
              )}
            </p>
            <div
              data-testid="fishing-qte-bar"
              className="relative h-6 w-full overflow-hidden rounded-full"
              style={{ background: DINER.chrome }}
            >
              <div
                data-testid="fishing-qte-zone"
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${(0.5 - zoneWidth / 2) * 100}%`,
                  width: `${zoneWidth * 100}%`,
                  background: DINER.teal,
                }}
              />
              <div
                data-testid="fishing-qte-marker"
                className="absolute inset-y-0 w-1 rounded-full"
                style={{ left: `${markerPos * 100}%`, background: DINER.cherry }}
              />
            </div>
            <button
              type="button"
              data-testid="fishing-qte-pull"
              onClick={pull}
              className="hud-tap-target rounded-xl px-4 py-3 text-center font-black uppercase tracking-wide"
              style={{ background: DINER.cherry, color: '#fff', boxShadow: PRINT_SHADOW }}
            >
              {t('Тяни!', 'Pull!')}
            </button>
            <p className="text-xs opacity-70" style={{ color: DINER.ink }}>
              {t(`Попаданий: ${hits}`, `Hits: ${hits}`)}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <p
            data-testid="fishing-qte-done"
            className="py-6 text-center font-black uppercase"
            style={{ color: DINER.ink }}
          >
            {t('Сматываем улов…', 'Reeling in the catch…')}
          </p>
        )}
      </div>
    </div>
  )
}
