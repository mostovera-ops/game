/**
 * ui/market/tokens.ts — токены визуального стиля «дайнер-меню» (docs/specs/19-ui-ux.md
 * §4.5) как обычные значения TS, а не Tailwind-тема: `src/index.css`/tailwind-конфиг —
 * общие файлы (не в зоне ui-market-orders), правка требует согласования (AGENTS.md §2/§6).
 * Используется этим модулем (market) и соседним `ui/orders/` — оба в зоне одного агента
 * (задание «ui-market-orders»). Значения дословно из §4.5 (Light); Dark — где отличается.
 *
 * §4.5: «Letterboard применяется: Demand Board, Machine Queues, Daily Specials,
 * Prize-серии» — Demand Board отсюда явно назначен этому стилю; Fair Stall/Coop
 * Orders/Potluck используют тот же язык (Ticket/Stub-талон для ценников и вкладов).
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
