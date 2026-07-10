/**
 * DialogueBox.tsx — реплики NPC в нижней трети экрана (18-onboarding §5 UI-правила):
 * портрет слева, текст справа, кнопки «дальше»/«пропустить реплику». Диалоги
 * пропускаемы, но действие-гейт остаётся у вызывающего шага (§3.9: «учим делом»).
 */

import { useState } from 'react'
import type { Locale } from '@/types'
import type { DialogueLine } from './scenario'
import { NanaPortrait } from './NanaPortrait'
import { NPC_NAME, TX, t } from './text'
import { OT, PRINT_SHADOW, DINER_RADIUS } from './theme'

export interface DialogueBoxProps {
  lines: readonly DialogueLine[]
  locale: Locale
  /** Вызывается, когда проиграна последняя реплика (или нажат «пропустить»). */
  onDone: () => void
}

export function DialogueBox({ lines, locale, onDone }: DialogueBoxProps) {
  const [idx, setIdx] = useState(0)
  const line = lines[idx]
  const isLast = idx >= lines.length - 1

  function next() {
    if (isLast) onDone()
    else setIdx((i) => i + 1)
  }

  if (!line) return null

  return (
    <div
      data-testid="onboarding-dialogue"
      className="pointer-events-auto w-full"
      style={{
        background: OT.card,
        color: OT.ink,
        borderRadius: DINER_RADIUS,
        boxShadow: PRINT_SHADOW,
        border: `2px solid ${OT.chrome}`,
        padding: 16,
      }}
    >
      <div className="flex items-start gap-3">
        <NanaPortrait npc={line.npc} locale={locale} />
        <div className="min-w-0 flex-1">
          <div
            className="mb-1 text-xs font-black uppercase tracking-wide"
            style={{ color: OT.mustard }}
          >
            {t(NPC_NAME[line.npc], locale)}
          </div>
          <p className="text-sm leading-snug" style={{ color: OT.ink }}>
            {t(line.text, locale)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {/* Точки-прогресс реплик. */}
        <div className="flex gap-1" aria-hidden>
          {lines.map((_, i) => (
            <span
              key={i}
              className="inline-block rounded-full"
              style={{
                width: 6,
                height: 6,
                background: i === idx ? OT.cherry : OT.chrome,
              }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {!isLast && (
            <button
              type="button"
              data-testid="onboarding-dialogue-skip"
              onClick={onDone}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ color: OT.inkSoft }}
            >
              {t(TX.skipLine, locale)}
            </button>
          )}
          <button
            type="button"
            data-testid="onboarding-dialogue-next"
            onClick={next}
            className="rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ background: OT.cherry, color: OT.card }}
          >
            {t(isLast ? TX.doStep : TX.next, locale)}
          </button>
        </div>
      </div>
    </div>
  )
}
