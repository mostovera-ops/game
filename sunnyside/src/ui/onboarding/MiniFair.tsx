/**
 * MiniFair.tsx — финальная мини-ярмарка с NPC-гостями (18-onboarding §2.2/§3.3 t_day_6).
 * Презентационная панель: ряд гостей-заглушек прибывает к прилавку, подсвечена
 * гарантированная первая Синяя лента (§4.2). Подача пирога — кнопка действия в
 * `MiniWeek` (этот компонент только показывает сцену ярмарки).
 */

import type { Locale } from '@/types'
import { MINI_FAIR_GUESTS } from './scenario'
import { NanaPortrait } from './NanaPortrait'
import { NPC_NAME, TX, t } from './text'
import { OT } from './theme'

export interface MiniFairProps {
  locale: Locale
  /** Показать врученную Синюю ленту (после подачи пирога). */
  ribbonAwarded?: boolean
}

export function MiniFair({ locale, ribbonAwarded = false }: MiniFairProps) {
  return (
    <div
      data-testid="onboarding-minifair"
      className="mb-3 rounded-xl p-3"
      style={{ background: OT.paper, border: `2px solid ${OT.chrome}` }}
    >
      <div className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: OT.mustard }}>
        {t(TX.miniFairGuests, locale)}
      </div>
      <div className="flex flex-wrap gap-3">
        {MINI_FAIR_GUESTS.map((npc) => (
          <div key={npc} className="flex flex-col items-center gap-1" style={{ width: 56 }}>
            <NanaPortrait npc={npc} locale={locale} size={44} />
            <span className="truncate text-[10px]" style={{ color: OT.inkSoft, maxWidth: 56 }}>
              {t(NPC_NAME[npc], locale)}
            </span>
          </div>
        ))}
      </div>

      {ribbonAwarded && (
        <div
          data-testid="onboarding-blue-ribbon"
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black"
          style={{ background: OT.ribbon, color: OT.card }}
        >
          <span aria-hidden>🎀</span>
          {t(TX.blueRibbon, locale)}
        </div>
      )}
    </div>
  )
}
