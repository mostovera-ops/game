/**
 * app/backend.ts — КОМПОЗИЦИЯ бэкенда (интегратор C3, AGENTS.md §2 «Композиция»).
 *
 * ЗАЧЕМ: `ui/` и `scene/` не имеют права ходить в `@/net` (граница, `lint:boundary`).
 * Сборку «адаптер + `SystemContext` + системы движка» делает ровно эта композиционная
 * зона (`src/app/**` — вне правил границ, как `App.tsx`/`main.tsx`). Здесь:
 *   1) единый синглтон `BackendAdapter` (local | supabase — выбор в `net/index.ts`);
 *   2) `SystemContext` (serverNow из стора + `applyMutation` — оптимистика→adapter→reconcile);
 *   3) фабрика ВСЕХ систем движка (`createSystems`) для DI-провайдеров (`SystemsProvider`);
 *   4) первичная гидрация слайсов из снапшотов адаптера (`hydrateAll`) + бутстрап (`bootstrap`).
 *
 * АНТИ-ЧИТ (AGENTS.md §0.3): клиент НЕ считает награду. Оптимистичный патч — для
 * мгновенности UI; после подтверждения `applyMutation` перечитывает снапшоты (истина сервера)
 * и накатывает их в стор. При отказе — откат inverse-патча + тёплый тост (никогда не красный).
 */

import { useStore } from '@/state'
import { createBackendAdapter } from '@/net'
import type { BackendAdapter } from '@/engine/contracts'
import type { SystemContext } from '@/engine/contracts'
import type {
  CoopSystem,
  SocialSystem,
  CraftSystem,
  FarmSystem,
  AnimalSystem,
  FairSystem,
  ContestSystem,
  ShiftSystem,
  EventSystem,
  ProgressionSystem,
  CollectionSystem,
  MonetizationSystem,
  ExpeditionSystem,
  InventorySystem,
  MailForagingSystem,
} from '@/engine/contracts'
import type { MutationKind, RpcResult, EpochMs, UUID, ProductKey } from '@/types'

import { createFarmSystem } from '@/engine/farm'
import { createAnimalSystem } from '@/engine/animals'
import { createCraftSystem } from '@/engine/craft'
import { createFairSystem, createShiftSystem, createContestSystem } from '@/engine/fair'
import { createEventSystem } from '@/engine/event'
import { createProgressionSystem } from '@/engine/progression'
import { createCollectionSystem } from '@/engine/collections'
import { createMonetizationSystem } from '@/engine/monetization'
import { createExpeditionSystem } from '@/engine/expedition'
import { createInventorySystem } from '@/engine/inventory'
import { noteHydration, subscribeNotifications } from './notifications'

// ════════════════════════════════════════════════════════════════════════════
// Адаптер-синглтон
// ════════════════════════════════════════════════════════════════════════════

let adapterSingleton: BackendAdapter | null = null

/** Единый адаптер приложения (создаётся лениво). Тесты передают свой через `setAdapter`. */
export function getAdapter(): BackendAdapter {
  if (!adapterSingleton) adapterSingleton = createBackendAdapter()
  return adapterSingleton
}

/** Подменить адаптер (интеграционные тесты — свой local с управляемыми часами). */
export function setAdapter(adapter: BackendAdapter): void {
  adapterSingleton = adapter
}

// ════════════════════════════════════════════════════════════════════════════
// Диспетчер мутаций: MutationKind → метод адаптера (1:1 с 20-backend §3.4.1)
// ════════════════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
async function dispatch(
  a: BackendAdapter,
  kind: MutationKind,
  p: any,
): Promise<RpcResult<any>> {
  switch (kind) {
    case 'sow': return a.sow(p)
    case 'water': return a.water(p)
    case 'harvest': return a.harvest(p)
    case 'craft_start': return a.craftStart(p)
    case 'craft_collect': return a.craftCollect(p)
    case 'sell_to_market': return a.sellToMarket(p)
    case 'building_upgrade': return a.buildingUpgrade(p)
    case 'feed_animal': return a.feedAnimal(p)
    case 'collect_animal_product': return a.collectAnimalProduct(p)
    case 'rename_pet': return a.renamePet(p)
    case 'affection_gift': return a.affectionGift(p)
    case 'fair_open': return a.fairOpen(p)
    case 'fair_list': return a.fairList(p)
    case 'fair_tent_upgrade': return a.fairTentUpgrade()
    case 'contest_enter': return a.contestEnter(p)
    case 'contest_vote': return a.contestVote(p)
    case 'shift_submit': return a.shiftSubmit(p)
    case 'coop_contribute': return a.coopContribute(p)
    case 'potluck_contribute': return a.potluckContribute(p)
    case 'event_contribute': return a.eventContribute(p)
    case 'help_neighbor': return a.helpNeighbor(p)
    case 'gift_send': return a.giftSend(p)
    case 'neighbor_sit': return a.neighborSit(p)
    case 'chat_post': return a.chatPost(p)
    case 'research_start': return a.researchStart(p)
    case 'staff_assign': return a.staffAssign(p)
    case 'staff_upgrade': return a.staffUpgrade(p)
    case 'expedition_start': return a.expeditionStart(p)
    case 'expedition_collect': return a.expeditionCollect(p)
    case 'mail_order': return a.mailOrder(p)
    case 'mail_speedup': return a.mailSpeedup(p)
    case 'mail_claim': return a.mailClaim(p)
    case 'forage_claim': return a.forageClaim(p)
    case 'forage_collect': return a.forageCollect(p)
    case 'fish_cast': return a.fishCast()
    case 'streak_check': return a.streakCheck()
    case 'streak_insure': return a.streakInsure()
    case 'vacation_start': return a.vacationStart()
    case 'vacation_end': return a.vacationEnd()
    case 'decor_purchase': return a.decorPurchase(p)
    case 'decor_place': return a.decorPlace(p)
    case 'neon_save': return a.neonSave(p)
    case 'recipe_experiment': return a.recipeExperiment(p)
    case 'prize_pull': return a.prizePull(p)
    case 'migration_propose': return a.migrationPropose(p)
    case 'migration_vote': return a.migrationVote(p)
    default: {
      // Исчерпывающая проверка: новый MutationKind без ветки — ошибка компиляции.
      const _never: never = kind
      return { ok: false, error: { code: 'unknown', message: `неизвестная мутация ${String(_never)}` } }
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Тёплый (никогда не красный, P3) текст отказа мутации для тоста. */
function warmError(code: string): string {
  switch (code) {
    case 'conflict': return 'Кто-то успел раньше — обновили состояние'
    case 'insufficient_stock': return 'Не хватает ингредиентов — наготовь ещё'
    case 'insufficient_funds': return 'Не хватает средств'
    case 'window_closed': return 'Окно уже закрылось — до следующего раза'
    case 'cap_reached': return 'Пока занято — освободится позже'
    case 'offline': return 'Оффлайн — применим, когда вернётся сеть'
    default: return 'Не получилось — попробуй ещё раз'
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SystemContext — серверное время + оптимистичная мутация
// ════════════════════════════════════════════════════════════════════════════

/**
 * Создаёт `SystemContext` поверх стора + адаптера.
 *
 * `applyMutation`:
 *   1) применяет optimistic-патч (если система его дала) и запоминает inverse;
 *   2) оффлайн → держим оптимистику, возвращаем `offline` (очередь/дренаж — зона `net`);
 *   3) online → dispatch к адаптеру; успех → перечитываем снапшоты (истина сервера) в стор;
 *   4) отказ → откат inverse + тёплый тост, возвращаем ошибку системе (она решает дальше).
 */
export function createSystemContext(adapter: BackendAdapter): SystemContext {
  const serverNow = (): EpochMs => useStore.getState().serverNow()

  async function applyMutation<T>(
    kind: MutationKind,
    payload: unknown,
    optimistic?: () => () => void,
  ): Promise<RpcResult<T>> {
    const store = useStore.getState()
    const inverse = optimistic ? optimistic() : undefined

    if (!store.net.online) {
      // Оптимистику оставляем; истинный дренаж очереди — зона net (net/queue.ts).
      return { ok: false, error: { code: 'offline', message: warmError('offline') } }
    }

    const res = await dispatch(adapter, kind, payload)
    if (res.ok) {
      await hydrateAll(adapter)
      return res as RpcResult<T>
    }

    if (inverse) inverse()
    const now = Date.now()
    useStore.getState().pushToast({
      id: `mut-${kind}-${now}`,
      kind: res.error.code === 'conflict' ? 'warn' : 'info',
      message: warmError(res.error.code),
      createdAt: now,
      ttlMs: 3200,
    })
    return res as RpcResult<T>
  }

  return { adapter, serverNow, applyMutation }
}

// ════════════════════════════════════════════════════════════════════════════
// Фабрика всех систем движка (для DI-провайдеров)
// ════════════════════════════════════════════════════════════════════════════

export interface AppSystems {
  farm: FarmSystem
  animals: AnimalSystem
  craft: CraftSystem
  fair: FairSystem
  contest: ContestSystem
  shift: ShiftSystem
  event: EventSystem
  progression: ProgressionSystem
  collection: CollectionSystem
  monetization: MonetizationSystem
  expedition: ExpeditionSystem
  inventory: InventorySystem
  coop: CoopSystem
  social: SocialSystem
  mailForaging: MailForagingSystem
}

/**
 * Собирает все системы поверх одного `SystemContext`.
 *
 * `CoopSystem`/`SocialSystem` не имеют фабрик в `engine/` (нет доменной логики сверх
 * прямого RPC) — тонкие обёртки над `ctx.applyMutation` живут здесь, в композиции.
 */
export function createSystems(ctx: SystemContext): AppSystems {
  const craft = createCraftSystem(ctx, {
    getMachine: (id: UUID) => useStore.getState().farm?.machines.find((m) => m.id === id),
    getInventoryQty: (key: ProductKey) => useStore.getState().inventory?.items[key] ?? 0,
  })

  const coop: CoopSystem = {
    contribute: (orderId, itemKey, qty) =>
      ctx.applyMutation('coop_contribute', { orderId, itemKey, qty }),
    potluck: (weekIndex, itemKey, qty) =>
      ctx.applyMutation('potluck_contribute', { weekIndex, itemKey, qty }),
  }

  const social: SocialSystem = {
    help: (targetId, actionType) => ctx.applyMutation('help_neighbor', { targetId, actionType }),
    gift: (toId, itemKey, qty) => ctx.applyMutation('gift_send', { toId, itemKey, qty }),
    sit: (hostId) => ctx.applyMutation('neighbor_sit', { hostId }),
    chat: (channel, body, stickerKey) => ctx.applyMutation('chat_post', { channel, body, stickerKey }),
  }

  // `MailForagingSystem` тоже без доменной логики сверх RPC (order/speedup/claim — почта
  // каталогом; forageClaim/forageCollect — обочина, mech_foraging; fish — рыбалка) — тонкая
  // обёртка здесь же (adapter-seams: реальный RPC для `scene/town` вместо локального тоста).
  const mailForaging: MailForagingSystem = {
    order: (itemKey) => ctx.applyMutation('mail_order', { itemKey }),
    speedup: (orderId) => ctx.applyMutation('mail_speedup', { orderId }),
    claim: (orderIds) => ctx.applyMutation('mail_claim', { orderIds }),
    forageClaim: (pointId) => ctx.applyMutation('forage_claim', { pointId }),
    forageCollect: (pointId) => ctx.applyMutation('forage_collect', { pointId }),
    fish: () => ctx.applyMutation('fish_cast', {}),
  }

  return {
    farm: createFarmSystem(ctx),
    animals: createAnimalSystem(ctx),
    craft,
    fair: createFairSystem(ctx),
    contest: createContestSystem(ctx),
    shift: createShiftSystem(ctx),
    event: createEventSystem(ctx),
    progression: createProgressionSystem(ctx),
    collection: createCollectionSystem(ctx),
    monetization: createMonetizationSystem(ctx),
    expedition: createExpeditionSystem(ctx),
    inventory: createInventorySystem(),
    coop,
    social,
    mailForaging,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Гидрация слайсов из снапшотов адаптера (истина сервера → стор-кэш)
// ════════════════════════════════════════════════════════════════════════════

/** Тихо разворачивает RpcResult: применяет `apply(data)` только при ok (иначе no-op). */
async function pull<T>(p: Promise<RpcResult<T>>, apply: (data: T) => void): Promise<void> {
  try {
    const r = await p
    if (r.ok) apply(r.data)
  } catch {
    /* сеть моргнула — оставляем прошлый кэш, ресинк позже (net-зона) */
  }
}

/**
 * Перечитывает все снапшоты и накатывает в стор. Вызывается на бутстрапе и после каждой
 * подтверждённой мутации (истина сервера). Дёшево для local; для supabase net-зона
 * заменит это на точечный дельта-ресинк по каналам.
 */
export async function hydrateAll(adapter: BackendAdapter): Promise<void> {
  const s = useStore.getState()
  await Promise.all([
    pull(adapter.getWallet(), s.setWallet),
    pull(adapter.getFarm(), s.setFarm),
    pull(adapter.getInventory(), s.setInventory),
    pull(adapter.getCalendar(), s.setCalendar),
    pull(adapter.getDemandBoard(), s.setDemand),
    pull(adapter.getFairStall(), s.setStall),
    pull(adapter.getContests(), s.setContests),
    pull(adapter.getEvent(), s.setEvent),
    pull(adapter.getProgression(), s.setProgression),
    pull(adapter.getCollections(), s.setCollections),
    pull(adapter.getTown(), (town) => {
      s.setTown(town)
      s.setCoopOrders(town.coopOrders)
      if (town.potluck) s.setPotluck(town.potluck)
    }),
  ])
  // Свежий срез мира → лента уведомлений (rollover/вехи котла/вымпел). Diff — чистый.
  noteHydration()
}

// ════════════════════════════════════════════════════════════════════════════
// Бутстрап (21-client §3.2, шаги 2–6) — вызывается композицией (App.tsx)
// ════════════════════════════════════════════════════════════════════════════

/** Кол-во сэмплов get_server_time для медианного serverOffset (сглаживаем джиттер). */
const CLOCK_SAMPLES = 3

/** Замер serverOffset по нескольким сэмплам (медиана) → clock-слайс. */
async function syncClock(adapter: BackendAdapter): Promise<void> {
  const offsets: number[] = []
  for (let i = 0; i < CLOCK_SAMPLES; i++) {
    const r = await adapter.getServerTime()
    if (r.ok) offsets.push(r.data.serverNow - Date.now())
  }
  if (offsets.length === 0) return
  offsets.sort((a, b) => a - b)
  const median = offsets[Math.floor(offsets.length / 2)] ?? 0
  useStore.getState().setServerOffset(median)
}

let bootstrapped = false
let notifUnsubscribe: (() => void) | null = null
let clockUnsubscribe: (() => void) | null = null

/**
 * Подписка на изменение `clock.serverOffset` → перегидрация слайсов истиной адаптера.
 *
 * ЗАЧЕМ: DevTimeskip двигает `serverOffset`, а локальный бэкенд читает тот же оффсет как
 * свои часы (net/index.ts) — грядки/крафт/котёл дозревают. Чтобы стор увидел это сразу
 * (а не только при следующей мутации), слушаем оффсет и перечитываем снапшоты. Подписка
 * ставится ПОСЛЕ первичного `syncClock` (см. bootstrap), поэтому первичный замер её не
 * триггерит — фаер только на последующих сдвигах (dev-таймскип/ресинк на реконнекте).
 */
function subscribeClockResync(adapter: BackendAdapter): void {
  if (clockUnsubscribe) return
  clockUnsubscribe = useStore.subscribe(
    (s) => s.clock.serverOffset,
    () => {
      if (useStore.getState().net.online) void hydrateAll(adapter)
    },
  )
}

/**
 * Полный бутстрап приложения: init → ensureSession → serverOffset → гидрация → online.
 * Идемпотентен (StrictMode монтирует эффекты дважды в dev — второй вызов no-op).
 */
export async function bootstrap(): Promise<BackendAdapter> {
  const adapter = getAdapter()
  if (bootstrapped) return adapter
  bootstrapped = true

  // Событийный канал → лента уведомлений/тосты (S4, 19-ui-ux §3.1): local эмитит по
  // своим тикам, supabase — по Realtime CDC. Один раз на бутстрапе, живёт всё приложение.
  notifUnsubscribe = subscribeNotifications(adapter)

  await adapter.init()

  const session = await adapter.ensureSession()
  if (session.ok) {
    // Полную identity добираем best-effort из town-снапшота (streetId/displayName).
    const town = await adapter.getTown()
    if (town.ok) {
      const me = town.data.roster.find((r) => r.userId === session.data.userId)
      useStore.getState().setIdentity({
        userId: session.data.userId,
        farmId: me?.farmId ?? session.data.userId,
        streetId: me?.streetId ?? town.data.streets[0]?.id ?? '',
        townId: town.data.townId,
        displayName: me?.displayName ?? 'Player',
        authStatus: adapter.kind === 'local' ? 'guest' : 'anon',
      })
    }
  }

  await syncClock(adapter)
  // Оффсет уже выставлен — теперь слушаем ПОСЛЕДУЮЩИЕ сдвиги (DevTimeskip) для ресинка.
  subscribeClockResync(adapter)
  await hydrateAll(adapter)
  useStore.getState().markSynced(Date.now())

  return adapter
}

/** Сброс синглтона/флага (тесты). */
export function __resetBackendForTests(): void {
  notifUnsubscribe?.()
  notifUnsubscribe = null
  clockUnsubscribe?.()
  clockUnsubscribe = null
  adapterSingleton = null
  bootstrapped = false
}
