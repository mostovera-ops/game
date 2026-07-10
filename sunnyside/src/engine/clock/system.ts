/**
 * engine/clock/system.ts — фабрика ClockSystem (реализация контракта `@/engine`).
 *
 * ClockSystem — ЕДИНСТВЕННЫЙ источник игрового времени (AGENTS.md §0.4, 21-client
 * §3.6): `serverNow() = Date.now() + serverOffset`. Никакая игровая логика не зовёт
 * `Date.now()` напрямую. Таймер «истёк» (`isReady`) НИКОГДА не начисляет — только
 * отвечает «готово?»; забор — отдельная подтверждаемая мутация (AGENTS.md §0.4).
 *
 * Синхронизация (§3.3): N сэмплов `get_server_time`, offset = МЕДИАНА по сэмплам с
 * поправкой на RTT/2. До первого успешного sync `isReady` заблокирован (C4): пока
 * часы не выверены, мир не считает таймеры готовыми.
 *
 * ГРАНИЦА: импортирует контракты `@/engine` + типы `@/types`. Ноль three/react/сети
 * напрямую — общение с бэкендом только через инжектированный adapter.
 */

import type { EpochMs, RpcResult } from '@/types'
import type { ClockSystem } from '@/engine/contracts'
import { CLOCK_SAMPLE_COUNT } from './constants'

/** Один замер: локальные метки вокруг ответа сервера (§3.3). */
export interface OffsetSample {
  localBefore: EpochMs
  serverNow: EpochMs
  localAfter: EpochMs
}

/**
 * Медиана serverOffset по сэмплам (§3.3). Для каждого сэмпла offset считается
 * относительно СЕРЕДИНЫ окна запроса (поправка на RTT/2), затем берётся медиана —
 * устойчива к разовым сетевым выбросам. Чистая функция (тестируется отдельно).
 */
export function computeOffset(samples: readonly OffsetSample[]): number {
  const offsets = samples
    .map((s) => {
      const rtt = s.localAfter - s.localBefore
      const localMid = s.localBefore + rtt / 2
      return s.serverNow - localMid
    })
    .sort((a, b) => a - b)
  const n = offsets.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  const hi = offsets[mid] ?? 0
  if (n % 2 === 1) return hi
  const lo = offsets[mid - 1] ?? hi
  return (lo + hi) / 2
}

/** Минимальная зависимость: только замер серверного времени (§3.3). */
export interface ClockAdapter {
  getServerTime(): Promise<RpcResult<{ serverNow: EpochMs }>>
}

export interface ClockDeps {
  adapter: ClockAdapter
  /** Инжектируемые локальные часы (для тестов); по умолчанию `Date.now`. */
  now?: () => EpochMs
  /** Число сэмплов get_server_time (по умолчанию канон §3.6 = 3). */
  samples?: number
}

/**
 * Фабрика ClockSystem. Держит собственное состояние offset/synced в замыкании —
 * без React/стора (граница). Слайс `clock` (state/) оборачивает её при бутстрапе.
 */
export function createClockSystem(deps: ClockDeps): ClockSystem {
  const now = deps.now ?? Date.now
  const sampleCount = Math.max(1, deps.samples ?? CLOCK_SAMPLE_COUNT)
  let offset = 0
  let synced = false

  return {
    async sync(): Promise<void> {
      const samples: OffsetSample[] = []
      for (let i = 0; i < sampleCount; i++) {
        const localBefore = now()
        const res = await deps.adapter.getServerTime()
        const localAfter = now()
        if (res.ok) {
          samples.push({ localBefore, serverNow: res.data.serverNow, localAfter })
        }
      }
      if (samples.length > 0) {
        offset = computeOffset(samples)
        synced = true
      }
    },

    serverNow(): EpochMs {
      return now() + offset
    },

    isReady(readyAt: EpochMs): boolean {
      // C4: до успешной синхронизации готовность заблокирована.
      return synced && now() + offset >= readyAt
    },

    remainingMs(readyAt: EpochMs): number {
      // Может быть отрицательным до забора — это норма (contracts.ts).
      return readyAt - (now() + offset)
    },
  }
}
