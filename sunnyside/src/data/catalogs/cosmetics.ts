/**
 * catalogs/cosmetics.ts — контент-каталог косметик-магазина (`ui_cosmetics_shop`,
 * 15-monetization.md §3.2) и каталога декора двора/интерьера (17-collections.md
 * §3.8–§3.10).
 *
 * Два независимых, но тематически связанных набора:
 *
 * 1. `cosmeticItems` (32 SKU, схема `CosmeticItemSchema` из `../schema`, часть
 *    контракта `CONTENT_CATALOGS` — проверяется `validate.test.ts`) — 4 сета
 *    канона (`cos_googie`/`cos_chrome`/`cos_tiki`/`cos_xmas_55`, §3.11) × 8 SKU
 *    (3 Accent `◉80` + 3 Piece `◉220` + 2 Centerpiece `◉480`, 15-monetization
 *    §3.2.2). Full-Set-бандл (−20%, `◉1488`) — это скидочная упаковка тех же
 *    32 SKU, не отдельная запись каталога (§3.2.2 примечание) — цена бандла
 *    считается в econ-слое (14-economy.md), не хранится здесь как SKU.
 *
 * 2. `decorItems` (42 предмета, 17-collections.md §3.9/§3.10) — каталог
 *    декора двора/фасада/интерьера/территории, 4 тематические линии
 *    (Farmhouse/Diner Chrome/Route 66 Roadside/Seasonal & Event). Это НЕ часть
 *    `CONTENT_CATALOGS` (нет отдельной закрытой схемы в `../schema.ts` — общий
 *    файл контрактов правится только по согласованию, AGENTS.md §2/§3) —
 *    валидируется локальной схемой `DecorItemDefSchema` ниже и своим тестом
 *    `catalogs/decor.test.ts`. Предметы #37–42 пересекаются по теме с
 *    косметик-сетами (`cosmeticSetKey`) — это отдельные декор-объекты
 *    («часть» сета по духу, не идентичны SKU из `cosmeticItems`).
 */

import { z } from 'zod'
import { CanonKeySchema, BilingualSchema, CosmeticSetKeySchema } from '../schema'
import type { CosmeticItem } from '../schema'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Косметик-сеты — 32 SKU (CosmeticItemSchema, зарегистрирован в
//    CONTENT_CATALOGS как `cosmeticItems`).
// ─────────────────────────────────────────────────────────────────────────────

export const cosmeticItems: CosmeticItem[] = [
  // ── cos_googie (Гуги) ─────────────────────────────────────────────────────
  {
    key: 'cos_googie_accent_starburst_stars',
    setKey: 'cos_googie',
    name: { en: 'Starburst Boomerang Stars', ru: 'Звёзды-бумеранги «Старберст»' },
    target: 'sign',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_accent_atomic_ball',
    setKey: 'cos_googie',
    name: { en: 'Atomic Ball Ornament', ru: 'Атомный шар-украшение' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_accent_arrow',
    setKey: 'cos_googie',
    name: { en: 'Space-Age Arrow', ru: 'Стрелка «Космическая эра»' },
    target: 'sign',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_piece_carhop_uniform',
    setKey: 'cos_googie',
    name: { en: 'Carhop Uniform', ru: 'Форма «кархоп»' },
    target: 'staff',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_piece_terrazzo_floor',
    setKey: 'cos_googie',
    name: { en: 'Terrazzo Floor Interior', ru: 'Интерьер — пол терраццо' },
    target: 'interior',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_piece_wagon_truck',
    setKey: 'cos_googie',
    name: { en: 'Wagon Truck Skin', ru: 'Скин грузовика-универсала' },
    target: 'truck',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_centerpiece_facade',
    setKey: 'cos_googie',
    name: { en: 'Googie Space-Age Facade', ru: 'Фасад «Googie Space-Age»' },
    target: 'diner',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_googie_centerpiece_neon_parabola',
    setKey: 'cos_googie',
    name: { en: 'Parabola Neon Sign', ru: 'Неон «параболоид»' },
    target: 'sign',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },

  // ── cos_chrome (Хром) ─────────────────────────────────────────────────────
  {
    key: 'cos_chrome_accent_molding',
    setKey: 'cos_chrome',
    name: { en: 'Chrome Molding Trim', ru: 'Хром-молдинг' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_accent_mirror_ball',
    setKey: 'cos_chrome',
    name: { en: 'Mirror Ball Ornament', ru: 'Зеркальный шар' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_accent_emblem',
    setKey: 'cos_chrome',
    name: { en: 'Chrome Emblem', ru: 'Хром-эмблема' },
    target: 'truck',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_piece_mechanic_uniform',
    setKey: 'cos_chrome',
    name: { en: 'Mechanic Uniform', ru: 'Форма механика' },
    target: 'staff',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_piece_steel_stools',
    setKey: 'cos_chrome',
    name: { en: 'Steel Stools Interior', ru: 'Интерьер — стальные табуреты' },
    target: 'interior',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_piece_chrome_truck',
    setKey: 'cos_chrome',
    name: { en: 'Chrome Truck Skin', ru: 'Хром-скин грузовика' },
    target: 'truck',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_centerpiece_facade',
    setKey: 'cos_chrome',
    name: { en: 'Streamline Chrome Facade', ru: 'Фасад «Streamline Chrome»' },
    target: 'diner',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_chrome_centerpiece_neon_liquid',
    setKey: 'cos_chrome',
    name: { en: 'Liquid Chrome Neon Sign', ru: 'Неон «жидкий хром»' },
    target: 'sign',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },

  // ── cos_tiki (Тики) ───────────────────────────────────────────────────────
  {
    key: 'cos_tiki_accent_torches',
    setKey: 'cos_tiki',
    name: { en: 'Tiki Torch Pair', ru: 'Пара факелов тики' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_accent_pineapple_garland',
    setKey: 'cos_tiki',
    name: { en: 'Pineapple Garland', ru: 'Гирлянда-ананасы' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_accent_mask',
    setKey: 'cos_tiki',
    name: { en: 'Tiki Bar Mask', ru: 'Маска тики-бара' },
    target: 'sign',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_piece_aloha_uniform',
    setKey: 'cos_tiki',
    name: { en: 'Aloha Uniform', ru: 'Форма «алоха»' },
    target: 'staff',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_piece_bamboo_interior',
    setKey: 'cos_tiki',
    name: { en: 'Bamboo Interior', ru: 'Интерьер-бамбук' },
    target: 'interior',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_piece_woody_truck',
    setKey: 'cos_tiki',
    name: { en: 'Woody Truck Skin', ru: 'Скин грузовика-вуди' },
    target: 'truck',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_centerpiece_facade',
    setKey: 'cos_tiki',
    name: { en: 'Tiki Lounge Facade', ru: 'Фасад «Tiki Lounge»' },
    target: 'diner',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_tiki_centerpiece_neon_volcano',
    setKey: 'cos_tiki',
    name: { en: 'Blazing Volcano Neon Sign', ru: 'Неон «пылающий вулкан»' },
    target: 'sign',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },

  // ── cos_xmas_55 (Рождество-55) ────────────────────────────────────────────
  {
    key: 'cos_xmas_55_accent_wreath',
    setKey: 'cos_xmas_55',
    name: { en: 'Xmas-55 Wreath', ru: 'Венок «Рождество-55»' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_accent_candy_canes',
    setKey: 'cos_xmas_55',
    name: { en: 'Candy Canes Garland', ru: 'Гирлянда-леденцы' },
    target: 'interior',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_accent_star_garland',
    setKey: 'cos_xmas_55',
    name: { en: 'Xmas-55 String Lights', ru: 'Гирлянда-звёзды «Рождество-55»' },
    target: 'sign',
    priceDimes: 80,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_piece_santa_helper_uniform',
    setKey: 'cos_xmas_55',
    name: { en: 'Santa Helper Uniform', ru: 'Форма «Санта-хелпер»' },
    target: 'staff',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_piece_fireplace_interior',
    setKey: 'cos_xmas_55',
    name: { en: 'Fireplace Interior', ru: 'Интерьер-камин' },
    target: 'interior',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_piece_tree_truck',
    setKey: 'cos_xmas_55',
    name: { en: 'Truck with Tree Skin', ru: 'Скин грузовика-с-ёлкой' },
    target: 'truck',
    priceDimes: 220,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_centerpiece_facade',
    setKey: 'cos_xmas_55',
    name: { en: 'Holiday Diner Facade', ru: 'Фасад «Holiday Diner»' },
    target: 'diner',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },
  {
    key: 'cos_xmas_55_centerpiece_neon_merry55',
    setKey: 'cos_xmas_55',
    name: { en: "Merry '55 Neon Sign", ru: 'Неон «Merry \'55»' },
    target: 'sign',
    priceDimes: 480,
    obtainedVia: 'purchase',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 2. Декор двора/интерьера — каталог запуска, 42 предмета (17-collections.md
//    §3.9/§3.10). Схема локальная (не часть общего `CONTENT_CATALOGS` — см.
//    комментарий в шапке файла); валидируется `catalogs/decor.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/** Тематическая линия декора (17-collections.md §3.10.1–§3.10.4). */
export const DecorLineSchema = z.enum(['farmhouse', 'diner_chrome', 'route66_roadside', 'seasonal_event'])
export type DecorLine = z.infer<typeof DecorLineSchema>

/** Зона размещения (A-слоты MVP, §3.8). */
export const DecorZoneSchema = z.enum(['yard', 'facade', 'interior', 'territory'])
export type DecorZone = z.infer<typeof DecorZoneSchema>

/** Источник получения (§3.9). */
export const DecorSourceSchema = z.enum(['purchase_bucks', 'purchase_dimes', 'achievement', 'event', 'prize_machine'])
export type DecorSource = z.infer<typeof DecorSourceSchema>

export const DecorItemDefSchema = z
  .object({
    /** decor_<line>_<n> — уникальный ключ каталога запуска (не ProductKey ingredients — см. шапку файла). */
    key: CanonKeySchema,
    name: BilingualSchema,
    line: DecorLineSchema,
    zone: DecorZoneSchema,
    source: DecorSourceSchema,
    /** Цена — задаётся ровно одна из двух в зависимости от `source` (см. superRefine ниже). */
    priceBucks: z.number().nonnegative().optional(),
    priceDimes: z.number().int().nonnegative().optional(),
    /** Если предмет тематически совпадает с косметик-сетом (§3.10.4, #37–42). */
    cosmeticSetKey: CosmeticSetKeySchema.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.source === 'purchase_bucks' && item.priceBucks === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${item.key}": purchase_bucks требует priceBucks` })
    }
    if (item.source === 'purchase_dimes' && item.priceDimes === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${item.key}": purchase_dimes требует priceDimes` })
    }
    if (item.source !== 'purchase_bucks' && item.source !== 'purchase_dimes') {
      if (item.priceBucks !== undefined || item.priceDimes !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${item.key}": не-покупной источник (${item.source}) не должен иметь цену`,
        })
      }
    }
  })

export type DecorItemDef = z.infer<typeof DecorItemDefSchema>

export const decorItems: DecorItemDef[] = [
  // ── 3.10.1 Farmhouse (двор, 12 предметов) ─────────────────────────────────
  {
    key: 'decor_farmhouse_picket_fence',
    name: { en: 'Picket Fence Section', ru: 'Секция штакетника' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 120,
  },
  {
    key: 'decor_farmhouse_flower_bed_marigolds',
    name: { en: 'Flower Bed — Marigolds', ru: 'Клумба — бархатцы' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 150,
  },
  {
    key: 'decor_farmhouse_flower_bed_roses',
    name: { en: 'Flower Bed — Roses', ru: 'Клумба — розы' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 220,
  },
  {
    key: 'decor_farmhouse_wooden_bench',
    name: { en: 'Wooden Bench', ru: 'Деревянная скамейка' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 180,
  },
  {
    key: 'decor_farmhouse_mailbox',
    name: { en: 'Rustic Mailbox', ru: 'Почтовый ящик (простой)' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 90,
  },
  {
    key: 'decor_farmhouse_wagon_wheel',
    name: { en: 'Wagon Wheel Decor', ru: 'Декор — колесо телеги' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 200,
  },
  {
    key: 'decor_farmhouse_scarecrow',
    name: { en: 'Scarecrow', ru: 'Пугало' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 160,
  },
  {
    key: 'decor_farmhouse_well',
    name: { en: 'Well Decor', ru: 'Декоративный колодец' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 300,
  },
  {
    key: 'decor_farmhouse_hay_bale_stack',
    name: { en: 'Hay Bale Stack', ru: 'Стог сена (декор)' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 100,
  },
  {
    key: 'decor_farmhouse_rocking_chair',
    name: { en: 'Rocking Chair Porch', ru: 'Кресло-качалка на крыльце' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 210,
  },
  {
    key: 'decor_farmhouse_lantern_post',
    name: { en: 'Lantern Post', ru: 'Фонарный столб' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 170,
  },
  {
    key: 'decor_farmhouse_vegetable_cart',
    name: { en: 'Vegetable Cart Display', ru: 'Витрина-тележка с овощами' },
    line: 'farmhouse',
    zone: 'yard',
    source: 'purchase_bucks',
    priceBucks: 260,
  },

  // ── 3.10.2 Diner Chrome (интерьер, 12 предметов) ──────────────────────────
  {
    key: 'decor_diner_chrome_bar_stool',
    name: { en: 'Chrome Bar Stool', ru: 'Хромированный барный стул' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 140,
  },
  {
    key: 'decor_diner_chrome_checkerboard_floor',
    name: { en: 'Checkerboard Floor Tile Set', ru: 'Чекерборд-пол (набор плитки)' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 350,
  },
  {
    key: 'decor_diner_chrome_jukebox',
    name: { en: 'Classic Jukebox', ru: 'Классический джукбокс' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_dimes',
    priceDimes: 180,
  },
  {
    key: 'decor_diner_chrome_booth_seating',
    name: { en: 'Booth Seating — Red Vinyl', ru: 'Диван-кабинка — красный винил' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 280,
  },
  {
    key: 'decor_diner_chrome_milkshake_counter',
    name: { en: 'Milkshake Counter Display', ru: 'Витрина-стойка с молочными коктейлями' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 240,
  },
  {
    key: 'decor_diner_chrome_wall_clock',
    name: { en: 'Retro Wall Clock', ru: 'Ретро настенные часы' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 110,
  },
  {
    key: 'decor_diner_chrome_neon_open_sign',
    name: { en: 'Neon "Open" Window Sign', ru: 'Неоновая табличка «Open» на окно' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_dimes',
    priceDimes: 60,
  },
  {
    key: 'decor_diner_chrome_napkin_dispenser',
    name: { en: 'Chrome Napkin Dispenser (decor)', ru: 'Хром-салфетница (декор)' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 70,
  },
  {
    key: 'decor_diner_chrome_counter_bell',
    name: { en: 'Diner Counter Bell', ru: 'Колокольчик на стойке' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 60,
  },
  {
    key: 'decor_diner_chrome_menu_board',
    name: { en: 'Framed Menu Board', ru: 'Рамка-меню на стену' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 130,
  },
  {
    key: 'decor_diner_chrome_soda_fountain',
    name: { en: 'Soda Fountain Display', ru: 'Витрина содовой стойки' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 260,
  },
  {
    key: 'decor_diner_chrome_checkered_curtains',
    name: { en: 'Checkered Curtains', ru: 'Клетчатые занавески' },
    line: 'diner_chrome',
    zone: 'interior',
    source: 'purchase_bucks',
    priceBucks: 150,
  },

  // ── 3.10.3 Route 66 Roadside (фасад + территория, 10 предметов) ───────────
  {
    key: 'decor_route66_gas_pump',
    name: { en: 'Roadside Gas Pump Replica', ru: 'Реплика бензоколонки' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_bucks',
    priceBucks: 400,
  },
  {
    key: 'decor_route66_shield_sign',
    name: { en: 'Route 66 Shield Sign', ru: 'Знак-щит «Route 66»' },
    line: 'route66_roadside',
    zone: 'facade',
    source: 'purchase_bucks',
    priceBucks: 180,
  },
  {
    key: 'decor_route66_vintage_truck',
    name: { en: 'Vintage Truck Decor', ru: 'Декоративный винтажный грузовик' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_dimes',
    priceDimes: 220,
  },
  {
    key: 'decor_route66_awning_striped',
    name: { en: 'Awning — Striped', ru: 'Полосатая маркиза' },
    line: 'route66_roadside',
    zone: 'facade',
    source: 'purchase_bucks',
    priceBucks: 200,
  },
  {
    key: 'decor_route66_window_flower_box',
    name: { en: 'Window Flower Box', ru: 'Оконный ящик с цветами' },
    line: 'route66_roadside',
    zone: 'facade',
    source: 'purchase_bucks',
    priceBucks: 100,
  },
  {
    key: 'decor_route66_welcome_doormat',
    name: { en: 'Welcome Doormat', ru: 'Коврик у входа «Welcome»' },
    line: 'route66_roadside',
    zone: 'facade',
    source: 'purchase_bucks',
    priceBucks: 50,
  },
  {
    key: 'decor_route66_drivein_speaker_post',
    name: { en: 'Drive-in Speaker Post', ru: 'Столб-динамик автокино (декор)' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_bucks',
    priceBucks: 230,
  },
  {
    key: 'decor_route66_checkerboard_walkway',
    name: { en: 'Checkerboard Walkway', ru: 'Чекерборд-дорожка' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_bucks',
    priceBucks: 260,
  },
  {
    key: 'decor_route66_campfire_pit',
    name: { en: 'Campfire Pit', ru: 'Костровая яма' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_bucks',
    priceBucks: 220,
  },
  {
    key: 'decor_route66_mascot_statue_cow',
    name: { en: 'Mascot Statue — Cow', ru: 'Статуя-маскот — корова' },
    line: 'route66_roadside',
    zone: 'territory',
    source: 'purchase_dimes',
    priceDimes: 150,
  },

  // ── 3.10.4 Seasonal & Event (сезонные, 8 предметов, источник — не покупка) ─
  {
    key: 'decor_seasonal_harvest_cornucopia',
    name: { en: 'Harvest Cornucopia Display', ru: 'Витрина «рог изобилия»' },
    line: 'seasonal_event',
    zone: 'interior',
    source: 'event',
  },
  {
    key: 'decor_seasonal_drivein_movie_screen',
    name: { en: 'Drive-in Movie Screen Mini', ru: 'Мини-экран автокино' },
    line: 'seasonal_event',
    zone: 'territory',
    source: 'event',
  },
  {
    key: 'decor_seasonal_xmas55_wreath',
    name: { en: 'Xmas-55 Wreath (decor)', ru: 'Венок «Рождество-55» (декор)' },
    line: 'seasonal_event',
    zone: 'facade',
    source: 'achievement',
    cosmeticSetKey: 'cos_xmas_55',
  },
  {
    key: 'decor_seasonal_xmas55_string_lights',
    name: { en: 'Xmas-55 String Lights (decor)', ru: 'Гирлянда «Рождество-55» (декор)' },
    line: 'seasonal_event',
    zone: 'facade',
    source: 'achievement',
    cosmeticSetKey: 'cos_xmas_55',
  },
  {
    key: 'decor_seasonal_tiki_torch_pair',
    name: { en: 'Tiki Torch Pair (decor)', ru: 'Пара факелов тики (декор)' },
    line: 'seasonal_event',
    zone: 'yard',
    source: 'achievement',
    cosmeticSetKey: 'cos_tiki',
  },
  {
    key: 'decor_seasonal_tiki_bar_mask',
    name: { en: 'Tiki Bar Mask (decor)', ru: 'Маска тики-бара (декор)' },
    line: 'seasonal_event',
    zone: 'interior',
    source: 'achievement',
    cosmeticSetKey: 'cos_tiki',
  },
  {
    key: 'decor_seasonal_googie_starburst_sign',
    name: { en: 'Googie Starburst Sign', ru: 'Вывеска-старберст «Гуги»' },
    line: 'seasonal_event',
    zone: 'facade',
    source: 'prize_machine',
    cosmeticSetKey: 'cos_googie',
  },
  {
    key: 'decor_seasonal_chrome_rocket_fin',
    name: { en: 'Chrome Rocket Fin Decor', ru: 'Декор — хромовый плавник ракеты' },
    line: 'seasonal_event',
    zone: 'yard',
    source: 'prize_machine',
    cosmeticSetKey: 'cos_chrome',
  },
]
