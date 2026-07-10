/**
 * engine/mail-foraging/constants.ts — мастер-числа каталога почтой + фуражинга
 * (08-mail-foraging.md). Все значения — ИЗ СПЕКИ (раздел указан у каждой группы),
 * большинство помечено спекой `(гипотеза)` до калибровки `14-economy.md` — здесь
 * воспроизведены дословно; при расхождении спека/`14-economy.md` — истина, эти
 * константы обновляются, но НЕ формулы (`delivery.ts`/`rotation.ts`/`forage.ts`).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net/state — чистые данные, node-тестируемо.
 */

export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

// ── Mail Catalog — ротация (§3.1.2/§4.1) ──────────────────────────────────────
export const CATALOG_ROTATION_PERIOD_DAYS = 7
export const CATALOG_POSITIONS_TOTAL = 12

export type CatalogCategory = 'rare_seeds' | 'decor' | 'tools'

export const CATALOG_POSITIONS_BY_CATEGORY: Record<CatalogCategory, number> = {
  rare_seeds: 5,
  decor: 4,
  tools: 3,
}

/** Лимит заказа на игрока за окно ротации (неделя), по категории (§3.1.2/§4.1). */
export const WEEKLY_ORDER_LIMIT_BY_CATEGORY: Record<CatalogCategory, number> = {
  rare_seeds: 3,
  decor: 1,
  tools: 5,
}

/** Гарантия разнообразия тиров среди Rare Seeds (§3.1.6): мин.1 T3, мин.1 T4–T5. */
export const RARE_SEEDS_MIN_T3 = 1
export const RARE_SEEDS_MIN_T4_T5 = 1

/** Anti-repeat: позиция прошлой недели не может повториться (кулдаун ≥1 неделя, §3.1.6). */
export const ROTATION_ANTI_REPEAT_WEEKS = 1

/** «Last Call» — 2 позиции ротации с таймером 48ч до конца недели (§3.1.2). */
export const LAST_CALL_POSITIONS = 2
export const LAST_CALL_WINDOW_MS = 48 * HOUR_MS

// ── Mail Catalog — доставка (§3.1.3/§4.1) ─────────────────────────────────────
export const DELIVERY_DELAY_HOURS_BY_CATEGORY: Record<CatalogCategory, number> = {
  rare_seeds: 20,
  decor: 16,
  tools: 8,
}

/** Ускорение доставки за ◉: 1 за каждые начатые 4ч оставшегося времени, кап ◉5/заказ (§3.1.3). */
export const DIMES_PER_STARTED_HOURS = 4
export const MAIL_SPEEDUP_DIMES_CAP = 5

/** Максимум заказов «в пути» одновременно на игрока (§3.1.3). */
export const MAX_ORDERS_IN_TRANSIT = 5

// ── Foraging — типы точек (§3.2.1/§3.2.2/§3.2.3/§3.2.6) ───────────────────────
/**
 * Собственный тип модуля: `@/types/mail-foraging.ts` (`ForageKind`, стабильный
 * общий тип — AGENTS.md §2 «общие файлы меняются только по согласованию») не
 * покрывает 1:1 все 4 типа точек спеки 08 (в частности нет `wild_beehive`, а
 * `for_fishing` в контрактах — отдельный поток `fishCast()`/`FishCatch`, не
 * `ForagePoint`). TODO(architecture, cross-team): свести `ForageKind` со спекой
 * 08 §3.2.1, если/когда заводится PR в canon. До тех пор чистая математика
 * пулов/лимитов этого модуля использует собственный локальный ключ ниже —
 * не строит компиляционную зависимость от возможно устаревшего `ForageKind`.
 */
export type ForagePointKind = 'mushroom' | 'berry' | 'wild_beehive' | 'fishing'

export const FORAGE_KINDS: readonly ForagePointKind[] = ['mushroom', 'berry', 'wild_beehive', 'fishing']

/** Респавн точек и сброс личных лимитов — ежедневно 06:00 UTC (§3.2.2/§3.2.3). */
export const FORAGE_RESPAWN_HOUR_UTC = 6
export const FORAGE_RESPAWN_OFFSET_MS = FORAGE_RESPAWN_HOUR_UTC * HOUR_MS

/** Инстансов данного типа на Город (§3.2.6). Wild Beehive: +1 после `tp_water_tower`. */
export const INSTANCES_PER_TOWN: Record<ForagePointKind, number> = {
  mushroom: 6,
  berry: 10,
  wild_beehive: 4,
  fishing: 3,
}
export const WATER_TOWER_EXTRA_BEEHIVE = 1

/** Личный дневной лимит сборов/забросов на игрока, суммарно по типу (не по инстансу), §3.2.3. */
export const PERSONAL_DAILY_LIMIT: Record<ForagePointKind, number> = {
  mushroom: 8,
  berry: 12,
  wild_beehive: 5,
  fishing: 6,
}

/** Общий пул объёма на инстанс/день (§3.2.2, расчёт по DAU/охвату утренней волны). */
export const POOL_PER_INSTANCE_PER_DAY: Record<ForagePointKind, number> = {
  mushroom: 40,
  berry: 36,
  wild_beehive: 40,
  fishing: 60, // ограничивает число ЗАБРОСОВ (не уловов) на инстанс/день
}

/** Шанс редкого Truffle на сбор Mushroom Patch (§3.2.5/§4.1). */
export const TRUFFLE_CHANCE = 0.05

// ── Fishing mini-game (§3.2.4/§4.1) ───────────────────────────────────────────
export const FISHING_ATTEMPTS_PER_CAST = 3
/** Ширина зелёной зоны Catch Bar, база (§3.2.4/§4.1). */
export const CATCH_BAR_GREEN_ZONE_WIDTH_BASE = 0.30
/** Шанс Legend Fish на заброс — независимый ролл, не подменяет обычный улов (§3.2.4). */
export const LEGEND_FISH_CHANCE = 0.02

export type CatchRarity = 'common' | 'good' | 'prime'

/** Редкость улова — детерминированно числом попаданий за 3 попытки (§3.2.4 п.5). */
export const CATCH_RARITY_BY_HITS: Record<number, CatchRarity> = {
  0: 'common',
  1: 'good',
  2: 'prime',
  3: 'prime',
}

/** Bamboo/Steel/Chrome — косметические удочки, малый бонус к ширине зоны (§3.2.7). */
export const FISHING_ROD_ZONE_BONUS: readonly number[] = [0, 0.05, 0.10] // индекс = tier удочки (0 Bamboo..2 Chrome)
