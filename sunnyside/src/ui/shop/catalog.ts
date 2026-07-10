/**
 * ui/shop/catalog.ts — read-only lookups поверх контент-каталогов (`@/data/catalogs`)
 * для экранов монетизации (Cosmetics Shop, Route Pass, Prize Machine) + статичные
 * витринные данные (Boosters/Event Bundles/Dimes-пакеты), для которых пока нет
 * отдельного `@/data/catalogs/*` файла (нет закрытой Zod-схемы в `@/data/schema.ts` —
 * общий контракт правится по согласованию, AGENTS.md §2/§3, как `decorItems` уже
 * решил в `cosmetics.ts`). Числа — ДОСЛОВНО из `docs/specs/15-monetization.md`
 * (§3.2/§3.4/§3.5/§9); это контент/презентация, НЕ формулы (AGENTS.md §0.3 — правила
 * баланса живут в `engine/econ`, здесь только каталог того, что показать в карточке).
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ читает @/types и @/data (read-only), ноль
 * three/@react-three/@/net.
 */
import { cosmeticItems } from '@/data/catalogs/cosmetics'
import { passTracks } from '@/data/catalogs/passTracks'
import type { CosmeticItem, PassTrack, PassTierSchema } from '@/data/schema'
import type { z } from 'zod'
import type { CosmeticKey, Locale } from '@/types'
import { COSMETIC_KEYS } from '@/types'

type PassTier = z.infer<typeof PassTierSchema>

// ── Cosmetics Shop (15-monetization.md §3.2) ──────────────────────────────────

const cosmeticsBySet = new Map<CosmeticKey, CosmeticItem[]>(
  COSMETIC_KEYS.map((k) => [k, cosmeticItems.filter((i) => i.setKey === k)]),
)

export function cosmeticsInSet(setKey: CosmeticKey): CosmeticItem[] {
  return cosmeticsBySet.get(setKey) ?? []
}

export function cosmeticSetSumDimes(setKey: CosmeticKey): number {
  return cosmeticsInSet(setKey).reduce((sum, i) => sum + (i.priceDimes ?? 0), 0)
}

/** Full-Set-цена: −20% от суммы врозь, честная скидка (15-monetization §3.2.2). */
export function cosmeticFullSetPriceDimes(setKey: CosmeticKey): number {
  return Math.round(cosmeticSetSumDimes(setKey) * 0.8)
}

export const COSMETIC_SET_LABEL: Record<CosmeticKey, { en: string; ru: string }> = {
  cos_googie: { en: 'Googie', ru: 'Гуги' },
  cos_chrome: { en: 'Chrome', ru: 'Хром' },
  cos_tiki: { en: 'Tiki', ru: 'Тики' },
  cos_xmas_55: { en: 'Xmas-55', ru: 'Рождество-55' },
}

export function cosmeticSetLabel(setKey: CosmeticKey, locale: Locale): string {
  return locale === 'ru' ? COSMETIC_SET_LABEL[setKey].ru : COSMETIC_SET_LABEL[setKey].en
}

export function cosmeticItemLabel(item: CosmeticItem, locale: Locale): string {
  return locale === 'ru' ? item.name.ru : item.name.en
}

// ── Route Pass (15-monetization.md §3.1) ──────────────────────────────────────

/** Текущий (единственный на запуске) сезонный трек — `passTracks[0]` (season 1). */
export function currentPassTrack(): PassTrack | undefined {
  return passTracks.find((t) => t.season === 1) ?? passTracks[0]
}

export function passTierAt(track: PassTrack, tier: number): PassTier | undefined {
  return track.tiers.find((t) => t.tier === tier)
}

/** Уровни-вехи (каждый 5-й, §3.1.2) — обычно только они несут явную награду в каталоге. */
export function isMilestoneTier(tier: number): boolean {
  return tier % 5 === 0
}

export function rewardLabel(reward: PassTier['freeReward'], locale: Locale): string {
  if (!reward) return locale === 'ru' ? '—' : '—'
  switch (reward.kind) {
    case 'currency': {
      const symbol = { bucks: '$', dimes: '◉', tickets: '🎟', ribbons: '🎀' }[reward.currency]
      return `${symbol} ${reward.qty}`
    }
    case 'item':
      return `${reward.itemKey} ×${reward.qty}`
    case 'cosmetic':
      return locale === 'ru' ? `Косметика: ${reward.cosmeticKey}` : `Cosmetic: ${reward.cosmeticKey}`
    case 'toy':
      return locale === 'ru' ? `Игрушка: ${reward.toyKey}` : `Toy: ${reward.toyKey}`
  }
}

/** 200 Miles/уровень (15-monetization.md §3.1.3 — гипотеза, MILES_PER_LEVEL в passTracks.ts). */
export const ROUTE_PASS_MILES_PER_LEVEL = 200
export const ROUTE_PASS_MAX_TIER = 50
/** Цена платного трека (§3.1.1). Открытая-в-любой-момент ретро-покупка (M-E1). */
export const ROUTE_PASS_PREMIUM_PRICE_DIMES = 900
/** Докупка уровня — диапазонная растущая цена (анти-грайнд-гейт, §3.1.5). */
export const ROUTE_PASS_BUYOUT_TIERS = [
  { upTo: 10, priceDimes: 60 },
  { upTo: 25, priceDimes: 90 },
  { upTo: 50, priceDimes: 140 },
] as const

/** Цена докупки ОДНОГО следующего уровня от `currentTier` (§3.1.5 таблица диапазонов). */
export function nextTierBuyoutPriceDimes(currentTier: number): number {
  const target = currentTier + 1
  const row = ROUTE_PASS_BUYOUT_TIERS.find((r) => target <= r.upTo)
  const last = ROUTE_PASS_BUYOUT_TIERS[ROUTE_PASS_BUYOUT_TIERS.length - 1]
  return row?.priceDimes ?? last?.priceDimes ?? 0
}

// ── Boosters (15-monetization.md §3.4) — витринные данные, кэпы — мастер 14-economy §4.7 ──

export type BoosterKey = 'bst_overtime' | 'bst_truck_contract' | 'bst_instant_finish' | 'bst_speedup_1h'

export interface BoosterDef {
  key: BoosterKey
  name: { en: string; ru: string }
  effect: { en: string; ru: string }
  priceDimes: number
  /** Витринный дневной кэп (мастер-число — `14-economy.md §4.7`; здесь только для UI). */
  dailyCap: number
}

export const BOOSTERS: readonly BoosterDef[] = [
  {
    key: 'bst_overtime',
    name: { en: 'Overtime', ru: 'Овертайм станка' },
    effect: { en: '+1 machine slot for 24h', ru: '+1 слот станка на 24 ч' },
    priceDimes: 20,
    dailyCap: 3,
  },
  {
    key: 'bst_truck_contract',
    name: { en: 'Truck Contract', ru: 'Контракт грузовика' },
    effect: { en: '+1 expedition beyond the daily limit', ru: '+1 экспедиция сверх лимита' },
    priceDimes: 35,
    dailyCap: 1,
  },
  {
    key: 'bst_instant_finish',
    name: { en: 'Finish Now', ru: 'Доготовить сейчас' },
    effect: { en: 'Finish 1 plot/machine timer instantly', ru: 'Завершить 1 таймер станка/грядки мгновенно' },
    priceDimes: 8,
    dailyCap: 6,
  },
  {
    key: 'bst_speedup_1h',
    name: { en: 'Speed-Up 1h', ru: 'Ускорить на час' },
    effect: { en: '−1h off a plot/machine timer', ru: '−1 ч с таймера станка/грядки' },
    priceDimes: 5,
    dailyCap: 6,
  },
] as const

// ── Event Bundles (15-monetization.md §3.5) — окно Пт 00:00 → Сб 23:59 UTC ────

export interface BundleDef {
  key: string
  name: { en: string; ru: string }
  contents: { en: string; ru: string }
  valueDimes: number
  priceDimes: number
}

export const EVENT_BUNDLES: readonly BundleDef[] = [
  {
    key: 'bundle_starter_basket',
    name: { en: 'Starter Basket', ru: 'Стартовая корзина' },
    contents: {
      en: '4× Speed-Up (1h) + 2× Finish Now + 1× Overtime',
      ru: '4× ускорение (1ч) + 2× доготовить сейчас + 1× овертайм',
    },
    valueDimes: 140,
    priceDimes: 99,
  },
  {
    key: 'bundle_fairground_kit',
    name: { en: 'Fairground Kit', ru: 'Ярмарочный набор' },
    contents: {
      en: '1× Truck Contract + 2× Overtime + rotating cosmetic accent',
      ru: '1× контракт грузовика + 2× овертайм + косметик-акцент (ротация)',
    },
    valueDimes: 260,
    priceDimes: 199,
  },
  {
    key: 'bundle_patron_crate',
    name: { en: 'Patron Crate', ru: 'Ящик мецената' },
    contents: { en: '10× Prize Machine pulls + season accent + 🎟30', ru: '10 пуллов автомата + сезон-акцент + 🎟 30' },
    valueDimes: 560,
    priceDimes: 399,
  },
  {
    key: 'bundle_weekend_feast',
    name: { en: 'Weekend Feast', ru: 'Уикенд-пир' },
    contents: {
      en: 'weekly exclusive decor + 5× Finish Now + 3× Overtime',
      ru: 'эксклюзив-декор недели + 5× доготовить сейчас + 3× овертайм',
    },
    valueDimes: 720,
    priceDimes: 549,
  },
] as const

// ── Dimes packages (15-monetization.md §9) — единственная реал-покупка ────────

export interface DimesPackageDef {
  sku: string
  name: { en: string; ru: string }
  dimesBase: number
  bonusDimes: number
  priceUsd: number
}

export const DIMES_PACKAGES: readonly DimesPackageDef[] = [
  { sku: 'dimes_handful', name: { en: 'Handful', ru: 'Пригоршня' }, dimesBase: 50, bonusDimes: 0, priceUsd: 0.99 },
  { sku: 'dimes_roll', name: { en: 'Roll', ru: 'Ролик' }, dimesBase: 300, bonusDimes: 20, priceUsd: 4.99 },
  { sku: 'dimes_sack', name: { en: 'Sack', ru: 'Мешочек' }, dimesBase: 650, bonusDimes: 90, priceUsd: 9.99 },
  { sku: 'dimes_crate', name: { en: 'Crate', ru: 'Ящик' }, dimesBase: 1400, bonusDimes: 280, priceUsd: 19.99 },
  { sku: 'dimes_boxcar', name: { en: 'Boxcar', ru: 'Вагон' }, dimesBase: 3600, bonusDimes: 900, priceUsd: 49.99 },
  {
    sku: 'dimes_boxcar_deluxe',
    name: { en: 'Boxcar Deluxe', ru: 'Вагон-люкс' },
    dimesBase: 7800,
    bonusDimes: 2400,
    priceUsd: 99.99,
  },
] as const

export function dimesPackageTotal(pkg: DimesPackageDef): number {
  return pkg.dimesBase + pkg.bonusDimes
}

// ── Prize Machine — цены пуллов (15-monetization.md §3.3.3), обменник (§3.3.4) ──

export const PRIZE_PULL_PRICE_DIMES = 45
export const PRIZE_PULL10_PRICE_DIMES = 400
/** ⚙ Scrap → недостающая фигурка данной редкости (§3.3.4). */
export const SCRAP_EXCHANGE_PRICE = { common: 8, uncommon: 24, rare: 70, chase: 240 } as const
