/**
 * engine/collections/postcards.ts — сеты открыток "Greetings from…" → баффы
 * (17-collections.md §2.3/§3.3). ЧИСТАЯ логика: определяет, собран ли сет, и
 * какой бафф он даёт по каталогу; НЕ применяет бафф к скорости/выходу экспедиций
 * (та математика — `07-expeditions.md`, см. `engine/contracts.ts` ExpeditionSystem —
 * этот модуль только источник «сет X собран → бафф Y», потребитель — экспедиции).
 *
 * Открытки нельзя купить (17-collections §3.3) — владение приходит только из
 * `CollectionsSnapshot.postcards` (сервер), этот модуль не мутирует владение.
 *
 * ВАЖНО (данные): каталог `@/data/catalogs/postcards.ts` на момент написания
 * содержит только 8 постоянных открыток штатов волны 1 — сезонная ротационная
 * открытка родного округа (второй член «Home Region», 17-collections §3.3
 * таблица) и ивентовые открытки (`ev_harvest_homecoming`/`ev_drivein_night`,
 * §3.3 текст, `10-server-event.md`) в каталоге пока не заведены (нет
 * согласованного источника контента — AGENTS.md §0.7, не выдумываем ключи).
 * Поэтому набор `postcards_home_region` ниже указывает единственный
 * подтверждённый членский ключ (`postcard_home`); когда сезонная открытка
 * появится в каталоге — добавить её сюда одной строкой (см. TODO ниже).
 */

import { postcards } from '@/data/catalogs/postcards'
import type { PostcardDef } from '@/data/schema'

export type PostcardSetKey =
  | 'postcards_home_region'
  | 'postcards_heartland'
  | 'postcards_deep_south'
  | 'postcards_coast_to_coast'
  | 'postcards_full_album'

/** Бафф сета — описательные данные (валидатор потребителя — экспедиции/14-economy, см. докстринг файла). */
export type PostcardSetBuff =
  | { kind: 'expedition_truck_speed_pct'; tiers: readonly (1 | 2)[]; valuePct: number }
  | { kind: 'expedition_time_pct'; stateKeys: readonly string[]; valuePct: number }
  | { kind: 'expedition_highlight_yield_pct'; stateKeys: readonly string[]; valuePct: number }
  | { kind: 'expedition_extra_route_slot'; slots: number }
  | { kind: 'profile_frame_and_bonus'; frameKey: string; ticketsBonus: number }

export interface PostcardSetDef {
  key: PostcardSetKey
  /** Ключи открыток каталога (`postcard_*`), которые нужно собрать (§3.3 таблица). */
  members: readonly string[]
  buff: PostcardSetBuff
}

const stateCard = (stateKey: string): string => {
  const def = postcards.find((p: PostcardDef) => p.stateKey === stateKey)
  if (!def) throw new Error(`postcards.ts: нет открытки каталога для stateKey «${stateKey}»`)
  return def.key
}

/** 17-collections.md §3.3 — 5 сетов. Числа баффов — гипотеза спеки, финал в 07-expeditions/14-economy. */
export const POSTCARD_SETS: readonly PostcardSetDef[] = [
  {
    key: 'postcards_home_region',
    // TODO: добавить сезонную открытку родного округа вторым членом, когда появится в каталоге.
    members: [stateCard('st_home')],
    buff: { kind: 'expedition_truck_speed_pct', tiers: [1, 2], valuePct: 5 },
  },
  {
    key: 'postcards_heartland',
    members: [stateCard('st_illinois'), stateCard('st_tennessee')],
    buff: { kind: 'expedition_time_pct', stateKeys: ['st_illinois', 'st_tennessee'], valuePct: -10 },
  },
  {
    key: 'postcards_deep_south',
    members: [stateCard('st_georgia'), stateCard('st_louisiana'), stateCard('st_texas')],
    buff: {
      kind: 'expedition_highlight_yield_pct',
      stateKeys: ['st_georgia', 'st_louisiana', 'st_texas'],
      valuePct: 10,
    },
  },
  {
    key: 'postcards_coast_to_coast',
    members: [stateCard('st_maine'), stateCard('st_california')],
    buff: { kind: 'expedition_extra_route_slot', slots: 1 },
  },
  {
    key: 'postcards_full_album',
    members: postcards.map((p) => p.key),
    buff: { kind: 'profile_frame_and_bonus', frameKey: 'well_traveled', ticketsBonus: 50 },
  },
] as const

/** Собран ли сет (все члены во владении). Пустой `members` никогда не считается собранным. */
export function isPostcardSetComplete(owned: ReadonlySet<string>, set: PostcardSetDef): boolean {
  return set.members.length > 0 && set.members.every((key) => owned.has(key))
}

export interface PostcardSetProgress {
  set: PostcardSetDef
  have: number
  total: number
  complete: boolean
}

export function postcardSetProgress(owned: ReadonlySet<string>, set: PostcardSetDef): PostcardSetProgress {
  const have = set.members.filter((key) => owned.has(key)).length
  return { set, have, total: set.members.length, complete: have === set.members.length }
}

/** Все сеты, собранные данным набором владения (для UI/экспедиций). */
export function completedPostcardSets(owned: ReadonlySet<string>): PostcardSetDef[] {
  return POSTCARD_SETS.filter((set) => isPostcardSetComplete(owned, set))
}

/** Сводка прогресса по всем сетам (Postcards album UI, §5 `ui_postcards`). */
export function allPostcardSetProgress(owned: ReadonlySet<string>): PostcardSetProgress[] {
  return POSTCARD_SETS.map((set) => postcardSetProgress(owned, set))
}
