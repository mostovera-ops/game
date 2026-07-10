/**
 * catalogs/postcards.ts — контент-каталог открыток `mech_greetings_postcard`
 * (07-expeditions §3.7, 17-collections §3.5).
 *
 * 1 открытка на штат волны 1 (только зафиксированные каноном 8 стопов —
 * см. `catalogs/states.ts` для обоснования). Ивентовые открытки (`eventKey`)
 * — вне скоупа этого каталога (10-server-event.md, ожидаемая), не добавляются
 * здесь без источника контента событий.
 *
 * Ключ — `postcard_<stateKey без st_>` (напр. `postcard_illinois`), согласно
 * regex `PostcardDefSchema` (`^postcard_[a-z0-9_]+$`).
 */

import type { PostcardDef } from '../schema'

export const postcards: PostcardDef[] = [
  {
    key: 'postcard_home',
    name: { en: 'Greetings from Home County', ru: 'Привет из родного округа' },
    stateKey: 'st_home',
  },
  {
    key: 'postcard_illinois',
    name: { en: 'Greetings from Illinois', ru: 'Приветствие из Иллинойса' },
    stateKey: 'st_illinois',
  },
  {
    key: 'postcard_tennessee',
    name: { en: 'Greetings from Tennessee', ru: 'Приветствие из Теннесси' },
    stateKey: 'st_tennessee',
  },
  {
    key: 'postcard_georgia',
    name: { en: 'Greetings from Georgia', ru: 'Приветствие из Джорджии' },
    stateKey: 'st_georgia',
  },
  {
    key: 'postcard_louisiana',
    name: { en: 'Greetings from Louisiana', ru: 'Приветствие из Луизианы' },
    stateKey: 'st_louisiana',
  },
  {
    key: 'postcard_texas',
    name: { en: 'Greetings from Texas', ru: 'Приветствие из Техаса' },
    stateKey: 'st_texas',
  },
  {
    key: 'postcard_maine',
    name: { en: 'Greetings from Maine', ru: 'Приветствие из Мэна' },
    stateKey: 'st_maine',
  },
  {
    key: 'postcard_california',
    name: { en: 'Greetings from California', ru: 'Приветствие из Калифорнии' },
    stateKey: 'st_california',
  },
]
