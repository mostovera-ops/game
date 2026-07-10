/**
 * ui/collections/tokens.ts — токены визуального стиля «дайнер-меню» (docs/specs/19-ui-ux.md
 * §4.5) как обычные значения TS. Своя копия для зоны ui-collections (не импортируем
 * `ui/kitchen/tokens.ts` — тот файл в зоне другого агента, AGENTS.md §2/§6; значения
 * идентичны источнику спеки §4.5, расхождение здесь означало бы баг ревью, не «два стиля»).
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

/** Неоновые цвета (базовые cherry/teal бесплатны, премиум — gold/purple/ice-blue, §3.7). */
export const NEON_COLORS: Readonly<Record<string, { hex: string; free: boolean }>> = {
  cherry_red: { hex: '#FF3B5C', free: true },
  teal: { hex: '#2FE6C8', free: true },
  gold: { hex: '#FFD24C', free: false },
  purple: { hex: '#C86BFF', free: false },
  ice_blue: { hex: '#7FE0FF', free: false },
}
