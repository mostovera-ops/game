/**
 * ui/shift/theme.ts — токены дайнер-языка для смены (19-ui-ux §4 палитра-канон).
 *
 * DOM-слой (не 3D-материалы), поэтому hex-значения канон-палитры зеркалим здесь как
 * CSS-токены (те же коды, что public/palette.json) — централизованно, не россыпью по JSX.
 * Стиль: кремовая бумага в точку, латунь/хром, вишнёвый акцент, неон на combo (§1/§2 деки).
 */

export const T = {
  cream: '#f5ecd6',
  paper: '#faf3e0',
  ink: '#2b2620',
  inkSoft: '#6b6152',
  cherry: '#e2523b',
  chrome: '#d9dde1',
  chromeDark: '#9aa2a8',
  neonPink: '#f9779f',
  neonTeal: '#3fd0c9',
  neonYellow: '#f9dd76',
  mustard: '#f9dd76',
  ribbon: '#3f6fd0',
  ticket: '#f2b544',
  good: '#69aa6f',
  shadow: 'rgba(48,48,48,0.35)',
} as const

/** Цвет полосы-таймера по фазе смены (§3.4 warmup/rush/last_call). */
export function phaseColor(phase: 'warmup' | 'rush' | 'last_call'): string {
  if (phase === 'warmup') return T.neonTeal
  if (phase === 'rush') return T.mustard
  return T.cherry
}

/** Цвет колечка терпения гостя по остатку [0..1]. */
export function patienceColor(remaining: number): string {
  if (remaining > 0.5) return T.good
  if (remaining > 0.25) return T.mustard
  return T.cherry
}
