/**
 * ui/kitchen/tokens.ts — токены визуального стиля «дайнер-меню» (docs/specs/19-ui-ux.md
 * §4.5) как обычные значения TS, а не Tailwind-тема: `src/index.css`/tailwind-конфиг —
 * общие файлы (не в зоне ui-kitchen-inventory), правка требует согласования (AGENTS.md
 * §2/§6). Используется этим модулем (kitchen) и соседним `ui/inventory/` — оба в зоне
 * одного агента (см. задание «ui-kitchen-inventory»).
 *
 * Light-значения из спеки; dark — где отличается (см. таблицу §4.5).
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
