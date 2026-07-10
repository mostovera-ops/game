/**
 * layout.ts — чистая раскладка Town Map (11-town §3.1/§3.2/§3.8): позиции ярмарочного
 * круга (Town Projects), лучей стритов с фермами соседей и точек фуражинга обочины.
 *
 * ЗАЧЕМ отдельным файлом: вся геометрическая математика вынесена из TownScene.tsx в
 * чистые функции — ноль three/react, node-тестируемо vitest'ом без Canvas/WebGL
 * (которого нет в jsdom). TownScene.tsx только вызывает эти функции и рендерит.
 *
 * ГРАНИЦА (AGENTS.md §3): scene/ может импортировать @/types и @/engine (контракты +
 * чистые формулы), НЕ импортирует @/net. `seededRng`/`hashString` — чистый ГПСЧ
 * (engine/econ/rng.ts), детерминированная раскладка форажинга без обращения к сети.
 */

import { hashString, seededRng } from '@/engine/econ/rng'
import { TOWN_PROJECT_KEYS } from '@/types'
import type { ForageKind, Street, TownProject, TownProjectKey } from '@/types'
import { FORAGE_KINDS as FORAGE_POINT_KINDS, INSTANCES_PER_TOWN } from '@/engine/mail-foraging/constants'

export type Vec3 = [number, number, number]

// ── Ярмарочный круг: Town Projects (canon §3.7, 11-town §3.8) ───────────────────────

/** Радиус кольца, на котором расставлены 6 town-project'ов вокруг площади. */
export const FAIRGROUND_RADIUS = 6

/** Позиция i-го объекта из `total`, равномерно по кольцу радиуса `radius`. */
export function ringPosition(index: number, total: number, radius: number): Vec3 {
  const angle = total > 0 ? (index / total) * Math.PI * 2 : 0
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
}

/** Позиция i-го town-project'а на ярмарочном кольце (canon §3.7 — 6 объектов). */
export function projectRingPosition(index: number): Vec3 {
  return ringPosition(index, TOWN_PROJECT_KEYS.length, FAIRGROUND_RADIUS)
}

/**
 * Визуальная стадия стройки объекта (11-town §3.8.1: леса → каркас → готово).
 * Нет записи в `projects` (проект ещё не разблокирован/не начат) → стадия 1 (леса,
 * минимальный масштаб). `built` → стадия 3 (готовый неон-объект). Иначе — по доле
 * прогресса от цели (двухтредный порог середины).
 */
export function projectStage(project: TownProject | undefined): 1 | 2 | 3 {
  if (project?.built) return 3
  const frac = project && project.goal > 0 ? project.progress / project.goal : 0
  return frac >= 0.5 ? 2 : 1
}

/** Масштаб примитива-стройплощадки по стадии (леса меньше, каркас — крупнее). */
export function constructionScale(stage: 1 | 2 | 3): number {
  return stage === 1 ? 0.5 : stage === 2 ? 0.8 : 1
}

// ── Стриты: лучи от площади с фермами соседей (11-town §3.1/§3.2) ───────────────────

/** Внутренний радиус, с которого начинается луч стрита (сразу за ярмарочным кольцом). */
export const STREET_INNER_RADIUS = FAIRGROUND_RADIUS + 3
/** Шаг между соседними фермами вдоль луча стрита. */
export const STREET_FARM_SPACING = 2.4
/** Боковое смещение ферм от оси луча (дома по обе стороны улицы). */
export const STREET_LATERAL_OFFSET = 1.2

/** Угол луча i-го стрита из `total`; сдвиг на половину шага, чтобы не совпадать с проектами. */
export function streetAngle(streetIndex: number, total: number): number {
  const step = total > 0 ? (Math.PI * 2) / total : 0
  return streetIndex * step + step / 2
}

/** Позиция таблички с именем улицы — у начала луча. */
export function streetSignPosition(streetIndex: number, total: number): Vec3 {
  const angle = streetAngle(streetIndex, total)
  const r = STREET_INNER_RADIUS - 1.5
  return [Math.cos(angle) * r, 0, Math.sin(angle) * r]
}

/**
 * Позиция `farmIndex`-й фермы на луче стрита `streetIndex` (дома чередуются по обе
 * стороны улицы — чётные левее оси, нечётные правее).
 */
export function farmPosition(streetIndex: number, totalStreets: number, farmIndex: number): Vec3 {
  const angle = streetAngle(streetIndex, totalStreets)
  const r = STREET_INNER_RADIUS + farmIndex * STREET_FARM_SPACING
  const perpAngle = angle + Math.PI / 2
  const lateral = (farmIndex % 2 === 0 ? 1 : -1) * STREET_LATERAL_OFFSET
  const x = Math.cos(angle) * r + Math.cos(perpAngle) * lateral
  const z = Math.sin(angle) * r + Math.sin(perpAngle) * lateral
  return [x, 0, z]
}

/** Минимальный ростер-элемент, нужный раскладке (см. `TownSnapshot['roster'][number]`). */
export interface RosterEntry {
  userId: string
  farmId: string
  displayName: string
  streetId: string
}

/** Стриты в стабильном порядке рендера (по `id`, не зависит от порядка снапшота). */
export function orderedStreets(streets: readonly Street[]): Street[] {
  return [...streets].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// ── Точки фуражинга обочины (08-mail-foraging §3.2, 11-town §3.1 Roadside) ──────────

/** Внешнее кольцо обочины (Route 66) — за фермами стритов. */
export const ROADSIDE_RADIUS = STREET_INNER_RADIUS + 9

/** Ассет-заглушка сцены по виду точки фуражинга (реюз существующих env/crop/bld-ключей). */
export const FORAGE_ASSET_BY_KIND: Record<ForageKind, string> = {
  mushroom: 'env_bush',
  berry: 'crop_tomato',
  herb: 'crop_greens',
  flower: 'crop_carrot',
  // Заглушки для канон-типов (08 §3.2): дикий мёд → улей-пасека, рыбалка → лужа-вода.
  wild_beehive: 'bld_apiary',
  fishing: 'env_puddle',
}

export interface ForageLayoutPoint {
  id: string
  kind: ForageKind
  position: Vec3
}

// BL-1 (fishing-qte): `fishing` в ротации раскладки — обочина рисует Fishing Spot
// (лужа-заглушка `env_puddle`), клик по которому в `TownScene` открывает `FishingQte`
// (Catch Bar), а не обычный однократный сбор `forageCollect` (см. `TownScene.tsx`
// `handleForageCollect` — там же комментарий про ветвление по `kind`).
//
// BL-4 (foraging-world): вид точки i — НЕ равновероятный случайный пик по 5 видам, а
// фиксированный спека-микс §3.2.6 (`FORAGE_POINT_MIX` ниже) — 6 Mushroom Patch / 10
// Berry Bush / 4 Wild Beehive / 3 Fishing Spot, тот же состав/порядок, что и
// `starterForage` (net/local/world.ts, adapter-seams) — иначе клик по точке i из
// дефолтной раскладки не резолвил бы ту же точку сервера. `herb`/`flower` — легаси
// виды вне канон-4 типов 08-mail-foraging §3.2.1, в спека-микс не входят.
const FORAGE_POINT_MIX: readonly ForageKind[] = FORAGE_POINT_KINDS.flatMap((kind) =>
  Array.from({ length: INSTANCES_PER_TOWN[kind] }, () => kind as ForageKind),
)

/** Суммарное число точек спека-микса на Город (23) — дефолт `layoutForagePoints`. */
export const DEFAULT_FORAGE_POINT_COUNT = FORAGE_POINT_MIX.length

/**
 * Детерминированная раскладка `count` точек фуражинга по кольцу обочины, seed'ed от
 * `townId` (тот же город → та же раскладка между рендерами/загрузками — 08-mail-foraging
 * "точки обновляются ежедневно" покрывает СОСТАВ пула на сервере, не визуальные позиции).
 * Вид (`kind`) точки i — фиксированный по спека-миксу (`FORAGE_POINT_MIX[i % ...]`), НЕ
 * случайный: у каждого Города один и тот же состав 6/10/4/3 (§3.2.6). Позиция на кольце —
 * единственное, что зависит от rng.
 *
 * TODO(mail-foraging-owner + net-bootstrap): реальный пул точек — `MailForagingSnapshot.
 * foragePoints` через `adapter.getMailForaging()` (engine/contracts.ts `MailForagingSystem`).
 * Ни системы, ни net-bootstrap гидрации для этого пока нет (main.tsx TODO) — сцена не может
 * дёрнуть `@/net` напрямую (граница). До готовности système — рисуем детерминированный
 * плейсхолдер-набор той же формы (`id/kind/position`), чтобы точка карты не пустовала и
 * клик-взаимодействие было демонстрируемо; см. TownScene.tsx для реального wiring-шва.
 */
export function layoutForagePoints(seedKey: string, count = DEFAULT_FORAGE_POINT_COUNT): ForageLayoutPoint[] {
  const rng = seededRng(hashString(`forage:${seedKey}`))
  const out: ForageLayoutPoint[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.uniform(-0.2, 0.2)
    const r = ROADSIDE_RADIUS + rng.uniform(-1.5, 1.5)
    const kind = FORAGE_POINT_MIX[i % FORAGE_POINT_MIX.length] ?? 'mushroom'
    out.push({
      id: `forage-${seedKey}-${i}`,
      kind,
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
    })
  }
  return out
}

/** Ключи проектов в стабильном порядке отрисовки кольца (canon §3.7 — фиксированный реестр). */
export const PROJECT_RING_ORDER: readonly TownProjectKey[] = TOWN_PROJECT_KEYS
