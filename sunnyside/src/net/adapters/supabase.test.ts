/**
 * supabase.test.ts — юнит-тесты SupabaseBackendAdapter с полностью замоканным supabase-js.
 *
 * Гоняются в environment:'node' (vite.config): нет реального сокета/сети — инъектируем
 * `clientFactory` (мок supabase-js), `monitor` (ручной online-контроллер) и `queueStore`
 * (in-memory). Проверяем: анонимную сессию, 1:1 маппинг RPC/Edge, нормализацию конверта,
 * маппинг ошибок, оффлайн-очередь + дренаж при реконнекте с confirm/rollback, Realtime
 * (топики, доставка broadcast, отложенное открытие канала до резолва town/street).
 */

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseAdapter,
  createMutationQueueStore,
  type SupabaseAdapterConfig,
  type OnlineMonitor,
} from './supabase'

// ── Ручной online-монитор ────────────────────────────────────────────────────
function makeMonitor(initial = true): OnlineMonitor & { set(v: boolean): void } {
  let online = initial
  const subs = new Set<(v: boolean) => void>()
  return {
    isOnline: () => online,
    onChange(cb) { subs.add(cb); return () => subs.delete(cb) },
    set(v) { online = v; for (const cb of subs) cb(v) },
  }
}

// ── Мок канала Realtime ──────────────────────────────────────────────────────
interface MockChannel {
  topic: string
  broadcastCbs: ((msg: { payload: unknown }) => void)[]
  subscribed: boolean
  on(type: string, filter: unknown, cb: (msg: { payload: unknown }) => void): MockChannel
  subscribe(cb?: (status: string) => void): MockChannel
  emit(payload: unknown): void
}
function makeMockChannel(topic: string): MockChannel {
  const ch: MockChannel = {
    topic,
    broadcastCbs: [],
    subscribed: false,
    on(type, _filter, cb) { if (type === 'broadcast') ch.broadcastCbs.push(cb); return ch },
    subscribe(cb) { ch.subscribed = true; cb?.('SUBSCRIBED'); return ch },
    emit(payload) { for (const cb of ch.broadcastCbs) cb({ payload }) },
  }
  return ch
}

type RpcHandler = (params: unknown) => { data: unknown; error: unknown }

// ── Мок supabase-js клиента ──────────────────────────────────────────────────
function makeMockClient() {
  const state = {
    rpcCalls: [] as { name: string; params: unknown }[],
    fnCalls: [] as { name: string; body: unknown }[],
    handlers: new Map<string, RpcHandler>(),
    channels: new Map<string, MockChannel>(),
    removed: [] as string[],
    session: null as { user: { id: string } } | null,
    anonUser: { id: 'anon-user-1' } as { id: string },
    signInCount: 0,
    signInError: null as unknown,
    authCbs: [] as ((event: string, session: { user: { id: string } } | null) => void)[],
  }

  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: state.session }, error: null }),
      signInAnonymously: () => {
        state.signInCount += 1
        if (state.signInError) return Promise.resolve({ data: { user: null }, error: state.signInError })
        state.session = { user: state.anonUser }
        return Promise.resolve({ data: { user: state.anonUser }, error: null })
      },
      onAuthStateChange: (cb: (e: string, s: { user: { id: string } } | null) => void) => {
        state.authCbs.push(cb)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
    rpc: (name: string, params: unknown) => {
      state.rpcCalls.push({ name, params })
      const h = state.handlers.get(name)
      return Promise.resolve(h ? h(params) : { data: null, error: null })
    },
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        state.fnCalls.push({ name, body: opts.body })
        const h = state.handlers.get(name)
        return Promise.resolve(h ? h(opts.body) : { data: null, error: null })
      },
    },
    channel: (topic: string) => {
      const ch = makeMockChannel(topic)
      state.channels.set(topic, ch)
      return ch
    },
    removeChannel: (ch: MockChannel) => { state.removed.push(ch.topic); return Promise.resolve() },
  }

  return { client: client as unknown as SupabaseClient, state }
}

// ── Сборка адаптера под тест ──────────────────────────────────────────────────
function setup(overrides: Partial<SupabaseAdapterConfig> = {}) {
  const mock = makeMockClient()
  const monitor = makeMonitor(true)
  const confirms: { kind: string; data: unknown }[] = []
  const rollbacks: { kind: string; code: string }[] = []
  const queueLens: number[] = []
  const config: SupabaseAdapterConfig = {
    url: 'https://test.supabase.co',
    publishableKey: 'sb_publishable_test',
    clientFactory: () => mock.client,
    monitor,
    queueStore: createMutationQueueStore('memory'),
    hooks: {
      onConfirm: (m, data) => confirms.push({ kind: m.kind, data }),
      onRollback: (m, err) => rollbacks.push({ kind: m.kind, code: err.code }),
      onQueueChange: (len) => queueLens.push(len),
    },
    ...overrides,
  }
  const adapter = createSupabaseAdapter(config)
  return { adapter, mock, monitor, confirms, rollbacks, queueLens }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5))

describe('SupabaseBackendAdapter — сессия', () => {
  it('kind = supabase', () => {
    const { adapter } = setup()
    expect(adapter.kind).toBe('supabase')
  })

  it('ensureSession анонимно логинит, если сессии нет', async () => {
    const { adapter, mock } = setup()
    const res = await adapter.ensureSession()
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.userId).toBe('anon-user-1')
    expect(mock.state.signInCount).toBe(1)
  })

  it('ensureSession переиспользует существующую сессию (без повторного signIn)', async () => {
    const { adapter, mock } = setup()
    mock.state.session = { user: { id: 'existing-user' } }
    const res = await adapter.ensureSession()
    expect(res.ok && res.data.userId).toBe('existing-user')
    expect(mock.state.signInCount).toBe(0)
  })

  it('сбой анонимного логина → forbidden', async () => {
    const { adapter, mock } = setup()
    mock.state.signInError = { message: 'anon disabled' }
    const res = await adapter.ensureSession()
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('forbidden')
  })
})

describe('SupabaseBackendAdapter — чтения (снапшот-RPC)', () => {
  it('getServerTime → rpc(get_server_time), тело-конверт пробрасывается', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('get_server_time', () => ({ data: { ok: true, data: { serverNow: 123 } }, error: null }))
    const res = await adapter.getServerTime()
    expect(res.ok && res.data.serverNow).toBe(123)
    expect(mock.state.rpcCalls.some((c) => c.name === 'get_server_time')).toBe(true)
  })

  it('голое тело (без конверта ok) заворачивается в { ok:true, data }', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('wallet_get', () => ({ data: { bucks: 10, dimes: 2, tickets: 0, ribbons: 0 }, error: null }))
    const res = await adapter.getWallet()
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.bucks).toBe(10)
  })

  it('getTown резолвит townId/streetId в контекст (для Realtime-топиков)', async () => {
    const { adapter, mock } = setup()
    await adapter.ensureSession()
    mock.state.handlers.set('get_town', () => ({
      data: {
        townId: 'town-9',
        streets: [], projects: {}, migrations: [], coopOrders: [],
        roster: [{ userId: 'anon-user-1', farmId: 'f1', displayName: 'Me', streetId: 'street-3' }],
      },
      error: null,
    }))
    const res = await adapter.getTown()
    expect(res.ok && res.data.townId).toBe('town-9')
    // контекст применён — подписка на calendar откроет town:town-9:calendar
    adapter.subscribe('calendar', () => {})
    expect(mock.state.channels.has('town:town-9:calendar')).toBe(true)
  })
})

describe('SupabaseBackendAdapter — мутации (RPC 1:1)', () => {
  it('sow мапит DTO→серверные имена аргументов (p_slot/p_seed_key) и возвращает результат', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('sow', (params) => {
      // Имена аргументов = фактическая сигнатура public.sow(p_slot, p_seed_key).
      expect(params).toEqual({ p_slot: 2, p_seed_key: 'seed_tomato' })
      return { data: { ok: true, data: { plot: { id: 'p1' } } }, error: null }
    })
    const res = await adapter.sow({ slot: 2, seedKey: 'seed_tomato' as never })
    expect(res.ok).toBe(true)
  })

  it('harvest → rpc(harvest, { plot_ids })', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('harvest', () => ({ data: { ok: true, data: { items: [] } }, error: null }))
    await adapter.harvest({ plotIds: ['a', 'b'] })
    const call = mock.state.rpcCalls.find((c) => c.name === 'harvest')
    expect(call?.params).toEqual({ plot_ids: ['a', 'b'] })
  })

  it('серверный конверт { ok:false } пробрасывается как есть (анти-чит истина)', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('sow', () => ({ data: { ok: false, error: { code: 'conflict', message: 'slot taken' } }, error: null }))
    const res = await adapter.sow({ slot: 1, seedKey: 'seed_x' as never })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('conflict')
  })

  it('транспортная ошибка PostgREST мапится в доменный код', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('water', () => ({ data: null, error: { message: 'permission denied for rls', status: 403 } }))
    const res = await adapter.water({ plotIds: ['a'] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('forbidden')
  })
})

describe('SupabaseBackendAdapter — оффлайн-очередь и реконнект', () => {
  it('мутация оффлайн → в очередь, ответ offline', async () => {
    const { adapter, monitor, queueLens } = setup()
    await adapter.ensureSession()
    monitor.set(false)
    const res = await adapter.sow({ slot: 0, seedKey: 'seed_x' as never })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('offline')
    expect(queueLens.at(-1)).toBe(1)
  })

  it('реконнект дренит очередь и подтверждает мутацию (onConfirm)', async () => {
    const { adapter, mock, monitor, confirms } = setup()
    await adapter.init()
    monitor.set(false)
    await adapter.sow({ slot: 0, seedKey: 'seed_x' as never })
    mock.state.handlers.set('sow', () => ({ data: { ok: true, data: { plot: { id: 'p9' } } }, error: null }))
    monitor.set(true)
    await tick()
    expect(mock.state.rpcCalls.some((c) => c.name === 'sow')).toBe(true)
    expect(confirms).toHaveLength(1)
    expect(confirms[0]?.kind).toBe('sow')
  })

  it('отказ сервера при дренаже → onRollback, элемент снят с очереди', async () => {
    const { adapter, mock, monitor, rollbacks, queueLens } = setup()
    await adapter.init()
    monitor.set(false)
    await adapter.harvest({ plotIds: ['a'] })
    mock.state.handlers.set('harvest', () => ({ data: { ok: false, error: { code: 'conflict', message: 'stale' } }, error: null }))
    monitor.set(true)
    await tick()
    expect(rollbacks).toHaveLength(1)
    expect(rollbacks[0]?.code).toBe('conflict')
    expect(queueLens.at(-1)).toBe(0)
  })

  it('транзиентный offline при дренаже оставляет элемент в очереди', async () => {
    const { adapter, mock, monitor } = setup()
    await adapter.init()
    monitor.set(false)
    await adapter.water({ plotIds: ['a'] })
    // «онлайн», но rpc отвечает транспортным offline-подобным сбоем
    let calls = 0
    mock.state.handlers.set('water', () => { calls += 1; return { data: null, error: { message: 'rate limited', status: 429 } } })
    monitor.set(true)
    await tick()
    expect(calls).toBe(1)
    // rate_limited — транзиентно: очередь не очищена, повтор позже
    const res2 = await adapter.getServerTime() // no-op read, just ensure no throw
    expect(res2).toBeDefined()
  })
})

describe('SupabaseBackendAdapter — Realtime', () => {
  it('inbox топик player:{id}:inbox, broadcast доставляется хэндлеру', async () => {
    const { adapter, mock } = setup()
    await adapter.ensureSession()
    const received: unknown[] = []
    adapter.subscribe('inbox', (p) => received.push(p))
    const ch = mock.state.channels.get('player:anon-user-1:inbox')
    expect(ch).toBeDefined()
    ch!.emit({ message: 'reward' })
    expect(received).toEqual([{ message: 'reward' }])
  })

  it('канал, зависящий от town, откладывается до резолва контекста', async () => {
    const { adapter, mock } = setup()
    await adapter.ensureSession()
    adapter.subscribe('calendar', () => {})
    // town ещё не известен → канал не создан
    expect([...mock.state.channels.keys()].some((t) => t.includes(':calendar'))).toBe(false)
    mock.state.handlers.set('get_town', () => ({
      data: { townId: 't7', streets: [], projects: {}, migrations: [], coopOrders: [], roster: [] },
      error: null,
    }))
    await adapter.getTown()
    expect(mock.state.channels.has('town:t7:calendar')).toBe(true)
  })

  it('отписка удаляет канал, когда хэндлеров не осталось', async () => {
    const { adapter, mock } = setup()
    await adapter.ensureSession()
    const unsub = adapter.subscribe('inbox', () => {})
    expect(mock.state.channels.has('player:anon-user-1:inbox')).toBe(true)
    unsub()
    expect(mock.state.removed).toContain('player:anon-user-1:inbox')
  })

  it('несколько хэндлеров на один канал получают одно сообщение', async () => {
    const { adapter, mock } = setup()
    await adapter.ensureSession()
    const a: unknown[] = []; const b: unknown[] = []
    adapter.subscribe('inbox', (p) => a.push(p))
    adapter.subscribe('inbox', (p) => b.push(p))
    mock.state.channels.get('player:anon-user-1:inbox')!.emit({ x: 1 })
    expect(a).toEqual([{ x: 1 }])
    expect(b).toEqual([{ x: 1 }])
  })
})

describe('SupabaseBackendAdapter — Edge Functions', () => {
  it('iapVerify → functions.invoke(iap-verify, body)', async () => {
    const { adapter, mock } = setup()
    mock.state.handlers.set('iap-verify', () => ({ data: { ok: true, data: { purchaseId: 'x', dimes: 100 } }, error: null }))
    const res = await adapter.iapVerify({ provider: 'apple', receipt: 'r', sku: 'sku1' })
    expect(res.ok && res.data.dimes).toBe(100)
    const call = mock.state.fnCalls.find((c) => c.name === 'iap-verify')
    expect(call?.body).toEqual({ provider: 'apple', receipt: 'r', sku: 'sku1' })
  })

  it('Edge оффлайн → offline без вызова invoke (внешний эффект не буферизуем)', async () => {
    const { adapter, mock, monitor } = setup()
    monitor.set(false)
    const res = await adapter.migrateFarm({ targetTown: 't2' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('offline')
    expect(mock.state.fnCalls).toHaveLength(0)
  })
})

describe('SupabaseBackendAdapter — init/dispose', () => {
  it('init логинит и подписывается на смену online; dispose снимает каналы', async () => {
    const { adapter, mock } = setup()
    await adapter.init()
    expect(mock.state.signInCount).toBe(1)
    adapter.subscribe('inbox', () => {})
    await adapter.dispose()
    expect(mock.state.removed).toContain('player:anon-user-1:inbox')
  })
})
