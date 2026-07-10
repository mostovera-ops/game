/**
 * LegacyLetter.tsx — экран письма-наследства (ui_legacy_letter, 18-onboarding §2.1/§3.1).
 * Конверт с маркой, письмо Бабушки Опал, ввод имени фермы, 4 косметических пресета
 * аватара (D11), кнопки Begin и (для квалифицированных) Skip (§3.7).
 *
 * Логики скипа тут нет: право на скип — серверный флаг (§3.7 анти-фрод), приходит
 * пропом `canSkip`. Экран только отражает его и зовёт колбэки стора.
 */

import type { Locale } from '@/types'
import { useFtueStore } from './store'
import { AVATAR_PRESETS } from './scenario'
import { TX, t } from './text'
import { NanaPortrait } from './NanaPortrait'
import { OT, PRINT_SHADOW, DINER_RADIUS } from './theme'

export interface LegacyLetterProps {
  locale: Locale
  /** Серверный флаг: имеет ли аккаунт право пропустить мини-неделю (§3.7). */
  canSkip?: boolean
}

export function LegacyLetter({ locale, canSkip = false }: LegacyLetterProps) {
  const farmName = useFtueStore((s) => s.farmName)
  const avatar = useFtueStore((s) => s.avatar)
  const setFarmName = useFtueStore((s) => s.setFarmName)
  const setAvatar = useFtueStore((s) => s.setAvatar)
  const startMiniWeek = useFtueStore((s) => s.startMiniWeek)
  const skip = useFtueStore((s) => s.skip)

  return (
    <div
      data-testid="onboarding-letter"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(TX.letterTitle, locale)}
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
        {/* Марка-штамп */}
        <div
          className="mb-3 inline-block rounded px-2 py-1 text-[11px] font-black uppercase tracking-widest"
          style={{ background: OT.cherry, color: OT.card, transform: 'rotate(-3deg)' }}
        >
          {t(TX.letterStamp, locale)}
        </div>

        <div className="mb-3 flex items-center gap-3">
          <NanaPortrait npc="npc_nana_opal" locale={locale} size={56} />
          <h2 className="text-lg font-black" style={{ color: OT.ink }}>
            {t(TX.letterTitle, locale)}
          </h2>
        </div>

        <p className="mb-4 text-sm leading-relaxed" style={{ color: OT.ink }}>
          {t(TX.letterBody, locale)}
        </p>

        {/* Имя фермы */}
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: OT.mustard }}>
          {t(TX.farmNameLabel, locale)}
        </label>
        <input
          data-testid="onboarding-farmname"
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          maxLength={24}
          className="mb-4 w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: OT.paper, color: OT.ink, border: `2px solid ${OT.chrome}` }}
        />

        {/* Пресеты аватара */}
        <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: OT.mustard }}>
          {t(TX.avatarLabel, locale)}
        </div>
        <div className="mb-5 flex gap-2">
          {AVATAR_PRESETS.map((p) => {
            const selected = p.key === avatar
            return (
              <button
                key={p.key}
                type="button"
                data-testid={`onboarding-avatar-${p.key}`}
                aria-pressed={selected}
                onClick={() => setAvatar(p.key)}
                title={t(p.label, locale)}
                className="flex flex-col items-center gap-1 rounded-lg p-1.5"
                style={{
                  border: `2px solid ${selected ? OT.cherry : 'transparent'}`,
                  background: selected ? OT.paper : 'transparent',
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 34, height: 34, background: p.color, border: `2px solid ${OT.card}` }}
                />
                <span className="text-[10px]" style={{ color: OT.inkSoft }}>
                  {t(p.label, locale)}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          data-testid="onboarding-begin"
          onClick={startMiniWeek}
          className="w-full rounded-full py-2.5 text-sm font-black uppercase tracking-wide"
          style={{ background: OT.cherry, color: OT.card, boxShadow: PRINT_SHADOW }}
        >
          {t(TX.begin, locale)}
        </button>

        {canSkip && (
          <button
            type="button"
            data-testid="onboarding-skip"
            onClick={skip}
            className="mt-3 w-full text-center text-xs font-semibold underline"
            style={{ color: OT.inkSoft }}
          >
            {t(TX.skip, locale)}
          </button>
        )}
      </div>
    </div>
  )
}
