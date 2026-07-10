/**
 * npc.ts — именованные NPC (canon §3.1). 10 персонажей волны 1.
 */

export type NpcKey =
  | 'npc_grimsby' // гастрокритик-обжора, «босс» ивента
  | 'npc_nana_opal' // хранительница рецептов, Recipe Box туториал
  | 'npc_postman_pete' // доставка каталога/почты
  | 'npc_mayor_calloway' // town projects, объявления, переезды
  | 'npc_whittaker' // туториал «мини-неделя», менторство
  | 'npc_maybelle' // главный судья ярмарки
  | 'npc_ricky_ray' // радио WSUN, анонсы Demand Board
  | 'npc_trucker_cody' // гид экспедиций, открывает штаты
  | 'npc_sheriff_roy' // Daily Specials
  | 'npc_winnie' // универмаг/каталог, редкие семена

export const NPC_KEYS: readonly NpcKey[] = [
  'npc_grimsby',
  'npc_nana_opal',
  'npc_postman_pete',
  'npc_mayor_calloway',
  'npc_whittaker',
  'npc_maybelle',
  'npc_ricky_ray',
  'npc_trucker_cody',
  'npc_sheriff_roy',
  'npc_winnie',
] as const
