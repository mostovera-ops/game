/**
 * engine/contracts.ts — интерфейсы систем-модулей и BackendAdapter.
 *
 * ЗАЧЕМ: единая точка сопряжения между `state/` (сторы), будущими системами
 * (`engine/<system>/`) и `net/` (адаптеры). Модуль знает ТОЛЬКО контракт соседа,
 * не его внутренности (AGENTS.md — правила импортов).
 *
 * АНТИ-ЧИТ (21-client §3.5, 20-backend §3.7): все мутации проходят через
 * BackendAdapter. Клиент НЕ считает результат сам — применяет оптимистичный патч
 * для мгновенности, но истину берёт из ответа адаптера (сервер реконструирует).
 *
 * ГРАНИЦА: этот файл импортирует только `@/types`. Ноль three / @react-three / react.
 */

import type {
  RpcResult,
  EpochMs,
  UUID,
  Quality,
  Result,
  // reads
  Wallet,
  FarmSnapshot,
  InventorySnapshot,
  ProductKey,
  StorageKind,
  StorageLimits,
  ServerCalendar,
  DemandBoard,
  TownSnapshot,
  Stall,
  Contest,
  EventSnapshot,
  ProgressionSnapshot,
  CollectionsSnapshot,
  MailForagingSnapshot,
  ExpeditionsSnapshot,
  // net
  RealtimeChannelKind,
  MutationKind,
  // econ inputs
  SaturationInput,
  DimeSpeedupInput,
  FarmValueAxes,
  // rpc payloads/results
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
  ForageClaimReq, ForageCollectReq, ForageRes, FishCastReq, FishCastRes,
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

// ════════════════════════════════════════════════════════════════════════════
// BackendAdapter — единственный шлюз к серверу.
// ════════════════════════════════════════════════════════════════════════════

/** Какая реализация активна. */
export type BackendAdapterKind = 'local' | 'supabase'

/** Отписка от Realtime-канала. */
export type Unsubscribe = () => void

/** Хэндлер входящего Realtime-патча (сырой payload строки; слайс сам мапит). */
export type RealtimeHandler = (payload: unknown) => void

/**
 * BackendAdapter — контракт бэкенда. ДВЕ будущие реализации:
 *   1) LocalBackendAdapter    (net/adapters/local.ts)    — эмуляция в браузере,
 *      персист в IndexedDB, детерминированные таймеры. Для dev/оффлайна/тестов.
 *   2) SupabaseBackendAdapter (net/adapters/supabase.ts) — реальные RPC/Edge/Realtime.
 *
 * Обе реализуют ОДИН этот интерфейс. Выбор — `createBackendAdapter(kind)` (net/index.ts),
 * по `import.meta.env.VITE_BACKEND_ADAPTER` (default 'local' если нет URL).
 *
 * Все мутации возвращают RpcResult<T>. При оффлайне адаптер кладёт мутацию в очередь
 * и возвращает { ok:false, error:{ code:'offline' } } — слайс держит оптимистичный патч.
 */
export interface BackendAdapter {
  readonly kind: BackendAdapterKind

  // ── Жизненный цикл / сессия / часы ──
  init(): Promise<void>
  dispose(): Promise<void>
  /** Анонимная сессия или magic-link (20-backend; 21-client §8 п.7 — готовы к обоим). */
  ensureSession(): Promise<RpcResult<{ userId: UUID }>>
  /** get_server_time (21-client §3.6/§8 п.1) — замер serverOffset. */
  getServerTime(): Promise<RpcResult<{ serverNow: EpochMs }>>

  // ── Чтения-снапшоты (первичная гидрация слайсов, REST) ──
  getWallet(): Promise<RpcResult<Wallet>>
  getFarm(): Promise<RpcResult<FarmSnapshot>>
  getInventory(): Promise<RpcResult<InventorySnapshot>>
  getCalendar(): Promise<RpcResult<ServerCalendar>>
  getDemandBoard(): Promise<RpcResult<DemandBoard>>
  getTown(): Promise<RpcResult<TownSnapshot>>
  getFairStall(): Promise<RpcResult<Stall>>
  getContests(): Promise<RpcResult<Contest[]>>
  getEvent(): Promise<RpcResult<EventSnapshot>>
  getProgression(): Promise<RpcResult<ProgressionSnapshot>>
  getCollections(): Promise<RpcResult<CollectionsSnapshot>>
  getMailForaging(): Promise<RpcResult<MailForagingSnapshot>>
  getExpeditions(): Promise<RpcResult<ExpeditionsSnapshot>>
  /** Town Browser (12-migration §3.1.3) — города, открытые для переезда. Не часть `TownSnapshot`. */
  listTowns(): Promise<RpcResult<TownListing[]>>

  // ── Realtime (только рассылка, 20-backend §3.5) ──
  subscribe(channel: RealtimeChannelKind, handler: RealtimeHandler): Unsubscribe

  // ── Мутации (RPC 1:1 с 20-backend §3.4.1) ──
  sow(req: SowReq): Promise<RpcResult<SowRes>>
  water(req: WaterReq): Promise<RpcResult<WaterRes>>
  harvest(req: HarvestReq): Promise<RpcResult<HarvestRes>>
  craftStart(req: CraftStartReq): Promise<RpcResult<CraftStartRes>>
  craftCollect(req: CraftCollectReq): Promise<RpcResult<CraftCollectRes>>
  sellToMarket(req: SellToMarketReq): Promise<RpcResult<SellToMarketRes>>
  buildingUpgrade(req: BuildingUpgradeReq): Promise<RpcResult<BuildingUpgradeRes>>

  feedAnimal(req: FeedAnimalReq): Promise<RpcResult<FeedAnimalRes>>
  collectAnimalProduct(req: CollectAnimalProductReq): Promise<RpcResult<CollectAnimalProductRes>>
  renamePet(req: RenamePetReq): Promise<RpcResult<void>>
  affectionGift(req: AffectionGiftReq): Promise<RpcResult<AffectionGiftRes>>

  fairOpen(req: FairOpenReq): Promise<RpcResult<FairOpenRes>>
  fairList(req: FairListReq): Promise<RpcResult<FairListRes>>
  fairTentUpgrade(): Promise<RpcResult<FairTentUpgradeRes>>
  contestEnter(req: ContestEnterReq): Promise<RpcResult<ContestEnterRes>>
  contestVote(req: ContestVoteReq): Promise<RpcResult<void>>
  shiftSubmit(req: ShiftSubmitReq): Promise<RpcResult<ShiftSubmitRes>>

  coopContribute(req: CoopContributeReq): Promise<RpcResult<CoopContributeRes>>
  potluckContribute(req: PotluckContributeReq): Promise<RpcResult<PotluckContributeRes>>
  eventContribute(req: EventContributeReq): Promise<RpcResult<EventContributeRes>>

  helpNeighbor(req: HelpNeighborReq): Promise<RpcResult<void>>
  giftSend(req: GiftSendReq): Promise<RpcResult<void>>
  neighborSit(req: NeighborSitReq): Promise<RpcResult<void>>
  chatPost(req: ChatPostReq): Promise<RpcResult<ChatPostRes>>

  researchStart(req: ResearchStartReq): Promise<RpcResult<ResearchStartRes>>
  staffAssign(req: StaffAssignReq): Promise<RpcResult<void>>
  staffUpgrade(req: StaffUpgradeReq): Promise<RpcResult<StaffUpgradeRes>>

  expeditionStart(req: ExpeditionStartReq): Promise<RpcResult<ExpeditionStartRes>>
  expeditionCollect(req: ExpeditionCollectReq): Promise<RpcResult<ExpeditionCollectRes>>
  mailOrder(req: MailOrderReq): Promise<RpcResult<MailOrderRes>>
  mailSpeedup(req: MailSpeedupReq): Promise<RpcResult<MailSpeedupRes>>
  mailClaim(req: MailClaimReq): Promise<RpcResult<MailClaimRes>>
  forageClaim(req: ForageClaimReq): Promise<RpcResult<ForageRes>>
  forageCollect(req: ForageCollectReq): Promise<RpcResult<ForageRes>>
  fishCast(req: FishCastReq): Promise<RpcResult<FishCastRes>>

  streakCheck(): Promise<RpcResult<StreakCheckRes>>
  streakInsure(): Promise<RpcResult<StreakInsureRes>>
  vacationStart(): Promise<RpcResult<VacationRes>>
  vacationEnd(): Promise<RpcResult<VacationRes>>
  decorPurchase(req: DecorPurchaseReq): Promise<RpcResult<void>>
  decorPlace(req: DecorPlaceReq): Promise<RpcResult<void>>
  neonSave(req: NeonSaveReq): Promise<RpcResult<void>>
  recipeExperiment(req: RecipeExperimentReq): Promise<RpcResult<RecipeExperimentRes>>

  prizePull(req: PrizePullReq): Promise<RpcResult<PrizePullRes>>

  // ── Edge Functions (внешние эффекты/оркестрация, 20-backend §3.4.2) ──
  migrationPropose(req: MigrationProposeReq): Promise<RpcResult<MigrationProposeRes>>
  migrationVote(req: MigrationVoteReq): Promise<RpcResult<MigrationVoteRes>>
  migrateFarm(req: MigrateFarmReq): Promise<RpcResult<MigrateFarmRes>>
  iapVerify(req: IapVerifyReq): Promise<RpcResult<IapVerifyRes>>
  photoUpload(req: PhotoUploadReq): Promise<RpcResult<PhotoUploadRes>>
}

/** Фабрика адаптера (реализуется в net/index.ts). */
export type CreateBackendAdapter = (kind?: BackendAdapterKind) => BackendAdapter

// ════════════════════════════════════════════════════════════════════════════
// Системы-модули (engine/<system>/). Оркестрируют «намерение игрока»:
// оптимистичный патч в слайс → мутация через adapter → reconcile.
// Каждая система владеет своей папкой (AGENTS.md — карта владения).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Общий контекст, который получает система при создании: адаптер + доступ к очереди
 * мутаций + текущее серверное время. Конкретную форму store-доступа определяет
 * реализация (замыкание над useStore), здесь — минимальный контракт.
 */
export interface SystemContext {
  adapter: BackendAdapter
  /** serverNow() = Date.now() + serverOffset (единственный источник игрового времени). */
  serverNow(): EpochMs
  /**
   * Единый враппер оптимистичной мутации (21-client §3.5): применяет патч, ставит
   * в очередь, шлёт, reconcile. Возвращает промис подтверждения.
   */
  applyMutation<T>(
    kind: MutationKind,
    payload: unknown,
    optimistic?: () => () => void, // возвращает inverse-патч для отката
  ): Promise<RpcResult<T>>
}

export interface ClockSystem {
  /** Замер serverOffset по N сэмплам get_server_time. */
  sync(): Promise<void>
  serverNow(): EpochMs
  /** Готов ли таймер: serverNow() ≥ readyAt (никогда не начисляет — только «готово?»). */
  isReady(readyAt: EpochMs): boolean
  /** Остаток в мс для отображения (может быть отрицательным до забора). */
  remainingMs(readyAt: EpochMs): number
}

export interface FarmSystem {
  sow(slot: number, seedKey: string): Promise<RpcResult<SowRes>>
  water(plotIds: UUID[]): Promise<RpcResult<WaterRes>>
  harvest(plotIds: UUID[]): Promise<RpcResult<HarvestRes>>
  upgradeBuilding(buildingKey: string): Promise<RpcResult<BuildingUpgradeRes>>
}

export interface CraftSystem {
  start(machineId: UUID, recipeKey: string, batch: number): Promise<RpcResult<CraftStartRes>>
  collect(jobIds: UUID[]): Promise<RpcResult<CraftCollectRes>>
  experiment(inputs: RecipeExperimentReq['inputs']): Promise<RpcResult<RecipeExperimentRes>>
}

export interface AnimalSystem {
  feed(animalIds: UUID[]): Promise<RpcResult<FeedAnimalRes>>
  collect(animalIds: UUID[]): Promise<RpcResult<CollectAnimalProductRes>>
  rename(animalId: UUID, name: string): Promise<RpcResult<void>>
  gift(animalId: UUID, giftKey: string): Promise<RpcResult<AffectionGiftRes>>
}

export interface MarketSystem {
  sell(itemKey: string, qty: number): Promise<RpcResult<SellToMarketRes>>
}

/** Один просроченный/активный стек буфера перелива склада (canon E3, 02-farm §3.11). */
export interface InventoryOverflowEntry {
  id: UUID
  kind: StorageKind
  itemKey: ProductKey
  qty: number
  quality: Quality
  createdAt: EpochMs
  /** createdAt + 24ч (гипотеза, 02-farm §3.11 п.1) — после этого буфер разбирается (Potluck/подарок). */
  expiresAt: EpochMs
}

/**
 * InventorySystem — ЧИСТАЯ логика склада (02-farm §3.11/§4.4): лимиты Silo/Icehouse,
 * стоимость апгрейда, резервирование стока под очереди крафта (не даёт задвоить списание
 * между конкурентными `CraftSystem.start`), буфер перелива при достижении лимита.
 *
 * Сама ёмкость/апгрейд склада — building_upgrade через `FarmSystem.upgradeBuilding`
 * (buildingKey `bld_silo`/`bld_icehouse`); этот контракт — только предсказание/локальная
 * бухгалтерия для UI, истина инвентаря — `InventorySnapshot` с сервера (не ходит в adapter).
 */
export interface InventorySystem {
  /** Ёмкость Silo/Icehouse по уровню построек (§4.4: base + step·(level−1)); general — Infinity. */
  storageLimits(siloLevel: number, icehouseLevel: number): StorageLimits
  /** Стоимость апгрейда склада ДО уровня `level` (§4.4: round(200·1.32^(level−1), −10); level 1 → 0). */
  upgradeCost(level: number): number
  /** Свободное место в хранилище данного вида с учётом уже занятого и резервированного стока. */
  freeCapacity(kind: StorageKind, currentQty: number, limit: number): number
  /** Резервирует `qty` предмета под очередь крафта; `insufficient_stock`, если свободного (не резервированного) стока не хватает. */
  reserve(itemKey: ProductKey, qty: number, availableQty: number): Result<UUID, 'insufficient_stock'>
  /** Освобождает ранее сделанный резерв (id из `reserve`); `false`, если резерв не найден. */
  release(reservationId: UUID): boolean
  /** Суммарно зарезервировано данного предмета прямо сейчас (снижает доступное для трат/повторного резерва). */
  reservedQty(itemKey: ProductKey): number
  /**
   * Кладёт `qty` на склад с учётом лимита: то, что не влезло, уходит в буфер перелива
   * (canon E3) на 24ч без штрафа вместо потери сбора.
   */
  add(
    kind: StorageKind,
    itemKey: ProductKey,
    qty: number,
    quality: Quality,
    currentQty: number,
    limit: number,
    now: EpochMs,
  ): { stored: number; overflow: InventoryOverflowEntry | null }
  /** Все ещё живые (не просроченные) записи буфера перелива. */
  listOverflow(): InventoryOverflowEntry[]
  /** Возвращает и вычищает записи буфера, чей 24ч-таймер истёк к `now` (Potluck/подарок соседям). */
  sweepExpiredOverflow(now: EpochMs): InventoryOverflowEntry[]
}

export interface FairSystem {
  open(stallId: UUID): Promise<RpcResult<FairOpenRes>>
  list(req: FairListReq): Promise<RpcResult<FairListRes>>
  upgradeTent(): Promise<RpcResult<FairTentUpgradeRes>>
}

export interface ShiftSystem {
  /** Стартует смену: серверный seed + startedAt (детерминированная очередь). */
  start(): Promise<RpcResult<{ seed: number; startedAt: EpochMs; durationSec: number }>>
  /** Локальный тик (patience/spawn) — чистая функция от seed/времени, для рендера. */
  tick(elapsedMs: number): void
  /** Итог смены (shift_submit). Сервер реконструирует из фактически списанного стока. */
  submit(req: ShiftSubmitReq): Promise<RpcResult<ShiftSubmitRes>>
}

export interface ContestSystem {
  enter(contestKey: ContestEnterReq['contestKey'], payload: Record<string, unknown>): Promise<RpcResult<ContestEnterRes>>
  vote(contestId: UUID, entryId: UUID): Promise<RpcResult<void>>
}

export interface CoopSystem {
  contribute(orderId: UUID, itemKey: string, qty: number): Promise<RpcResult<CoopContributeRes>>
  potluck(weekIndex: number, itemKey: string, qty: number): Promise<RpcResult<PotluckContributeRes>>
}

export interface EventSystem {
  contribute(itemKey: string, qty: number, channel: 'donate' | 'passive'): Promise<RpcResult<EventContributeRes>>
}

/**
 * TownSystem — переезды (12-migration): Moving Van (Уровень 1), Street Caravan (Уровень 2,
 * `kind:'street_caravan'`), Town Merge (Уровень 3, `kind:'town_merge'`) через один и тот же
 * propose/vote (§3.2/§3.3). `listTowns`/`moveFarm` — чтение Town Browser и исполнение
 * личного переезда (§3.1.3/§3.4).
 */
export interface TownSystem {
  proposeMigration(req: MigrationProposeReq): Promise<RpcResult<MigrationProposeRes>>
  voteMigration(proposalId: UUID, vote: 'yes' | 'no'): Promise<RpcResult<MigrationVoteRes>>
  /** Города, открытые для переезда (Town Browser, §3.1.3) — чтение, без оптимистики. */
  listTowns(): Promise<RpcResult<TownListing[]>>
  /** Исполняет личный Moving Van в `targetTown` (§3.1/§3.4) — квитанция конвертации + кулдаун. */
  moveFarm(targetTown: string): Promise<RpcResult<MigrateFarmRes>>
}

export interface ProgressionSystem {
  research(nodeKey: string): Promise<RpcResult<ResearchStartRes>>
  assignStaff(req: StaffAssignReq): Promise<RpcResult<void>>
  upgradeStaff(staffKey: StaffUpgradeReq['staffKey']): Promise<RpcResult<StaffUpgradeRes>>
  streakCheck(): Promise<RpcResult<StreakCheckRes>>
  streakInsure(): Promise<RpcResult<StreakInsureRes>>
}

export interface ExpeditionSystem {
  start(req: ExpeditionStartReq): Promise<RpcResult<ExpeditionStartRes>>
  collect(expIds: UUID[]): Promise<RpcResult<ExpeditionCollectRes>>
  /** Снапшот роуд-трипа для `ui_expeditions` (чтение по требованию, как `listTowns`). */
  list(): Promise<RpcResult<ExpeditionsSnapshot>>
}

export interface MailForagingSystem {
  order(itemKey: string): Promise<RpcResult<MailOrderRes>>
  speedup(orderId: UUID): Promise<RpcResult<MailSpeedupRes>>
  claim(orderIds: UUID[]): Promise<RpcResult<MailClaimRes>>
  /** Снапшот почты/фуражинга (заказы + точки) по требованию — mail-нет-слайса, панели
   *  каталога/ящика читают отсюда (как `TownSystem.listTowns`), без общей гидрации. */
  snapshot(): Promise<RpcResult<MailForagingSnapshot>>
  forageClaim(pointId: UUID): Promise<RpcResult<ForageRes>>
  forageCollect(pointId: UUID): Promise<RpcResult<ForageRes>>
  /** `hits` — попадания Catch Bar за заброс (0..`FISHING_ATTEMPTS_PER_CAST`); см. `FishCastReq`
   *  докстринг (types/rpc.ts) — анти-чит модификатор шансов, не гарантия редкости. */
  fish(hits: number): Promise<RpcResult<FishCastRes>>
}

export interface CollectionSystem {
  pullPrize(req: PrizePullReq): Promise<RpcResult<PrizePullRes>>
  purchaseDecor(decorKey: string): Promise<RpcResult<void>>
  placeDecor(req: DecorPlaceReq): Promise<RpcResult<void>>
  saveNeon(config: Record<string, unknown>): Promise<RpcResult<void>>
}

export interface MonetizationSystem {
  verifyPurchase(req: IapVerifyReq): Promise<RpcResult<IapVerifyRes>>
}

export interface SocialSystem {
  help(targetId: UUID, actionType: string): Promise<RpcResult<void>>
  gift(toId: UUID, itemKey: string, qty: number): Promise<RpcResult<void>>
  sit(hostId: UUID): Promise<RpcResult<void>>
  chat(channel: string, body: string, stickerKey?: string): Promise<RpcResult<ChatPostRes>>
}

/**
 * EconSystem — ЧИСТЫЕ формулы (14-economy). НЕ ходит в adapter. Только предсказание
 * для UI (показать «примерно $N»), НИКОГДА не источник начисления. Живёт в
 * `engine/econ/`, покрыт vitest ≥90% (21-client §3.10). Детерминирован.
 */
export interface EconSystem {
  /** Множитель перенасыщения S_sat (14-economy). */
  saturation(input: SaturationInput): number
  /** Цена Dimes-ускорения: ceil(0.41 · t^0.53). */
  dimeSpeedupCost(input: DimeSpeedupInput): number
  /** Итоговая цена продажи с учётом demand × saturation × quality. */
  salePrice(basePrice: number, demandMult: number, saturation: number, quality: number): number
  /** Пересчёт агрегата Farm Value (4 оси; Σ косметика+коллекции капится 15%). */
  farmValue(axes: Omit<FarmValueAxes, 'total'>): FarmValueAxes
}
