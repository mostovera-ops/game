/**
 * supabase.ts — SupabaseBackendAdapter: реальные RPC/Edge/Realtime (20-backend §3.4/§3.5).
 *
 * НАЗНАЧЕНИЕ: прод. Мутации — RPC (`SECURITY DEFINER`) и Edge Functions; чтения —
 * снапшот-RPC (сервер собирает целостный срез, клиент не читает сырые таблицы по кускам);
 * живые обновления — Realtime-каналы города/стрита/ивента. Ключи из import.meta.env
 * (только `VITE_SUPABASE_PUBLISHABLE_KEY` — секретный service_role в клиент не попадает, §3.5).
 *
 * КОНТРАКТ 1:1: каждый метод `BackendAdapter` мапится на ровно одну серверную точку входа —
 * имя RPC совпадает с `MutationKind` (types/net.ts) для горячего пути, Edge Functions
 * (`iap-verify`/`migrate-farm`/`photo-upload`) — для внешних эффектов (20-backend §3.4.2).
 * Тело ответа сервера — конверт `{ ok, data?, error? }` (RpcResult), адаптер пробрасывает его.
 *
 * АНТИ-ЧИТ / ОПТИМИЗМ (21-client §3.5): клиент считает результат только для мгновенности UI,
 * истину берёт из ответа. Оффлайн-мутации кладутся в персистентную очередь (IndexedDB,
 * паттерн `net/local/persist.ts`) и возвращают `{ ok:false, error:{ code:'offline' } }` —
 * система-владелец держит оптимистичный патч. При реконнекте очередь дренится по FIFO:
 * подтверждение → `hooks.onConfirm`, отказ сервера (conflict/invalid) → `hooks.onRollback`
 * (система откатывает оптимистичный патч). Reconnect Realtime — на автосейве supabase-js.
 *
 * ГРАНИЦА: владелец файла — агент net-supabase (AGENTS.md). `net/` может импортировать
 * `@supabase/supabase-js`, `idb`, `@/engine` (контракт), `@/types`. Ноль scene/three/react.
 */

import {
  createClient,
  type SupabaseClient,
  type RealtimeChannel,
} from '@supabase/supabase-js'
import type {
  BackendAdapter,
  RealtimeHandler,
  Unsubscribe,
} from '@/engine/contracts'
import type {
  RpcResult,
  RpcError,
  RpcErrorCode,
  UUID,
  EpochMs,
  Wallet,
  FarmSnapshot,
  InventorySnapshot,
  ServerCalendar,
  DemandBoard,
  TownSnapshot,
  Stall,
  Contest,
  EventSnapshot,
  ProgressionSnapshot,
  CollectionsSnapshot,
  MailForagingSnapshot,
  RealtimeChannelKind,
  ChannelStatus,
  MutationKind,
  QueuedMutation,
  SowReq, SowRes,
  WaterReq, WaterRes,
  HarvestReq, HarvestRes,
  CraftStartReq, CraftStartRes,
  CraftCollectReq, CraftCollectRes,
  SellToMarketReq, SellToMarketRes,
  BuildingUpgradeReq, BuildingUpgradeRes,
  FeedAnimalReq, FeedAnimalRes,
  CollectAnimalProductReq, CollectAnimalProductRes,
  RenamePetReq, AffectionGiftReq, AffectionGiftRes,
  FairOpenReq, FairOpenRes,
  FairListReq, FairListRes,
  FairTentUpgradeRes,
  ContestEnterReq, ContestEnterRes,
  ContestVoteReq,
  ShiftSubmitReq, ShiftSubmitRes,
  CoopContributeReq, CoopContributeRes,
  PotluckContributeReq, PotluckContributeRes,
  EventContributeReq, EventContributeRes,
  HelpNeighborReq, GiftSendReq, NeighborSitReq,
  ChatPostReq, ChatPostRes,
  ResearchStartReq, ResearchStartRes,
  StaffAssignReq, StaffUpgradeReq, StaffUpgradeRes,
  ExpeditionStartReq, ExpeditionStartRes,
  ExpeditionCollectReq, ExpeditionCollectRes,
  MailOrderReq, MailOrderRes,
  MailSpeedupReq, MailSpeedupRes,
  MailClaimReq, MailClaimRes,
  ForageClaimReq, ForageCollectReq, ForageRes, FishCastRes,
  StreakCheckRes, StreakInsureRes, VacationRes,
  DecorPurchaseReq, DecorPlaceReq, NeonSaveReq,
  RecipeExperimentReq, RecipeExperimentRes,
  PrizePullReq, PrizePullRes,
  MigrationProposeReq, MigrationProposeRes,
  MigrationVoteReq, MigrationVoteRes,
  IapVerifyReq, IapVerifyRes,
  MigrateFarmReq, MigrateFarmRes,
  TownListing,
  PhotoUploadReq, PhotoUploadRes,
} from '@/types'
import { NET_TIMINGS } from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// Конфиг / хуки / инъекции (для прод и для замоканных тестов)
// ════════════════════════════════════════════════════════════════════════════

/** Фабрика supabase-js клиента (по умолчанию `createClient`; тест подменяет моком). */
export type SupabaseClientFactory = (
  url: string,
  key: string,
  options: Parameters<typeof createClient>[2],
) => SupabaseClient

/**
 * Наблюдатель сети (браузер: navigator.onLine + window online/offline). В тестах
 * (environment:'node') подменяется ручным контроллером — драйвим online↔offline и
 * наблюдаем дренаж очереди без реального сокета.
 */
export interface OnlineMonitor {
  isOnline(): boolean
  onChange(cb: (online: boolean) => void): () => void
}

/**
 * Хуки жизненного цикла адаптера — шов к net-слайсу (21-client §3.4) и к оптимистичному
 * ролбэку системного слоя. Адаптер сам не трогает игровой стор (contract-only), но
 * сообщает: длину очереди, смену online, статус каналов, подтверждение/откат мутации.
 */
export interface SupabaseAdapterHooks {
  onQueueChange?(len: number): void
  onOnlineChange?(online: boolean): void
  onChannelStatus?(channel: RealtimeChannelKind, status: ChannelStatus): void
  /** Мутация из очереди подтверждена сервером — `data` = серверная истина (reconcile). */
  onConfirm?(mutation: QueuedMutation, data: unknown): void
  /** Сервер отклонил мутацию из очереди (conflict/invalid) — откатить оптимистичный патч. */
  onRollback?(mutation: QueuedMutation, error: RpcError): void
}

export interface SupabaseAdapterConfig {
  url: string
  publishableKey: string
  /** Город игрока (для Realtime-топиков `town:{id}:*`); иначе резолвится из `getTown()`. */
  townId?: UUID
  /** Стрит игрока (для `street:{id}:*`); иначе резолвится из ростера `getTown()`. */
  streetId?: UUID
  /** Персист очереди: 'auto' (idb в браузере / память в node), 'memory', 'idb'. */
  queuePersist?: 'auto' | 'memory' | 'idb'
  clientFactory?: SupabaseClientFactory
  monitor?: OnlineMonitor
  queueStore?: MutationQueueStore
  hooks?: SupabaseAdapterHooks
  /** Инъектируемые часы (по умолчанию Date.now). */
  clock?: { now(): EpochMs }
}

// ════════════════════════════════════════════════════════════════════════════
// Имена серверных точек входа (20-backend §3.4)
// ════════════════════════════════════════════════════════════════════════════

/** Снапшот-RPC чтений (первичная гидрация слайсов). Сервер собирает целостный срез. */
const READ_RPC = {
  serverTime: 'get_server_time',
  wallet: 'wallet_get',
  farm: 'get_farm',
  inventory: 'get_inventory',
  calendar: 'get_calendar',
  demandBoard: 'get_demand_board',
  town: 'get_town',
  fairStall: 'get_fair_stall',
  contests: 'get_contests',
  event: 'get_event',
  progression: 'get_progression',
  collections: 'get_collections',
  mailForaging: 'get_mail_foraging',
  /** Town Browser (12-migration §3.1.3) — не часть `get_town` (та — только МОЙ город). */
  townListings: 'list_towns',
} as const

/** Edge Functions (внешние эффекты, 20-backend §3.4.2). */
const EDGE_FN = {
  migrateFarm: 'migrate-farm',
  iapVerify: 'iap-verify',
  photoUpload: 'photo-upload',
} as const

/** Все известные коды ошибок (common.ts) — для распознавания в сообщении RAISE. */
const KNOWN_CODES: readonly RpcErrorCode[] = [
  'conflict', 'insufficient_funds', 'insufficient_stock', 'not_ready',
  'window_closed', 'rate_limited', 'forbidden', 'cap_reached', 'not_found',
  'invalid_payload', 'offline', 'unknown',
]

// ════════════════════════════════════════════════════════════════════════════
// Нормализация ответов supabase-js → RpcResult
// ════════════════════════════════════════════════════════════════════════════

interface RawError {
  message?: string
  code?: string
  status?: number
}

/** Уже ли `data` — серверный конверт `{ ok, ... }` (RpcResult)? */
function isEnvelope(d: unknown): d is RpcResult<unknown> {
  return typeof d === 'object' && d !== null && 'ok' in d
    && typeof (d as { ok: unknown }).ok === 'boolean'
}

/** Транспортная/PostgREST/Functions ошибка → доменный RpcError. */
function mapError(error: RawError): RpcError {
  const msg = error.message ?? 'RPC error'
  const raw = (error.code ?? '').toLowerCase()
  const hay = `${raw} ${msg.toLowerCase()}`
  const matched = KNOWN_CODES.find(
    (c) => c !== 'unknown' && (raw === c || hay.includes(c)),
  )
  let code: RpcErrorCode = matched ?? 'unknown'
  if (!matched) {
    if (error.status === 429 || /rate/.test(hay)) code = 'rate_limited'
    else if (error.status === 403 || error.status === 401 || /jwt|permission|rls|forbidden|unauthor/.test(hay)) code = 'forbidden'
    else if (error.status === 404) code = 'not_found'
  }
  return { code, message: msg }
}

/**
 * supabase-js `{ data, error }` → `RpcResult<T>`. Если сервер вернул конверт `{ ok, ... }` —
 * пробрасываем как есть (истина сервера). Иначе `data` — само тело результата (голый REST/RPC).
 */
function toRpcResult<T>(data: unknown, error: RawError | null): RpcResult<T> {
  if (error) return { ok: false, error: mapError(error) }
  if (isEnvelope(data)) return data as RpcResult<T>
  return { ok: true, data: data as T }
}

// ════════════════════════════════════════════════════════════════════════════
// Персистентная очередь мутаций (idb + in-memory фолбэк, паттерн persist.ts)
// ════════════════════════════════════════════════════════════════════════════

const QDB_NAME = 'sunnyside-net'
const QDB_VERSION = 1
const QSTORE = 'mutation_queue'

export interface MutationQueueStore {
  load(userId: UUID): Promise<QueuedMutation[]>
  save(userId: UUID, queue: QueuedMutation[]): Promise<void>
  clear(userId: UUID): Promise<void>
}

function hasIndexedDb(): boolean {
  return typeof globalThis !== 'undefined'
    && typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined'
}

function cloneJson<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone
  return sc ? sc(value) : (JSON.parse(JSON.stringify(value)) as T)
}

function createMemoryQueueStore(): MutationQueueStore {
  const mem = new Map<UUID, QueuedMutation[]>()
  return {
    load: (userId) => Promise.resolve(mem.has(userId) ? cloneJson(mem.get(userId)!) : []),
    save: (userId, queue) => { mem.set(userId, cloneJson(queue)); return Promise.resolve() },
    clear: (userId) => { mem.delete(userId); return Promise.resolve() },
  }
}

function createIdbQueueStore(): MutationQueueStore {
  const dbPromise = import('idb').then(({ openDB }) =>
    openDB(QDB_NAME, QDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QSTORE)) db.createObjectStore(QSTORE)
      },
    }),
  )
  return {
    async load(userId) {
      const db = await dbPromise
      return ((await db.get(QSTORE, userId)) as QueuedMutation[] | undefined) ?? []
    },
    async save(userId, queue) {
      const db = await dbPromise
      await db.put(QSTORE, cloneJson(queue), userId)
    },
    async clear(userId) {
      const db = await dbPromise
      await db.delete(QSTORE, userId)
    },
  }
}

export function createMutationQueueStore(
  mode: 'auto' | 'memory' | 'idb' = 'auto',
): MutationQueueStore {
  if (mode === 'memory') return createMemoryQueueStore()
  if (mode === 'idb') return createIdbQueueStore()
  return hasIndexedDb() ? createIdbQueueStore() : createMemoryQueueStore()
}

// ── Наблюдатель сети по умолчанию (браузер) ──────────────────────────────────
function browserMonitor(): OnlineMonitor {
  const has = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.onLine === 'boolean'
  return {
    isOnline: () => (has ? navigator.onLine : true),
    onChange(cb) {
      if (!has) return () => {}
      const on = (): void => cb(true)
      const off = (): void => cb(false)
      window.addEventListener('online', on)
      window.addEventListener('offline', off)
      return () => {
        window.removeEventListener('online', on)
        window.removeEventListener('offline', off)
      }
    },
  }
}

/** Уникальный локальный id мутации (защита от повторного flush одного элемента). */
function newMutationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** supabase-статус канала → доменный `ChannelStatus`. */
function mapChannelStatus(status: string): ChannelStatus {
  switch (status) {
    case 'SUBSCRIBED': return 'subscribed'
    case 'CLOSED': return 'closed'
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT': return 'reconnecting'
    default: return 'error'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Фабрика адаптера
// ════════════════════════════════════════════════════════════════════════════

interface ChannelEntry {
  rt: RealtimeChannel | null
  handlers: Set<RealtimeHandler>
}

export function createSupabaseAdapter(config: SupabaseAdapterConfig): BackendAdapter {
  const now = (): EpochMs => config.clock?.now() ?? Date.now()
  const hooks = config.hooks ?? {}
  const monitor = config.monitor ?? browserMonitor()
  const queueStore = config.queueStore ?? createMutationQueueStore(config.queuePersist ?? 'auto')
  const makeClient: SupabaseClientFactory = config.clientFactory ?? createClient

  // ── Ленивое создание supabase-js клиента ──
  let client: SupabaseClient | null = null
  function getClient(): SupabaseClient {
    if (!client) {
      client = makeClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: NET_TIMINGS.realtimeEventsPerSecond } },
      })
    }
    return client
  }

  // ── Контекст сессии/города (топики Realtime) ──
  const ctx: { userId: UUID | null; townId: UUID | null; streetId: UUID | null } = {
    userId: null,
    townId: config.townId ?? null,
    streetId: config.streetId ?? null,
  }

  // ── Очередь мутаций ──
  let queue: QueuedMutation[] = []
  let flushing = false
  let queueLoaded = false

  async function loadQueue(): Promise<void> {
    if (queueLoaded || !ctx.userId) return
    queue = await queueStore.load(ctx.userId)
    queueLoaded = true
    hooks.onQueueChange?.(queue.length)
  }
  async function saveQueue(): Promise<void> {
    if (ctx.userId) await queueStore.save(ctx.userId, queue)
    hooks.onQueueChange?.(queue.length)
  }
  async function enqueue(kind: MutationKind, payload: unknown): Promise<QueuedMutation> {
    const m: QueuedMutation = {
      clientMutationId: newMutationId(),
      kind,
      payload,
      state: 'queued',
      enqueuedAt: now(),
      attempts: 0,
    }
    queue.push(m)
    await saveQueue()
    return m
  }

  // ── Низкоуровневые вызовы ──
  async function callRpc<T>(name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
    try {
      const { data, error } = await getClient().rpc(name, params ?? {})
      return toRpcResult<T>(data, error as RawError | null)
    } catch (e) {
      return {
        ok: false,
        error: { code: monitor.isOnline() ? 'unknown' : 'offline', message: String(e) },
      }
    }
  }

  async function callFn<T>(name: string, body: unknown): Promise<RpcResult<T>> {
    if (!monitor.isOnline()) {
      return { ok: false, error: { code: 'offline', message: 'Edge Function requires connection' } }
    }
    try {
      const { data, error } = await getClient().functions.invoke(name, {
        body: body as Record<string, unknown>,
      })
      return toRpcResult<T>(data, error as RawError | null)
    } catch (e) {
      return {
        ok: false,
        error: { code: monitor.isOnline() ? 'unknown' : 'offline', message: String(e) },
      }
    }
  }

  /**
   * Мутация горячего пути: online → RPC напрямую; offline → в очередь + `offline`
   * (система держит оптимистичный патч). Транспортный `offline` в ответе — тоже в очередь.
   */
  async function mut<T>(kind: MutationKind, params: Record<string, unknown>): Promise<RpcResult<T>> {
    if (!monitor.isOnline()) {
      await enqueue(kind, params)
      return { ok: false, error: { code: 'offline', message: 'queued (offline)' } }
    }
    const res = await callRpc<T>(kind, params)
    if (!res.ok && res.error.code === 'offline') {
      await enqueue(kind, params)
    }
    return res
  }

  function removeFromQueue(id: string): void {
    const i = queue.findIndex((m) => m.clientMutationId === id)
    if (i >= 0) queue.splice(i, 1)
  }

  /** Дренаж очереди FIFO при онлайне. Идемпотентен (guard `flushing`). */
  async function flush(): Promise<void> {
    if (flushing || !monitor.isOnline() || queue.length === 0) return
    flushing = true
    try {
      // Снимок: новые мутации, добавленные во время flush, дренятся следующим проходом.
      const batch = [...queue]
      for (const m of batch) {
        if (!monitor.isOnline()) break
        m.attempts += 1
        const res = await callRpc(m.kind, m.payload as Record<string, unknown>)
        if (res.ok) {
          removeFromQueue(m.clientMutationId)
          hooks.onConfirm?.(m, res.data)
        } else if (res.error.code === 'offline' || res.error.code === 'rate_limited') {
          // Транзиентно — оставляем в очереди, повторим позже (реконнект/следующий flush).
          break
        } else {
          // Сервер отклонил (conflict/invalid/insufficient/...) — откат оптимистичного патча.
          removeFromQueue(m.clientMutationId)
          hooks.onRollback?.(m, res.error)
        }
      }
      await saveQueue()
    } finally {
      flushing = false
    }
  }

  // ── Realtime ──
  const channels = new Map<RealtimeChannelKind, ChannelEntry>()

  function topicFor(channel: RealtimeChannelKind): string | null {
    switch (channel) {
      case 'calendar': return ctx.townId ? `town:${ctx.townId}:calendar` : null
      case 'event': return ctx.townId ? `town:${ctx.townId}:event` : null
      case 'foraging': return ctx.townId ? `town:${ctx.townId}:foraging` : null
      case 'projects': return ctx.townId ? `town:${ctx.townId}:projects` : null
      case 'fair': return ctx.townId ? `town:${ctx.townId}:fair` : null
      case 'versus': return ctx.townId ? `town:${ctx.townId}:versus` : null
      case 'town_chat': return ctx.townId ? `town:${ctx.townId}:chat` : null
      case 'street_chat': return ctx.streetId ? `street:${ctx.streetId}:chat` : null
      case 'street_board': return ctx.streetId ? `street:${ctx.streetId}:board` : null
      case 'inbox': return ctx.userId ? `player:${ctx.userId}:inbox` : null
      default: return null
    }
  }

  function openChannel(channel: RealtimeChannelKind): void {
    const entry = channels.get(channel)
    if (!entry || entry.rt || entry.handlers.size === 0) return
    const topic = topicFor(channel)
    if (!topic) return // контекст (town/street/user) ещё неизвестен — отложим до setContext
    const rt = getClient().channel(topic)
    rt.on('broadcast', { event: '*' }, (msg: { payload?: unknown }) => {
      const payload = msg && 'payload' in msg ? msg.payload : msg
      for (const h of entry.handlers) h(payload)
    })
    rt.subscribe((status: string) => {
      hooks.onChannelStatus?.(channel, mapChannelStatus(status))
    })
    entry.rt = rt
  }

  /** Переоткрыть отложенные каналы после того, как стал известен town/street/user. */
  function openPendingChannels(): void {
    for (const channel of channels.keys()) openChannel(channel)
  }

  function subscribe(channel: RealtimeChannelKind, handler: RealtimeHandler): Unsubscribe {
    let entry = channels.get(channel)
    if (!entry) {
      entry = { rt: null, handlers: new Set() }
      channels.set(channel, entry)
    }
    entry.handlers.add(handler)
    openChannel(channel)
    return () => {
      const e = channels.get(channel)
      if (!e) return
      e.handlers.delete(handler)
      if (e.handlers.size === 0) {
        if (e.rt) void getClient().removeChannel(e.rt)
        channels.delete(channel)
      }
    }
  }

  // ── Контекст: обновление id и переоткрытие зависимых каналов ──
  function setContext(patch: Partial<typeof ctx>): void {
    let changed = false
    if (patch.userId && patch.userId !== ctx.userId) { ctx.userId = patch.userId; changed = true }
    if (patch.townId && patch.townId !== ctx.townId) { ctx.townId = patch.townId; changed = true }
    if (patch.streetId && patch.streetId !== ctx.streetId) { ctx.streetId = patch.streetId; changed = true }
    if (changed) openPendingChannels()
  }

  // ── Сессия ──
  async function ensureSession(): Promise<RpcResult<{ userId: UUID }>> {
    try {
      const c = getClient()
      const { data: sessionData } = await c.auth.getSession()
      let user = sessionData.session?.user ?? null
      if (!user) {
        // Анонимная сессия на старте (§3.1: анонимный auth). Апгрейд до email/OAuth —
        // позже через linkIdentity/updateUser; onAuthStateChange подхватит смену uid.
        const { data, error } = await c.auth.signInAnonymously()
        if (error || !data.user) {
          return { ok: false, error: { code: 'forbidden', message: error?.message ?? 'anon sign-in failed' } }
        }
        user = data.user
      }
      setContext({ userId: user.id })
      await loadQueue()
      return { ok: true, data: { userId: user.id } }
    } catch (e) {
      return { ok: false, error: { code: monitor.isOnline() ? 'unknown' : 'offline', message: String(e) } }
    }
  }

  // ── Жизненный цикл ──
  let unsubMonitor: (() => void) | null = null
  let unsubAuth: (() => void) | null = null

  async function init(): Promise<void> {
    // Реакция на смену online: реконнект → дренаж очереди.
    unsubMonitor = monitor.onChange((online) => {
      hooks.onOnlineChange?.(online)
      if (online) void flush()
    })
    // Апгрейд анонимной сессии до постоянной меняет uid — перецепляем контекст/inbox.
    const sub = getClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user) setContext({ userId: session.user.id })
    })
    unsubAuth = () => sub.data.subscription.unsubscribe()

    await ensureSession()
    if (monitor.isOnline()) void flush()
  }

  async function dispose(): Promise<void> {
    unsubMonitor?.(); unsubMonitor = null
    unsubAuth?.(); unsubAuth = null
    for (const entry of channels.values()) {
      if (entry.rt) await getClient().removeChannel(entry.rt)
    }
    channels.clear()
  }

  // ── Чтения (снапшот-RPC) ──
  function read<T>(name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
    return callRpc<T>(name, params)
  }

  async function getTown(): Promise<RpcResult<TownSnapshot>> {
    const res = await read<TownSnapshot>(READ_RPC.town)
    if (res.ok) {
      const mine = ctx.userId
        ? res.data.roster.find((r) => r.userId === ctx.userId)
        : undefined
      setContext({ townId: res.data.townId, streetId: mine?.streetId })
    }
    return res
  }

  // ════════════════════════════════════════════════════════════════════════
  // Контракт BackendAdapter (1:1 с 20-backend §3.4)
  // ════════════════════════════════════════════════════════════════════════
  const adapter: BackendAdapter = {
    kind: 'supabase',

    init,
    dispose,
    ensureSession,
    getServerTime: () => read<{ serverNow: EpochMs }>(READ_RPC.serverTime),

    // reads
    getWallet: () => read<Wallet>(READ_RPC.wallet),
    getFarm: () => read<FarmSnapshot>(READ_RPC.farm),
    getInventory: () => read<InventorySnapshot>(READ_RPC.inventory),
    getCalendar: () => read<ServerCalendar>(READ_RPC.calendar),
    getDemandBoard: () => read<DemandBoard>(READ_RPC.demandBoard),
    getTown,
    getFairStall: () => read<Stall>(READ_RPC.fairStall),
    getContests: () => read<Contest[]>(READ_RPC.contests),
    getEvent: () => read<EventSnapshot>(READ_RPC.event),
    getProgression: () => read<ProgressionSnapshot>(READ_RPC.progression),
    getCollections: () => read<CollectionsSnapshot>(READ_RPC.collections),
    getMailForaging: () => read<MailForagingSnapshot>(READ_RPC.mailForaging),
    listTowns: () => read<TownListing[]>(READ_RPC.townListings),

    // realtime
    subscribe,

    // ── Мутации (RPC 1:1, имя = MutationKind) ──
    // NB: имена параметров = ФАКТИЧЕСКИЕ имена аргументов серверных функций
    // (20-backend §3.4.1, 0006_functions.sql). Скалярные RPC используют `p_`-префикс
    // (осознанно — иначе имя аргумента коллизирует с одноимённой колонкой внутри
    // тела функции, напр. `where target_id = target_id`); массивные RPC (`plot_ids`,
    // `job_ids`, `animal_ids`) — без префикса. PostgREST резолвит перегрузку по
    // ИМЕНАМ аргументов из JSON-тела, поэтому маппинг DTO→arg должен быть точным.
    sow: (req: SowReq) => mut<SowRes>('sow', { p_slot: req.slot, p_seed_key: req.seedKey }),
    water: (req: WaterReq) => mut<WaterRes>('water', { plot_ids: req.plotIds }),
    harvest: (req: HarvestReq) => mut<HarvestRes>('harvest', { plot_ids: req.plotIds }),
    craftStart: (req: CraftStartReq) =>
      mut<CraftStartRes>('craft_start', { p_machine: req.machineId, p_recipe_key: req.recipeKey, p_batch: req.batch }),
    craftCollect: (req: CraftCollectReq) => mut<CraftCollectRes>('craft_collect', { job_ids: req.jobIds }),
    sellToMarket: (req: SellToMarketReq) =>
      mut<SellToMarketRes>('sell_to_market', { p_item_key: req.itemKey, p_qty: req.qty }),
    buildingUpgrade: (req: BuildingUpgradeReq) =>
      mut<BuildingUpgradeRes>('building_upgrade', { building_key: req.buildingKey }),

    feedAnimal: (req: FeedAnimalReq) => mut<FeedAnimalRes>('feed_animal', { animal_ids: req.animalIds }),
    collectAnimalProduct: (req: CollectAnimalProductReq) =>
      mut<CollectAnimalProductRes>('collect_animal_product', { animal_ids: req.animalIds }),
    renamePet: (req: RenamePetReq) => mut<void>('rename_pet', { animal_id: req.animalId, name: req.name }),
    affectionGift: (req: AffectionGiftReq) =>
      mut<AffectionGiftRes>('affection_gift', { animal_id: req.animalId, gift_key: req.giftKey }),

    fairOpen: (req: FairOpenReq) => mut<FairOpenRes>('fair_open', { stall_id: req.stallId }),
    fairList: (req: FairListReq) => mut<FairListRes>('fair_list', { stall_id: req.stallId, lots: req.lots }),
    fairTentUpgrade: () => mut<FairTentUpgradeRes>('fair_tent_upgrade', {}),
    contestEnter: (req: ContestEnterReq) =>
      mut<ContestEnterRes>('contest_enter', { contest_key: req.contestKey, payload: req.payload }),
    contestVote: (req: ContestVoteReq) =>
      mut<void>('contest_vote', { contest_id: req.contestId, entry_id: req.entryId }),
    shiftSubmit: (req: ShiftSubmitReq) => mut<ShiftSubmitRes>('shift_submit', { shift_log: req.shiftLog }),

    coopContribute: (req: CoopContributeReq) =>
      mut<CoopContributeRes>('coop_contribute', { p_order: req.orderId, p_item_key: req.itemKey, p_qty: req.qty }),
    potluckContribute: (req: PotluckContributeReq) =>
      mut<PotluckContributeRes>('potluck_contribute', { p_week: req.weekIndex, p_item_key: req.itemKey, p_qty: req.qty }),
    eventContribute: (req: EventContributeReq) =>
      mut<EventContributeRes>('event_contribute', { p_item_key: req.itemKey, p_qty: req.qty, p_channel: req.channel }),

    helpNeighbor: (req: HelpNeighborReq) =>
      mut<void>('help_neighbor', { p_target: req.targetId, p_action: req.actionType }),
    giftSend: (req: GiftSendReq) => mut<void>('gift_send', { p_to: req.toId, p_item_key: req.itemKey, p_qty: req.qty }),
    neighborSit: (req: NeighborSitReq) => mut<void>('neighbor_sit', { host_id: req.hostId }),
    chatPost: (req: ChatPostReq) =>
      mut<ChatPostRes>('chat_post', { p_channel_kind: req.channel, p_body: req.body, p_sticker_key: req.stickerKey ?? null }),

    researchStart: (req: ResearchStartReq) => mut<ResearchStartRes>('research_start', { node_key: req.nodeKey }),
    staffAssign: (req: StaffAssignReq) => mut<void>('staff_assign', { staff_key: req.staffKey, post: req.post }),
    staffUpgrade: (req: StaffUpgradeReq) => mut<StaffUpgradeRes>('staff_upgrade', { staff_key: req.staffKey }),

    expeditionStart: (req: ExpeditionStartReq) =>
      mut<ExpeditionStartRes>('expedition_start', { state_key: req.stateKey, route_slot: req.routeSlot }),
    expeditionCollect: (req: ExpeditionCollectReq) =>
      mut<ExpeditionCollectRes>('expedition_collect', { exp_ids: req.expIds }),
    mailOrder: (req: MailOrderReq) => mut<MailOrderRes>('mail_order', { item_key: req.itemKey }),
    mailSpeedup: (req: MailSpeedupReq) => mut<MailSpeedupRes>('mail_speedup', { order_id: req.orderId }),
    mailClaim: (req: MailClaimReq) => mut<MailClaimRes>('mail_claim', { order_ids: req.orderIds }),
    forageClaim: (req: ForageClaimReq) => mut<ForageRes>('forage_claim', { point_id: req.pointId }),
    forageCollect: (req: ForageCollectReq) => mut<ForageRes>('forage_collect', { point_id: req.pointId }),
    fishCast: () => mut<FishCastRes>('fish_cast', {}),

    streakCheck: () => mut<StreakCheckRes>('streak_check', {}),
    streakInsure: () => mut<StreakInsureRes>('streak_insure', {}),
    vacationStart: () => mut<VacationRes>('vacation_start', {}),
    vacationEnd: () => mut<VacationRes>('vacation_end', {}),
    decorPurchase: (req: DecorPurchaseReq) => mut<void>('decor_purchase', { decor_key: req.decorKey }),
    decorPlace: (req: DecorPlaceReq) =>
      mut<void>('decor_place', { decor_key: req.decorKey, x: req.x, z: req.z, rot: req.rot }),
    neonSave: (req: NeonSaveReq) => mut<void>('neon_save', { config: req.config }),
    recipeExperiment: (req: RecipeExperimentReq) => mut<RecipeExperimentRes>('recipe_experiment', { inputs: req.inputs }),

    prizePull: (req: PrizePullReq) => mut<PrizePullRes>('prize_pull', { p_series: req.seriesKey, p_count: req.count }),

    // migration_propose / migration_vote — RPC горячего пути (§3.4.1), но семантически
    // Edge-инициируемые переезды; трактуем как RPC (имя = MutationKind).
    migrationPropose: (req: MigrationProposeReq) =>
      mut<MigrationProposeRes>('migration_propose', {
        kind: req.kind,
        target_town: req.targetTown,
        street_id: req.streetId,
      }),
    migrationVote: (req: MigrationVoteReq) =>
      mut<MigrationVoteRes>('migration_vote', { proposal_id: req.proposalId, vote: req.vote }),

    // ── Edge Functions (внешние эффекты, §3.4.2) — не буферизуются оффлайн ──
    migrateFarm: (req: MigrateFarmReq) =>
      callFn<MigrateFarmRes>(EDGE_FN.migrateFarm, { target_town: req.targetTown }),
    iapVerify: (req: IapVerifyReq) =>
      callFn<IapVerifyRes>(EDGE_FN.iapVerify, { provider: req.provider, receipt: req.receipt, sku: req.sku }),
    photoUpload: (req: PhotoUploadReq) => callFn<PhotoUploadRes>(EDGE_FN.photoUpload, { image: req.image }),
  }

  return adapter
}
