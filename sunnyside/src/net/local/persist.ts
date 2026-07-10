/**
 * net/local/persist.ts — персист локального мира в IndexedDB (idb), с in-memory
 * фолбэком для сред без `indexedDB` (node/vitest).
 *
 * КОНТРАКТ: `WorldStore` — минимальный key→LocalWorld стор. Одна БД `sunnyside-local`,
 * store `world`, ключ = userId. idb используется только когда `indexedDB` доступен;
 * иначе — Map в памяти (тесты гоняются в environment:'node', там IndexedDB нет).
 *
 * ГРАНИЦА: `net/` может импортировать `idb`, `@/types`, локальные модули.
 */

import type { UUID } from '@/types'
import type { LocalWorld } from './world'
import { WORLD_SCHEMA_VERSION } from './world'

const DB_NAME = 'sunnyside-local'
const DB_VERSION = 1
const STORE = 'world'

export interface WorldStore {
  load(userId: UUID): Promise<LocalWorld | null>
  save(world: LocalWorld): Promise<void>
  clear(userId: UUID): Promise<void>
}

/** Есть ли настоящий IndexedDB (браузер/e2e). В node/vitest — нет. */
function hasIndexedDb(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined'
}

/** In-memory реализация (тесты/SSR): переживает вызовы, но не перезагрузку. */
function createMemoryStore(): WorldStore {
  const mem = new Map<UUID, LocalWorld>()
  return {
    load: (userId) => Promise.resolve(mem.get(userId) ? clone(mem.get(userId)!) : null),
    save: (world) => {
      mem.set(world.userId, clone(world))
      return Promise.resolve()
    },
    clear: (userId) => {
      mem.delete(userId)
      return Promise.resolve()
    },
  }
}

/** idb-реализация: динамический импорт, чтобы node-тесты не тянули idb в память. */
function createIdbStore(): WorldStore {
  // Ленивое подключение idb — только в браузере.
  const dbPromise = import('idb').then(({ openDB }) =>
    openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'userId' })
        }
      },
    }),
  )
  return {
    async load(userId) {
      const db = await dbPromise
      const world = (await db.get(STORE, userId)) as LocalWorld | undefined
      if (!world) return null
      // Схема сменилась — старый кэш непригоден, сбрасываем (не очередь, C11 — очередь отдельно).
      if (world.schemaVersion !== WORLD_SCHEMA_VERSION) return null
      return world
    },
    async save(world) {
      const db = await dbPromise
      await db.put(STORE, world)
    },
    async clear(userId) {
      const db = await dbPromise
      await db.delete(STORE, userId)
    },
  }
}

/** Структурная копия (idb клонирует при записи; для memory-стора делаем явно). */
function clone<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone
  return sc ? sc(value) : (JSON.parse(JSON.stringify(value)) as T)
}

/** Фабрика: idb в браузере, память в node/тестах. Можно навязать `memory` для детерминизма. */
export function createWorldStore(mode: 'auto' | 'memory' | 'idb' = 'auto'): WorldStore {
  if (mode === 'memory') return createMemoryStore()
  if (mode === 'idb') return createIdbStore()
  return hasIndexedDb() ? createIdbStore() : createMemoryStore()
}
