/**
 * NanaPortrait.tsx — портрет-заглушка NPC для диалогов FTUE (18-onboarding §5).
 *
 * ПОЧЕМУ DOM-ЗАГЛУШКА: диалоги — 2D-оверлей в нижней трети (§5), портрет тут — DOM,
 * а не 3D-меш. До финальных ассетов (22-audio-visual) рисуем процедурный медальон:
 * цветной кружок канон-палитры + инициалы NPC. Замена на финальный портрет —
 * подмена этого одного компонента, без правок вызывающих экранов (тот же приём
 * изоляции, что реестр 3D-заглушек в `scene/assets/`).
 */

import type { Locale, NpcKey } from '@/types'
import { OT } from './theme'
import { NPC_NAME, t } from './text'

/** Плоский цвет-заглушка на NPC (канон-палитра §4). */
const NPC_COLOR: Record<NpcKey, string> = {
  npc_nana_opal: OT.mustard,
  npc_whittaker: OT.teal,
  npc_trucker_cody: OT.ribbon,
  npc_mayor_calloway: OT.cherry,
  npc_ricky_ray: OT.neon,
  npc_maybelle: '#b06fa8',
  npc_grimsby: '#5a6b78',
  npc_postman_pete: '#3f6fd0',
  npc_sheriff_roy: '#8a6d3b',
  npc_winnie: '#0b9077',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export interface NanaPortraitProps {
  npc: NpcKey
  locale: Locale
  size?: number
}

export function NanaPortrait({ npc, locale, size = 64 }: NanaPortraitProps) {
  const name = t(NPC_NAME[npc], locale)
  return (
    <div
      data-testid={`onboarding-portrait-${npc}`}
      data-placeholder="npc-portrait"
      aria-label={name}
      role="img"
      className="flex shrink-0 select-none items-center justify-center rounded-full font-black"
      style={{
        width: size,
        height: size,
        background: NPC_COLOR[npc],
        color: OT.card,
        border: `3px solid ${OT.card}`,
        boxShadow: `0 0 0 2px ${OT.board}`,
        fontSize: size * 0.34,
        fontFamily: "'Futura','Avenir Next',system-ui,sans-serif",
      }}
    >
      {initials(name)}
    </div>
  )
}
