/**
 * GrandOpeningIntro.tsx — экран выпуска на улицу (ui_grand_opening_intro, 18-onboarding
 * §3.4/§3.8): вывеска GRAND OPENING, вручение фермы, баннер ×2 доход·7 дней, авто-
 * предложение стрита с первым Potluck. Для скипнувших (§3.7) — тёплая записка вместо
 * прохождения. Финал → `finish()` (FTUE done).
 *
 * Буст ×2 и матчинг стрита — серверные (§3.4/§3.8); этот экран их только анонсирует и
 * зовёт колбэки. Реальное вступление в стрит композиция может подвесить через
 * `onStreetJoin` (ui/ не ходит в net — AGENTS.md §3).
 */

import type { Locale } from '@/types'
import { useFtueStore } from './store'
import { NanaPortrait } from './NanaPortrait'
import { TX, t } from './text'
import { OT, PRINT_SHADOW, DINER_RADIUS } from './theme'

export interface GrandOpeningIntroProps {
  locale: Locale
  /** Хук композиции: реальный матчинг/вступление в стрит (§3.8). */
  onStreetJoin?: () => void
  /** Хук композиции: FTUE завершён (можно снять гидрацию/аналитику onb_ftue_complete). */
  onFinish?: () => void
}

export function GrandOpeningIntro({ locale, onStreetJoin, onFinish }: GrandOpeningIntroProps) {
  const skipped = useFtueStore((s) => s.skipped)
  const streetJoined = useFtueStore((s) => s.streetJoined)
  const farmName = useFtueStore((s) => s.farmName)
  const joinStreet = useFtueStore((s) => s.joinStreet)
  const finish = useFtueStore((s) => s.finish)

  function handleJoin() {
    joinStreet()
    onStreetJoin?.()
  }

  function handleFinish() {
    finish()
    onFinish?.()
  }

  return (
    <div
      data-testid="onboarding-release"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(TX.releaseTitle, locale)}
        className="w-full max-w-md"
        style={{
          background: OT.card,
          color: OT.ink,
          borderRadius: DINER_RADIUS,
          boxShadow: PRINT_SHADOW,
          border: `2px solid ${OT.chrome}`,
          padding: 20,
        }}
      >
        {/* Неон-вывеска GRAND OPENING */}
        <div
          className="mb-4 rounded-lg py-3 text-center text-xl font-black uppercase tracking-[0.15em]"
          style={{
            background: OT.board,
            color: OT.neon,
            textShadow: `0 0 10px ${OT.neon}, 0 0 20px ${OT.neon}88`,
            border: `2px solid ${OT.chrome}`,
          }}
        >
          {t(TX.releaseTitle, locale)}
        </div>

        {/* Вручение фермы */}
        <div className="mb-3 flex items-center gap-3">
          <NanaPortrait npc="npc_nana_opal" locale={locale} size={52} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: OT.mustard }}>
              {t(TX.handoverTitle, locale)}
            </div>
            <div className="text-base font-black" style={{ color: OT.ink }} data-testid="onboarding-farmname-label">
              {farmName}
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed" style={{ color: OT.ink }}>
          {t(skipped ? TX.skipNote : TX.releaseBody, locale)}
        </p>

        {/* Баннер Grand Opening ×2 */}
        <div
          data-testid="onboarding-grandopening-banner"
          className="mb-4 rounded-lg px-3 py-2 text-center text-sm font-black uppercase tracking-wide"
          style={{ background: OT.mustard, color: OT.board }}
        >
          {t(TX.grandOpeningBanner, locale)}
        </div>

        {/* Авто-предложение стрита (§3.8) */}
        <div
          className="mb-4 rounded-xl p-3"
          style={{ background: OT.paper, border: `2px solid ${OT.chrome}` }}
        >
          <div className="mb-1 text-xs font-black uppercase tracking-wide" style={{ color: OT.mustard }}>
            {t(TX.streetTitle, locale)}
          </div>
          {streetJoined ? (
            <div
              data-testid="onboarding-street-joined"
              className="text-sm font-bold"
              style={{ color: OT.good }}
            >
              {t(TX.streetJoined, locale)}
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm" style={{ color: OT.ink }}>
                {t(TX.streetBody, locale)}
              </p>
              <button
                type="button"
                data-testid="onboarding-street-join"
                onClick={handleJoin}
                className="w-full rounded-full py-2 text-sm font-bold"
                style={{ background: OT.ribbon, color: OT.card }}
              >
                {t(TX.streetJoin, locale)}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          data-testid="onboarding-finish"
          onClick={handleFinish}
          className="w-full rounded-full py-2.5 text-sm font-black uppercase tracking-wide"
          style={{ background: OT.cherry, color: OT.card, boxShadow: PRINT_SHADOW }}
        >
          {t(TX.lightSign, locale)}
        </button>
      </div>
    </div>
  )
}
