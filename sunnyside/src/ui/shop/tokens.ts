/**
 * ui/shop/tokens.ts — токены визуального стиля «дайнер-меню» (docs/specs/19-ui-ux.md
 * §4.5) как обычные значения TS. Дублирует `ui/market/tokens.ts` (см. докстринг там —
 * `index.css`/tailwind-конфиг общие, правка требует согласования, AGENTS.md §2/§6);
 * каждая зона держит свою копию значений §4.5, это НЕ рассинхрон (значения дословно
 * из canon-палитры §4.5 Light/Dark), а избежание правки чужого файла.
 */

export const DINER = {
  paper: '#F5EDDD',
  card: '#FCF6E8',
  board: '#1F2B37',
  boardInk: '#F2E9D8',
  cherry: '#C63F33',
  teal: '#0B9077',
  mustard: '#D89A2B',
  chrome: '#B9C4CC',
  /** Основной цвет текста на светлой карточке (фикс UI-7 — был хардкод `#2b2118`). */
  ink: '#2B2118',
  /** Приглушённый/disabled-текст на светлой карточке (был хардкод `#8a8070`). */
  inkMuted: '#8A8070',
} as const

/** Печатная тень «сдвинутый прямоугольник» вместо мягкого стекла (§4.5). */
export const PRINT_SHADOW = '4px 4px 0 rgba(0,0,0,.18)'

/** Редкость Prize Machine → акцентный цвет (canon §4 «открытый pity», 15-monetization §3.3.2). */
export const RARITY_COLOR = {
  common: '#8A9AA5',
  uncommon: DINER.teal,
  rare: DINER.mustard,
  chase: DINER.cherry,
} as const
