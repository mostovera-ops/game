/**
 * ui/onboarding/theme.ts — токены дайнер-языка для FTUE (19-ui-ux §4 палитра-канон).
 *
 * DOM-слой (не 3D-материалы): hex канон-палитры зеркалим здесь как TS-константы —
 * тот же приём, что `ui/shift/theme.ts` и `ui/market/tokens.ts`. Модуль onboarding
 * рисуется ПОВЕРХ любой сцены и иногда РАНЬШЕ HUD (экран письма до старта игры),
 * поэтому не полагается на глобальные `--var` из `ui/hud/tokens.css` (другая зона),
 * а держит собственные значения. Стиль: кремовая бумага, латунь/хром, вишнёвый
 * акцент, синяя лента, неон вывески (§1/§2 деки).
 */

export const OT = {
  paper: '#f5eddd',
  card: '#fcf6e8',
  board: '#1f2b37',
  boardInk: '#f2e9d8',
  ink: '#2a2420',
  inkSoft: 'rgba(42,36,32,0.65)',
  cherry: '#c63f33',
  teal: '#0b9077',
  mustard: '#d89a2b',
  chrome: '#b9c4cc',
  ribbon: '#3f6fd0',
  neon: '#f9779f',
  good: '#69aa6f',
  shadow: 'rgba(0,0,0,0.28)',
} as const

/** Печатная тень «сдвинутый прямоугольник» вместо мягкого стекла (§4.5). */
export const PRINT_SHADOW = '4px 4px 0 rgba(0,0,0,.28)'

/** Радиус карточек дайнер-языка (§4.5). */
export const DINER_RADIUS = '13px'
