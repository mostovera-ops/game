/**
 * ui/expeditions/tokens.ts — токены визуального стиля «дайнер-меню» (19-ui-ux §4.5) как
 * значения TS. Своя копия для зоны ui-expeditions (не импортируем `ui/collections/tokens.ts`
 * или `ui/kitchen/tokens.ts` — те в зонах других агентов, AGENTS.md §2/§6; значения
 * идентичны источнику спеки §4.5, расхождение здесь означало бы баг ревью, не «два стиля»).
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
  ink: '#2B2118',
  inkMuted: '#8A8070',
} as const

/** Печатная тень «сдвинутый прямоугольник» вместо мягкого стекла (§4.5). */
export const PRINT_SHADOW = '4px 4px 0 rgba(0,0,0,.18)'
