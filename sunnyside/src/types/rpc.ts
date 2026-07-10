/**
 * rpc.ts — типизированные payload'ы и результаты RPC/Edge (20-backend §3.4.1/§3.4.2).
 * Один интерфейс на действие; BackendAdapter (engine/contracts.ts) реализует их 1:1.
 * Ответ всегда оборачивается в RpcResult<T> (common.ts) — { ok, data?, error? }.
 */

import type { UUID, EpochMs, Quality } from './common'
import type { ProductKey } from './ingredients'
import type { RecipeKey } from './recipes'
import type { MachineJob } from './machines'
import type { Plot } from './farm'
import type { Expedition, StateKey } from './expeditions'
import type { Stall, ShiftLog, ContestKey } from './fair'
import type { Wallet } from './currency'
import type { PrizePullOutcome } from './monetization'
import type { ToySeriesKey } from './collections'
import type { MigrationKind, TownListing } from './town'
import type { FishCatch } from './mail-foraging'
import type { StaffKey } from './progression'
import type { StaffPost } from './machines'

/** Собранный предмет (общий результат сбора). */
export interface CollectedItem {
  key: ProductKey
  qty: number
  quality: Quality
}

// ── Ферма/производство ────────────────────────────────────────────────────────
export interface SowReq { slot: number; seedKey: ProductKey }
export interface SowRes { plot: Plot }

export interface WaterReq { plotIds: UUID[] }
export interface WaterRes { watered: number }

export interface HarvestReq { plotIds: UUID[] }
export interface HarvestRes { items: CollectedItem[] }

export interface CraftStartReq { machineId: UUID; recipeKey: RecipeKey; batch: number }
export interface CraftStartRes { job: MachineJob }

export interface CraftCollectReq { jobIds: UUID[] }
export interface CraftCollectRes { items: CollectedItem[]; masteryDelta: number }

export interface SellToMarketReq { itemKey: ProductKey; qty: number }
export interface SellToMarketRes { revenue: number }

export interface BuildingUpgradeReq { buildingKey: string }
export interface BuildingUpgradeRes { upgradeReadyAt: EpochMs }

// ── Животные ──────────────────────────────────────────────────────────────────
export interface FeedAnimalReq { animalIds: UUID[] }
export interface FeedAnimalRes { fed: number }

export interface CollectAnimalProductReq { animalIds: UUID[] }
export interface CollectAnimalProductRes { items: CollectedItem[] }

export interface RenamePetReq { animalId: UUID; name: string }
export interface AffectionGiftReq { animalId: UUID; giftKey: ProductKey }
export interface AffectionGiftRes { affection: number }

// ── Ярмарка/смена ─────────────────────────────────────────────────────────────
export interface FairOpenReq { stallId: UUID }
export interface FairOpenRes { openedAt: EpochMs }

export interface FairListReq {
  stallId: UUID
  lots: { itemKey: ProductKey; qty: number; quality: Quality; price: number }[]
}
export interface FairListRes { stall: Stall }

export interface FairTentUpgradeRes { stallLevel: number; displaySlots: number }

export interface ContestEnterReq { contestKey: ContestKey; payload: Record<string, unknown> }
export interface ContestEnterRes { entryId: UUID }

export interface ContestVoteReq { contestId: UUID; entryId: UUID }

export interface ShiftSubmitReq { shiftLog: ShiftLog }
export interface ShiftSubmitRes { tips: number; fairScore: number; tickets: number; fp: number }

// ── Кооп/город/ивент ──────────────────────────────────────────────────────────
export interface CoopContributeReq { orderId: UUID; itemKey: ProductKey; qty: number }
export interface CoopContributeRes { progress: number }

export interface PotluckContributeReq { weekIndex: number; itemKey: ProductKey; qty: number }
export interface PotluckContributeRes { totalScore: number }

export interface EventContributeReq {
  itemKey: ProductKey
  qty: number
  channel: 'donate' | 'passive'
}
export interface EventContributeRes {
  meterPct: number
  personalFp: number
  milestonesHit: (25 | 50 | 75 | 100)[]
}

// ── Соц ───────────────────────────────────────────────────────────────────────
export interface HelpNeighborReq { targetId: UUID; actionType: string }
export interface GiftSendReq { toId: UUID; itemKey: ProductKey; qty: number }
export interface NeighborSitReq { hostId: UUID }
export interface ChatPostReq { channel: string; body: string; stickerKey?: string }
export interface ChatPostRes { messageId: UUID }

// ── Прогрессия/стафф ──────────────────────────────────────────────────────────
export interface ResearchStartReq { nodeKey: string }
export interface ResearchStartRes { studyReadyAt: EpochMs }
export interface StaffAssignReq { staffKey: StaffKey; post: StaffPost }
export interface StaffUpgradeReq { staffKey: StaffKey }
export interface StaffUpgradeRes { level: number }

// ── Экспедиции/почта/фуражинг ─────────────────────────────────────────────────
export interface ExpeditionStartReq { stateKey: StateKey; routeSlot: number }
export interface ExpeditionStartRes { expedition: Expedition }
export interface ExpeditionCollectReq { expIds: UUID[] }
export interface ExpeditionCollectRes { items: CollectedItem[] }

export interface MailOrderReq { itemKey: ProductKey }
export interface MailOrderRes { orderId: UUID; deliverAt: EpochMs }
export interface MailSpeedupReq { orderId: UUID }
export interface MailSpeedupRes { deliverAt: EpochMs }
export interface MailClaimReq { orderIds: UUID[] }
export interface MailClaimRes { items: CollectedItem[] }

export interface ForageClaimReq { pointId: UUID }
export interface ForageCollectReq { pointId: UUID }
export interface ForageRes { item: CollectedItem }
export interface FishCastRes { catch: FishCatch }

// ── Стрик/отпуск/декор/секретки ───────────────────────────────────────────────
export interface StreakCheckRes { streakDays: number; state: string }
export interface StreakInsureRes { insuredUntil: EpochMs }
export interface VacationRes { vacationUntil: EpochMs }
export interface DecorPurchaseReq { decorKey: ProductKey }
export interface DecorPlaceReq { decorKey: ProductKey; x: number; z: number; rot: number }
export interface NeonSaveReq { config: Record<string, unknown> }
export interface RecipeExperimentReq { inputs: { key: ProductKey; qty: number }[] }
export interface RecipeExperimentRes { result: RecipeKey | null }

// ── Монетизация/переезды ──────────────────────────────────────────────────────
export interface PrizePullReq { seriesKey: ToySeriesKey; count: number }
export type PrizePullRes = PrizePullOutcome

/** `streetId` — только `kind:'street_caravan'` (12-migration §3.2.1), кворум считается от него. */
export interface MigrationProposeReq { kind: MigrationKind; targetTown: string; streetId?: UUID }
export interface MigrationProposeRes { proposalId: UUID }
export interface MigrationVoteReq { proposalId: UUID; vote: 'yes' | 'no' }
export interface MigrationVoteRes { yes: number; no: number }

/** Список городов для Town Browser (12-migration §3.1.3). Read-снапшот, не мутация. */
export type ListTownsRes = TownListing[]

// ── Edge Functions (внешние эффекты) ──────────────────────────────────────────
export interface IapVerifyReq { provider: string; receipt: string; sku: string }
export interface IapVerifyRes { purchaseId: string; dimes: number }
export interface MigrateFarmReq { targetTown: string }
/**
 * Итог исполнения переезда (12-migration §2.4/§3.4): квитанция конвертации личного
 * вклада в Town Projects старого города → `🎟` Tickets (курс 50:1, кэп 500/переезд) +
 * новый кулдаун Moving Van (§3.1.2).
 */
export interface MigrateFarmRes {
  ticketsAwarded: number
  convertedBucks: number
  /** Остаток вклада свыше кэпа `🎟 500` — не сгорает, доконвертируется при следующем переезде (§3.4). */
  carryoverBucks: number
  cooldownUntil: EpochMs
}
export interface PhotoUploadReq { image: Blob }
export interface PhotoUploadRes { url: string }

/** Ответ get_server_time (требование клиента, 21-client §8 п.1). */
export interface ServerTimeRes { serverNow: EpochMs }

/** Баланс (wallet_get). */
export type WalletRes = Wallet
