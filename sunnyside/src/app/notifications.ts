/**
 * app/notifications.ts — мост «события бэкенда → лента уведомлений» (S4, 19-ui-ux §3.1).
 *
 * ДВА ИСТОЧНИКА (интегратор C3), ОБА активны и для local, и для supabase:
 *   1) Realtime-каналы адаптера (`subscribe`) — единый контракт `BackendAdapter.subscribe`
 *      (engine/contracts.ts). `LocalBackendAdapter` (net/adapters/local.ts) эмитит РЕАЛЬНЫЕ
 *      события по своим тикам (внутри `sync`, на каждое чтение снапшота): почта доставлена,
 *      грузовик вернулся, сосед полил грядки, началась ярмарка, кооп-заказ выполнен.
 *      `SupabaseBackendAdapter` подключит тот же канал к Postgres CDC/broadcast (20-backend
 *      §3.5) — `subscribeNotifications` ниже не знает, какая реализация активна.
 *   2) Диф снапшотов после гидрации (`diffWorld`) — ЧИСТАЯ функция: сравнивает прошлый
 *      и новый срез мира (неделя/вехи ивента/вымпел) и выдаёт `NotificationItem[]`.
 *
 * ГРАНИЦА: композиция (`src/app/**`). Чистый диф (`diffWorld`/`worldSummary`) node-тестируем.
 */

import { useStore } from '@/state'
import type { BackendAdapter, Unsubscribe } from '@/engine/contracts'
import type { NotificationItem, ServerCalendar, EventSnapshot, RealtimeChannelKind } from '@/types'

/** Минимальный «уведомляемый» срез мира — то, чьё изменение стоит показать в колоколе. */
export interface WorldSummary {
  weekIndex: number
  /** Проценты уже пробитых вех котла ивента (25/50/75/100). */
  milestonesHit: number[]
  streetPennant: boolean
}

/** Снять срез из снапшотов календаря/ивента (null — если ещё не гидрированы). */
export function worldSummary(
  calendar: ServerCalendar | null,
  event: EventSnapshot | null,
): WorldSummary | null {
  if (!calendar || !event) return null
  return {
    weekIndex: calendar.weekIndex,
    milestonesHit: event.meter.milestones.filter((m) => m.hit).map((m) => m.pct),
    streetPennant: event.streetPennant ?? false,
  }
}

/**
 * Чистый диф двух срезов → уведомления (тёплый тон, canon §1.2). `now` — метка serverNow.
 * Первый вызов (prev=null) молчит: это первичная гидрация, а не «событие».
 */
export function diffWorld(
  prev: WorldSummary | null,
  next: WorldSummary,
  now: number,
): NotificationItem[] {
  if (!prev) return []
  const out: NotificationItem[] = []

  if (next.weekIndex > prev.weekIndex) {
    out.push({
      id: `notif-week-${next.weekIndex}`,
      kind: 'server',
      message: `Новая неделя началась — свежая доска спроса и ивент! (нед. ${next.weekIndex})`,
      createdAt: now,
    })
  }

  for (const pct of next.milestonesHit) {
    if (!prev.milestonesHit.includes(pct)) {
      out.push({
        id: `notif-milestone-${next.weekIndex}-${pct}`,
        kind: 'server',
        message: `Котёл Гримсби заполнен на ${pct}% — веха взята!`,
        createdAt: now,
      })
    }
  }

  if (next.streetPennant && !prev.streetPennant) {
    out.push({
      id: `notif-pennant-${next.weekIndex}`,
      kind: 'social',
      message: 'Ваш стрит поднял вымпел на площади — так держать!',
      createdAt: now,
    })
  }

  return out
}

// ── Состояние моста (модуль-синглтон): последний известный срез ──
let lastSummary: WorldSummary | null = null

/**
 * Вызывается после каждой гидрации: считает диф от прошлого среза и пушит уведомления.
 * Идемпотентно по id (`pushNotification` кэпит ленту; повтор id безвреден для UX).
 */
export function noteHydration(): void {
  const s = useStore.getState()
  const next = worldSummary(s.clock.calendar, s.event)
  if (!next) return
  const items = diffWorld(lastSummary, next, s.serverNow())
  for (const item of items) s.pushNotification(item)
  lastSummary = next
}

/** Сброс среза (тесты / повторный бутстрап). */
export function resetNotificationBridge(): void {
  lastSummary = null
}

/** Каналы, чьи рассылки превращаем в уведомления (local эмитит реально; supabase — форвард). */
const WATCHED_CHANNELS: RealtimeChannelKind[] = ['event', 'projects', 'fair', 'street_board', 'inbox']

/**
 * Подписка на Realtime-каналы адаптера. Для local это реальные события с собственных
 * тиков (`net/adapters/local.ts` `emitDomainEvents`/`sync`); для supabase — тот же
 * контракт поверх Postgres CDC/broadcast (20-backend §3.5). Вызывается один раз на
 * бутстрапе (`app/backend.ts`). Возвращает функцию отписки от всех каналов разом.
 */
export function subscribeNotifications(adapter: BackendAdapter): Unsubscribe {
  const unsubs: Unsubscribe[] = WATCHED_CHANNELS.map((ch) =>
    adapter.subscribe(ch, (payload) => {
      const item = payloadToNotification(ch, payload, useStore.getState().serverNow())
      if (item) useStore.getState().pushNotification(item)
    }),
  )
  return () => unsubs.forEach((u) => u())
}

/** Монотонный счётчик — гарантирует уникальный id, даже если несколько событий пришли за 1мс. */
let payloadSeq = 0

/** Мап сырого Realtime-payload в уведомление (best-effort; неизвестное — тихо игнор). */
function payloadToNotification(
  channel: RealtimeChannelKind,
  payload: unknown,
  now: number,
): NotificationItem | null {
  const msg =
    payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message: unknown }).message)
      : null
  if (!msg) return null
  payloadSeq += 1
  return {
    id: `notif-${channel}-${now}-${payloadSeq}`,
    kind: channel === 'street_board' || channel === 'inbox' ? 'social' : 'server',
    message: msg,
    createdAt: now,
  }
}
