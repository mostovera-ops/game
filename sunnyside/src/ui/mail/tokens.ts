/**
 * ui/mail/tokens.ts — визуальные токены Каталога почтой (стиль «бумажный каталог
 * 1950-х», 08-mail-foraging §3.1/§3.1.7, палитра дайнер-меню 19-ui-ux §4.5). Собственная
 * копия значений §4.5 (как `ui/shop/tokens.ts`/`ui/market/tokens.ts`) — не правим общий
 * `index.css`/tailwind (AGENTS.md §2/§6), это не рассинхрон, а избежание чужого файла.
 */

export const MAIL = {
  paper: '#F5EDDD',
  card: '#FCF6E8',
  board: '#1F2B37',
  cherry: '#C63F33',
  teal: '#0B9077',
  mustard: '#D89A2B',
  chrome: '#B9C4CC',
  ink: '#2B2118',
  inkMuted: '#8A8070',
} as const

/** Печатная тень «сдвинутый прямоугольник» (§4.5). */
export const PRINT_SHADOW = '4px 4px 0 rgba(0,0,0,.18)'

/** Цветовые бирки категорий (§3.1.7): зелёная — Rare Seeds, коричневая — Decor, серая — Tools. */
export const CATEGORY_COLOR = {
  rare_seeds: MAIL.teal,
  decor: '#9A6A3A',
  tools: '#7C8A94',
} as const
