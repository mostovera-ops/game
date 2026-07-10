/**
 * base.ts — единый исчерпывающий скелет BackendAdapter.
 *
 * ЗАЧЕМ ОДНО МЕСТО: полный список методов держим здесь; local/supabase наследуют
 * и переопределяют по мере имплементации. Object-literal с аннотацией `: BackendAdapter`
 * заставляет TS проверять полноту — забытый метод не соберётся.
 *
 * Все методы пока возвращают `{ ok:false, error:{ code:'unknown', ... } }` (заглушка).
 * Код-агенты волн ниже переопределяют их в local.ts / supabase.ts.
 *
 * ГРАНИЦА: net/ импортирует @/engine (контракт) и @/types. Может импортировать @/state
 * (применять серверные патчи), но НЕ scene/.
 */

import type {
  BackendAdapter,
  BackendAdapterKind,
  RealtimeHandler,
  Unsubscribe,
} from '@/engine/contracts'
import type { RpcResult, RpcErrorCode } from '@/types'

/** Заглушка результата: `{ ok:false }` с указанным кодом. */
export function stubResult<T>(
  code: RpcErrorCode = 'unknown',
  message = 'BackendAdapter method not implemented yet',
): Promise<RpcResult<T>> {
  return Promise.resolve({ ok: false, error: { code, message } })
}

/**
 * Фабрика полного стуб-адаптера. Возвращает объект, реализующий ВЕСЬ контракт.
 * `kind` проставляет реализация (local/supabase).
 */
export function createStubAdapter(kind: BackendAdapterKind): BackendAdapter {
  const noopUnsub: Unsubscribe = () => {}
  return {
    kind,

    // lifecycle / session / clock
    init: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    ensureSession: () => stubResult<{ userId: string }>(),
    getServerTime: () => stubResult<{ serverNow: number }>(),

    // reads
    getWallet: () => stubResult(),
    getFarm: () => stubResult(),
    getInventory: () => stubResult(),
    getCalendar: () => stubResult(),
    getDemandBoard: () => stubResult(),
    getTown: () => stubResult(),
    getFairStall: () => stubResult(),
    getContests: () => stubResult(),
    getEvent: () => stubResult(),
    getProgression: () => stubResult(),
    getCollections: () => stubResult(),
    getMailForaging: () => stubResult(),
    listTowns: () => stubResult(),

    // realtime
    subscribe: (_channel, _handler: RealtimeHandler): Unsubscribe => noopUnsub,

    // mutations
    sow: () => stubResult(),
    water: () => stubResult(),
    harvest: () => stubResult(),
    craftStart: () => stubResult(),
    craftCollect: () => stubResult(),
    sellToMarket: () => stubResult(),
    buildingUpgrade: () => stubResult(),

    feedAnimal: () => stubResult(),
    collectAnimalProduct: () => stubResult(),
    renamePet: () => stubResult<void>(),
    affectionGift: () => stubResult(),

    fairOpen: () => stubResult(),
    fairList: () => stubResult(),
    fairTentUpgrade: () => stubResult(),
    contestEnter: () => stubResult(),
    contestVote: () => stubResult<void>(),
    shiftSubmit: () => stubResult(),

    coopContribute: () => stubResult(),
    potluckContribute: () => stubResult(),
    eventContribute: () => stubResult(),

    helpNeighbor: () => stubResult<void>(),
    giftSend: () => stubResult<void>(),
    neighborSit: () => stubResult<void>(),
    chatPost: () => stubResult(),

    researchStart: () => stubResult(),
    staffAssign: () => stubResult<void>(),
    staffUpgrade: () => stubResult(),

    expeditionStart: () => stubResult(),
    expeditionCollect: () => stubResult(),
    mailOrder: () => stubResult(),
    mailSpeedup: () => stubResult(),
    mailClaim: () => stubResult(),
    forageClaim: () => stubResult(),
    forageCollect: () => stubResult(),
    fishCast: () => stubResult(),

    streakCheck: () => stubResult(),
    streakInsure: () => stubResult(),
    vacationStart: () => stubResult(),
    vacationEnd: () => stubResult(),
    decorPurchase: () => stubResult<void>(),
    decorPlace: () => stubResult<void>(),
    neonSave: () => stubResult<void>(),
    recipeExperiment: () => stubResult(),

    prizePull: () => stubResult(),

    // edge
    migrationPropose: () => stubResult(),
    migrationVote: () => stubResult(),
    migrateFarm: () => stubResult(),
    iapVerify: () => stubResult(),
    photoUpload: () => stubResult(),
  }
}
