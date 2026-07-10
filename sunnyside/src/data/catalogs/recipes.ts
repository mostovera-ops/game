/**
 * catalogs/recipes.ts — контент-каталог рецептов кухни (06-recipes.md, §4).
 *
 * Экспорты:
 *   - `recipes` (обязательный, CONTENT_CATALOGS/RecipeSchema): bridge-полуфабрикаты
 *     (уже зарегистрированы в `catalogs/ingredients.ts` — БЛОК A) + новые полуфабрикаты
 *     этой спеки, которых там ещё нет (БЛОК B) + 112 блюд каталога (§4.2) + 22 секретных
 *     рецепта-эксперимента (§4.5). ~153 Recipe Card суммарно.
 *   - `bluePlateSets` (BluePlateSchema): 34 сета Blue Plate Special (§4.4).
 *   - `recipeCatalogMeta` / `secretRecipeCatalogMeta`: цена + категория спроса продаваемого
 *     выхода — `RecipeSchema` намеренно не несёт `basePrice`/`demandCategory` (те поля
 *     принадлежат `IngredientSchema` итогового товара, см. докстринг schema.ts); этот
 *     каталог хранит их отдельно как мост, пока `catalogs/ingredients.ts` не заведёт
 *     собственные `dish_*` записи для готовых блюд.
 *   - `RECIPE_MASTERY_CURVE`: единственный источник истины по шкале mastery ★1–★5 (R18,
 *     §3.3) — общая для всех рецептов кривая %-бонусов ко времени/цене.
 *
 * R20 (docs/specs/OPEN-QUESTIONS.md, 04-machines.md §3.5/§4.4): базовая Мука (`ingr_flour`,
 * «Hand-Ground Flour») обязана быть доступна с MVP на Oven, а не гейтиться за Mill v0.2 —
 * иначе весь ранний ряд выпечки недостижим. Реализовано ниже как первая запись БЛОКа A:
 * `ingr_flour`, unlock:'starter', Wheat×2, 5 мин — Mill (`mch_mill`, уже в machines.ts)
 * остаётся отдельным эффективностным апгрейдом вне зоны этого каталога (партии ×4, v0.2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * ВАЖНО — согласование с параллельно написанными `catalogs/ingredients.ts` (05-ingredients.md)
 * и `catalogs/machines.ts` (04-machines.md), обнаруженное при сборке этого файла:
 * ══════════════════════════════════════════════════════════════════════════════════
 *
 * 1) Станки — реальные ключи из `catalogs/machines.ts` (`mch_*`, НЕ черновой `st_*` из
 *    06-recipes.md §3.1, который и так конфликтовал с `StateKey`). Соответствие:
 *      Grill→mch_grill, Bake Oven→mch_oven, Butter Churn→mch_churn,
 *      Soda Fountain→mch_soda_fountain, Ice Cream Maker→mch_ice_cream,
 *      Coffee Machine→mch_coffee, Fryer→mch_fryer, Smoker→mch_smoker.
 *    `Stockpot` (06-recipes.md «Кастрюля», нейминг-кандидат) выровнен на существующий
 *    `mch_steam_kettle` (04-machines.md «Паровой чан») — та же роль (гамбо/чаудер/бисквит,
 *    04-machines.md §3.6 сама иллюстрирует Steam Kettle именно этими блюдами).
 *    `Prep Counter` (06-recipes.md «Стол сборки», холодная сборка сэндвичей/солений) —
 *    04-machines.md исходно не описывал такую станцию, но `mch_prep_counter` [СИНХРОНИЗИРОВАНО
 *    — STATE-3] с тех пор заведён в `machines.ts` (Kitchen, MVP, см. git-историю machines.ts) —
 *    `[Recipe→Machine]` в validate.test.ts зелёный по этому ключу.
 *
 * 2) Сырьё/полуфабрикаты — где это существующий `catalogs/ingredients.ts` ключ, каталог
 *    ссылается НА НЕГО НАПРЯМУЮ (а не заводит параллельное имя): Wheat→crop_wheat,
 *    Egg→egg, Milk→milk, Honey→honey, Bacon→bacon, Beef→crop_beef, Corn→crop_corn,
 *    Tomato→crop_tomato, Lettuce→crop_lettuce, Potato→crop_potato,
 *    Strawberry→crop_strawberry, Cherry→crop_cherry, Pumpkin→crop_pumpkin,
 *    Pecan→crop_pecan, Apple→crop_apple, Onion→crop_onion, Cucumber→crop_cucumber,
 *    Coffee Bean→crop_green_coffee_beans, Georgia Peach→crop_georgia_peach,
 *    Gulf Shrimp→crop_gulf_shrimp, Maine Lobster→crop_maine_lobster,
 *    Truffle→black_truffle, Vanilla Bean→crop_california_vanilla_bean,
 *    Maple Syrup→ingr_maple_syrup (экспедиционный товар, не крафтится на кухне),
 *    Cajun Spice→ingr_cajun_spice_blend, Brisket Cut→crop_beef_brisket,
 *    California Citrus→crop_california_navel_orange (либо meyer_lemon — 06-recipes.md
 *    хотел единый «цитрус», ingredients.ts различает сорта; взят апельсин как основной),
 *    Vanilla Essence (R20-паттерн раннего заменителя ванили, §4.1 сноска)→
 *    ingr_vanilla_extract — БЛИЖАЙШИЙ существующий заменитель, но он T3/Mail Catalog,
 *    а не «доступен с начала», как требовал §4.1 фикс Фазы B; это частично воспроизводит
 *    исходную проблему недостижимости мороженицы Ур.2 (см. TODO ниже — тот же паттерн,
 *    что и Flour/R20, но для Vanilla; решается добавлением T1 `ingr_vanilla_essence`
 *    в ingredients.ts, не в этом файле).
 *    Также напрямую переиспользованы уже определённые в ingredients.ts полуфабрикаты
 *    (see БЛОК A): Flour, Basic Dough(=Dough), Butter, Cheese Curds(=Cheese), Cream,
 *    Refined Sugar, Roasted Coffee, Cherry Pie Filling, Ground Beef Patty, Whipped Cream,
 *    Pumpkin Puree, Pecan Praline, Pie Crust Basic/Deluxe(=Pie Crust), Peach Cobbler
 *    Filling, Shrimp Bisque Base, Smoked Brisket, Cajun Butter, Refined Praline Sauce,
 *    Lobster Bisque Base, Truffle Butter, Vanilla Bean Paste, Candied Citrus Peel.
 *    [СИНХРОНИЗИРОВАНО — STATE-3] `ingr_flour` (изначально basePrice $0.35, ingredients.ts)
 *    продавался дешевле себестоимости своего же рецепта Wheat×2 (`crop_wheat` $0.20 × 2 =
 *    $0.40) — с тех пор поднят до $0.50 (см. git-историю ingredients.ts); формула Wheat×2
 *    не менялась. STATE-1 закрыл тот же класс проблемы для остальных 13 bridge-полуфабрикатов
 *    ingredients.ts, ранее продававшихся ниже себестоимости входов.
 *
 * [СИНХРОНИЗИРОВАНО — STATE-3] Разделы 3–5 (ниже была история пробелов на момент
 * первой сдачи каталога — 134 `dish_*` без Ingredient-записи, недостающие `crop_lemon`/
 * `chicken`/`crop_catfish`/`crop_cocoa`/12 Block-B полуфабрикатов, `mch_prep_counter` без
 * записи в `machines.ts`, `ingr_flour` дешевле себестоимости своего рецепта) — см.
 * git-историю `ingredients.ts`/`machines.ts`: все перечисленные пробелы закрыты
 * (134 `dish_*` заведены, 4 сырых + 12 Block-B `ingr_*` ключей на месте, `mch_prep_counter`
 * есть в реестре с `baseCost`, `ingr_flour` поднята до $0.50). `validate.test.ts` зелёный
 * по [Recipe→Ingredient]/[Recipe→Machine]/[Recipe] маржа целиком, не только для recipes.ts.
 * Дизайн-нюанс тира сырья (п.5, Honey/Cherry/Beef/Pumpkin/Pecan/Whipped Cream/Corn — тир
 * сырья выше номинального тира блюда) остаётся как есть — `RecipeSchema` не требует
 * `tier` блюда = max(tier входов), это не баг, а сознательно неограниченный zod-контракт.
 *
 * Наименование: `rcp_*` — ключ рецепта; `dish_*` — готовое блюдо (продаётся); прочие
 * ключи (`crop_*`/`ingr_*`/без префикса для животн. продукта) — конвенция ingredients.ts.
 *
 * Открытые вопросы 06-recipes.md §8, НЕ закрытые этим каталогом (вне моей зоны владения):
 *   §8.1 станки-кандидаты, §8.2 доп. сырьё (см. TODO выше), §8.3 Banana Split (#59)
 *   двойная категория, §8.4 секретки сверх 112, Mail Catalog unlock (нет kind 'mail' в
 *   RecipeUnlock — приближено `level`, см. TODO(architecture) на местах ниже).
 */

import type { Recipe, BluePlate } from '../schema'

// ─────────────────────────────────────────────────────────────────────────────
// БЛОК A. Bridge-рецепты для полуфабрикатов, УЖЕ зарегистрированных владельцем
// catalogs/ingredients.ts (её докстринг явно делегирует inputs/machine/time сюда).
// Формулы — 1:1 из inline-комментариев ingredients.ts ("Станок (X, из Y) · Z мин").
// R20 (Hand-Ground Flour, MVP): `ingr_flour` — первая запись ниже, unlock:'starter'.
// ─────────────────────────────────────────────────────────────────────────────
const bridgeSemiProducts: Recipe[] = [
  {
    key: 'rcp_ingr_flour',
    name: { en: 'Flour', ru: 'Мука' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_wheat', qty: 2 }],
    output: { key: 'ingr_flour', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 300,
    unlock: { kind: 'starter' },
  }, // Flour (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_basic_dough',
    name: { en: 'Basic Dough', ru: 'Простое тесто' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_flour', qty: 1 }, { key: 'ingr_butter', qty: 1 }, { key: 'egg', qty: 1 }],
    output: { key: 'ingr_basic_dough', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1200,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // Basic Dough (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_butter',
    name: { en: 'Butter', ru: 'Масло' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'milk', qty: 2 }],
    output: { key: 'ingr_butter', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1500,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // Butter (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_cheese_curds',
    name: { en: 'Cheese Curds', ru: 'Сырные зёрна' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'milk', qty: 3 }],
    output: { key: 'ingr_cheese_curds', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1800,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // Cheese Curds (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_cream',
    name: { en: 'Cream', ru: 'Сливки' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'milk', qty: 2 }],
    output: { key: 'ingr_cream', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1200,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // Cream (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_refined_sugar',
    name: { en: 'Refined Sugar', ru: 'Сахар рафинированный' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_sugar_beet', qty: 2 }],
    output: { key: 'ingr_refined_sugar', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1800,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // Refined Sugar (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_roasted_coffee',
    name: { en: 'Roasted Coffee', ru: 'Жареные зёрна' },
    tier: 3,
    machineKey: 'mch_coffee',
    inputs: [{ key: 'crop_green_coffee_beans', qty: 2 }],
    output: { key: 'ingr_roasted_coffee', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // Roasted Coffee (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_cherry_pie_filling',
    name: { en: 'Cherry Pie Filling', ru: 'Вишнёвая начинка' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_cherry', qty: 4 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_cherry_pie_filling', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // Cherry Pie Filling (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_ground_beef_patty',
    name: { en: 'Ground Beef Patty', ru: 'Говяжья котлета' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_beef', qty: 1 }],
    output: { key: 'ingr_ground_beef_patty', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1200,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // Ground Beef Patty (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_whipped_cream',
    name: { en: 'Whipped Cream', ru: 'Взбитые сливки' },
    tier: 3,
    machineKey: 'mch_churn',
    inputs: [{ key: 'ingr_cream', qty: 1 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_whipped_cream', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // Whipped Cream (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_pumpkin_puree',
    name: { en: 'Pumpkin Puree', ru: 'Тыквенное пюре' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_pumpkin', qty: 2 }],
    output: { key: 'ingr_pumpkin_puree', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 2100,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // Pumpkin Puree (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_pecan_praline',
    name: { en: 'Pecan Praline', ru: 'Пекан-пралине' },
    tier: 3,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_pecan', qty: 3 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_pecan_praline', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 2700,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // Pecan Praline (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_pie_crust_basic',
    name: { en: 'Pie Crust (Basic)', ru: 'Простой корж' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }],
    output: { key: 'ingr_pie_crust_basic', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 1500,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // Pie Crust (Basic) (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_pie_crust_deluxe',
    name: { en: 'Deluxe Pie Crust', ru: 'Улучшенный корж' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'ingr_pie_crust_deluxe', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // Deluxe Pie Crust (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_peach_cobbler_filling',
    name: { en: 'Peach Cobbler Filling', ru: 'Начинка коблера' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_georgia_peach', qty: 3 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_peach_cobbler_filling', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 7200,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // Peach Cobbler Filling (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_shrimp_bisque_base',
    name: { en: 'Shrimp Bisque Base', ru: 'Основа бисквита с креветками' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 3 }],
    output: { key: 'ingr_shrimp_bisque_base', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 9000,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // Shrimp Bisque Base (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_smoked_brisket',
    name: { en: 'Smoked Brisket', ru: 'Копчёная грудинка' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'crop_beef_brisket', qty: 2 }, { key: 'ingr_texas_bbq_rub', qty: 1 }],
    output: { key: 'ingr_smoked_brisket', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 14400,
    unlock: { kind: 'state', stateKey: 'st_texas' },
  }, // Smoked Brisket (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_cajun_butter',
    name: { en: 'Cajun Butter', ru: 'Каджунское масло' },
    tier: 4,
    machineKey: 'mch_churn',
    inputs: [{ key: 'ingr_butter', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'ingr_cajun_butter', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 3600,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // Cajun Butter (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_refined_praline_sauce',
    name: { en: 'Refined Praline Sauce', ru: 'Соус пралине улучшенный' },
    tier: 4,
    machineKey: 'mch_churn',
    inputs: [{ key: 'ingr_pecan_praline', qty: 1 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_refined_praline_sauce', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 5400,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // Refined Praline Sauce (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_lobster_bisque_base',
    name: { en: 'Lobster Bisque Base', ru: 'Основа лобстерового бисквита' },
    tier: 5,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_maine_lobster', qty: 1 }],
    output: { key: 'ingr_lobster_bisque_base', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 21600,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // Lobster Bisque Base (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_truffle_butter',
    name: { en: 'Truffle Butter', ru: 'Трюфельное масло' },
    tier: 5,
    machineKey: 'mch_churn',
    inputs: [{ key: 'black_truffle', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'ingr_truffle_butter', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 14400,
    unlock: { kind: 'level', farmLevel: 16 },
  }, // Truffle Butter (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_vanilla_bean_paste',
    name: { en: 'Vanilla Bean Paste', ru: 'Ванильная паста' },
    tier: 5,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_california_vanilla_bean', qty: 1 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_vanilla_bean_paste', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 18000,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // Vanilla Bean Paste (bridge → ingr уже в ingredients.ts)
  {
    key: 'rcp_ingr_candied_citrus_peel',
    name: { en: 'Candied Citrus Peel', ru: 'Цукаты из цитрусовой цедры' },
    tier: 5,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_california_navel_orange', qty: 2 }, { key: 'ingr_refined_sugar', qty: 1 }],
    output: { key: 'ingr_candied_citrus_peel', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 10800,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // Candied Citrus Peel (bridge → ingr уже в ingredients.ts)
]

// ─────────────────────────────────────────────────────────────────────────────
// БЛОК B. НОВЫЕ полуфабрикаты (§4.1 06-recipes.md), которых нет в ingredients.ts —
// Bread/Biscuit/Cornbread/Gravy/Hushpuppy Batter/Pastry Cream/BBQ Sauce/Roux/
// Caramel Sauce/Pickles/Coleslaw/Cocktail Sauce/Vanilla Custard. Названы по конвенции
// `ingr_*` (совпадает с ingredients.ts) — тривиально принять как есть, когда
// ingredients-агент добавит эти ключи в свой каталог (см. TODO в докстринге файла и
// спонсируемую фоновую задачу для владельца ingredients.ts).
// ─────────────────────────────────────────────────────────────────────────────
const newSemiProducts: Recipe[] = [
  {
    key: 'rcp_ingr_bread',
    name: { en: 'Bread', ru: 'Хлеб' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }],
    output: { key: 'ingr_bread', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 480,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // Bread (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_biscuit',
    name: { en: 'Biscuit', ru: 'Бисквит (южный)' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'ingr_biscuit', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 480,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // Biscuit (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_cornbread',
    name: { en: 'Cornbread', ru: 'Кукурузный хлеб' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_corn', qty: 2 }, { key: 'egg', qty: 1 }],
    output: { key: 'ingr_cornbread', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // Cornbread (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_gravy',
    name: { en: 'Gravy', ru: 'Соус гарви' },
    tier: 2,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'milk', qty: 1 }, { key: 'bacon', qty: 1 }],
    output: { key: 'ingr_gravy', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // Gravy (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_hushpuppy_batter',
    name: { en: 'Hushpuppy Batter', ru: 'Тесто хашпаппи' },
    tier: 2,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_corn', qty: 2 }, { key: 'egg', qty: 1 }],
    output: { key: 'ingr_hushpuppy_batter', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // Hushpuppy Batter (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_pastry_cream',
    name: { en: 'Pastry Cream', ru: 'Кондитерский крем' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'egg', qty: 2 }],
    output: { key: 'ingr_pastry_cream', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // Pastry Cream (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_bbq_sauce',
    name: { en: 'BBQ Sauce', ru: 'Соус барбекю' },
    tier: 3,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_tomato', qty: 2 }, { key: 'honey', qty: 1 }],
    output: { key: 'ingr_bbq_sauce', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // BBQ Sauce (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_roux',
    name: { en: 'Roux', ru: 'Ру (основа гамбо)' },
    tier: 2,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_wheat', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'ingr_roux', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // Roux (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_caramel_sauce',
    name: { en: 'Caramel Sauce', ru: 'Карамель' },
    tier: 3,
    machineKey: 'mch_churn',
    inputs: [{ key: 'honey', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'ingr_caramel_sauce', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // Caramel Sauce (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_pickles',
    name: { en: 'Pickles', ru: 'Соленья' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_cucumber', qty: 3 }],
    output: { key: 'ingr_pickles', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // Pickles (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_coleslaw',
    name: { en: 'Coleslaw', ru: 'Коулслоу' },
    tier: 2,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_lettuce', qty: 2 }, { key: 'milk', qty: 1 }],
    output: { key: 'ingr_coleslaw', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 10 },
  }, // Coleslaw (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_cocktail_sauce',
    name: { en: 'Cocktail Sauce', ru: 'Коктейльный соус' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_tomato', qty: 2 }],
    output: { key: 'ingr_cocktail_sauce', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 480,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // Cocktail Sauce (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
  {
    key: 'rcp_ingr_vanilla_custard',
    name: { en: 'Vanilla Custard', ru: 'Ванильный пломбир' },
    tier: 2,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'ingr_vanilla_extract', qty: 1 }],
    output: { key: 'ingr_vanilla_custard', qty: 1, itemClass: 'ingredient' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // Vanilla Custard (NEW-GAP: отсутствует в ingredients.ts, введено здесь)
]

// ─────────────────────────────────────────────────────────────────────────────
// Каталог блюд — §4.2, 112 шт. (# в комментарии = номер строки спеки).
// ─────────────────────────────────────────────────────────────────────────────
const dishes: Recipe[] = [
  {
    key: 'rcp_toast',
    name: { en: 'Toast', ru: 'Тост' },
    tier: 1,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }],
    output: { key: 'dish_toast', qty: 1, itemClass: 'dish' },
    baseCraftSec: 180,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #1 Toast (Breakfasts)
  {
    key: 'rcp_farm_scramble',
    name: { en: 'Farm Scramble', ru: 'Фермерская яичница' },
    tier: 1,
    machineKey: 'mch_grill',
    inputs: [{ key: 'egg', qty: 3 }],
    output: { key: 'dish_farm_scramble', qty: 1, itemClass: 'dish' },
    baseCraftSec: 300,
    unlock: { kind: 'starter' },
  }, // #2 Farm Scramble (Breakfasts)
  {
    key: 'rcp_home_lemonade',
    name: { en: 'Home Lemonade', ru: 'Домашний лимонад' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_lemon', qty: 3 }],
    output: { key: 'dish_home_lemonade', qty: 1, itemClass: 'dish' },
    baseCraftSec: 240,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #3 Home Lemonade (Breakfasts)
  {
    key: 'rcp_country_ham_and_eggs',
    name: { en: 'Country Ham & Eggs', ru: 'Ветчина с яйцами' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'egg', qty: 2 }, { key: 'bacon', qty: 2 }],
    output: { key: 'dish_country_ham_and_eggs', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // #4 Country Ham & Eggs (Breakfasts)
  {
    key: 'rcp_buttermilk_pancakes',
    name: { en: 'Buttermilk Pancakes', ru: 'Блинчики на пахте' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'milk', qty: 1 }, { key: 'egg', qty: 1 }],
    output: { key: 'dish_buttermilk_pancakes', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #5 Buttermilk Pancakes (Breakfasts)
  {
    key: 'rcp_strawberry_waffles',
    name: { en: 'Strawberry Waffles', ru: 'Вафли с клубникой' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'egg', qty: 1 }, { key: 'crop_strawberry', qty: 2 }],
    output: { key: 'dish_strawberry_waffles', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #6 Strawberry Waffles (Breakfasts)
  {
    key: 'rcp_bacon_grilled_cheese',
    name: { en: 'Bacon Grilled Cheese', ru: 'Гриль-сэндвич с беконом и сыром' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }, { key: 'ingr_cheese_curds', qty: 1 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_bacon_grilled_cheese', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #7 Bacon Grilled Cheese (Breakfasts)
  {
    key: 'rcp_sunrise_skillet',
    name: { en: 'Sunrise Skillet', ru: 'Сковородка на рассвете' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_potato', qty: 2 }, { key: 'egg', qty: 2 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_sunrise_skillet', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2100,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #8 Sunrise Skillet (Breakfasts)
  {
    key: 'rcp_cherry_blintz',
    name: { en: 'Cherry Blintz', ru: 'Вишнёвый блинчик' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_cherry', qty: 3 }, { key: 'ingr_basic_dough', qty: 1 }, { key: 'ingr_cheese_curds', qty: 1 }],
    output: { key: 'dish_cherry_blintz', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #9 Cherry Blintz (Breakfasts)
  {
    key: 'rcp_honey_pecan_toast',
    name: { en: 'Honey-Pecan Toast', ru: 'Тост с мёдом и пеканом' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }, { key: 'honey', qty: 1 }, { key: 'crop_pecan', qty: 2 }],
    output: { key: 'dish_honey_pecan_toast', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #10 Honey-Pecan Toast (Breakfasts)
  {
    key: 'rcp_maple_waffles',
    name: { en: 'Maple Waffles', ru: 'Вафли с кленовым сиропом' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'egg', qty: 1 }, { key: 'ingr_maple_syrup', qty: 1 }],
    output: { key: 'dish_maple_waffles', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5400,
    unlock: { kind: 'level', farmLevel: 14 } /* TODO(architecture): Mail Catalog unlock — RecipeUnlock не поддерживает kind 'mail' (contracts.ts/types/recipes.ts), приближено уровнем кухни; см. 06-recipes.md §3.4 */,
  }, // #11 Maple Waffles (Breakfasts)
  {
    key: 'rcp_peach_morning_cobbler',
    name: { en: 'Peach Morning Cobbler', ru: 'Утренний персиковый коблер' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_georgia_peach', qty: 3 }, { key: 'ingr_basic_dough', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_peach_morning_cobbler', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #12 Peach Morning Cobbler (Breakfasts)
  {
    key: 'rcp_dinner_roll',
    name: { en: 'Dinner Roll', ru: 'Булочка к обеду' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }],
    output: { key: 'dish_dinner_roll', qty: 1, itemClass: 'dish' },
    baseCraftSec: 240,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #13 Dinner Roll (Baking)
  {
    key: 'rcp_sugar_cookie',
    name: { en: 'Sugar Cookie', ru: 'Сахарное печенье' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'egg', qty: 1 }],
    output: { key: 'dish_sugar_cookie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 360,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #14 Sugar Cookie (Baking)
  {
    key: 'rcp_corn_muffin',
    name: { en: 'Corn Muffin', ru: 'Кукурузный маффин' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_corn', qty: 1 }, { key: 'egg', qty: 1 }],
    output: { key: 'dish_corn_muffin', qty: 1, itemClass: 'dish' },
    baseCraftSec: 300,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #15 Corn Muffin (Baking)
  {
    key: 'rcp_strawberry_shortcake',
    name: { en: 'Strawberry Shortcake', ru: 'Клубничный шорткейк' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }, { key: 'crop_strawberry', qty: 2 }, { key: 'ingr_whipped_cream', qty: 1 }],
    output: { key: 'dish_strawberry_shortcake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1080,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #16 Strawberry Shortcake (Baking)
  {
    key: 'rcp_buttermilk_biscuit_plate',
    name: { en: 'Buttermilk Biscuit Plate', ru: 'Тарелка бисквитов' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_biscuit', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_buttermilk_biscuit_plate', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #17 Buttermilk Biscuit Plate (Baking)
  {
    key: 'rcp_apple_pie',
    name: { en: 'Apple Pie', ru: 'Яблочный пай' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_pie_crust_basic', qty: 1 }, { key: 'crop_apple', qty: 3 }],
    output: { key: 'dish_apple_pie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1320,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #18 Apple Pie (Baking)
  {
    key: 'rcp_corn_bread_loaf',
    name: { en: 'Corn Bread Loaf', ru: 'Буханка кукурузного хлеба' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_cornbread', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_corn_bread_loaf', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #19 Corn Bread Loaf (Baking)
  {
    key: 'rcp_cherry_pie',
    name: { en: 'Cherry Pie', ru: 'Вишнёвый пай' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_pie_crust_deluxe', qty: 1 }, { key: 'crop_cherry', qty: 6 }],
    output: { key: 'dish_cherry_pie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #20 Cherry Pie (Baking)
  {
    key: 'rcp_cherry_pie_a_la_mode',
    name: { en: 'Cherry Pie à la Mode', ru: 'Вишнёвый пай а-ля мод' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'dish_cherry_pie', qty: 1 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_cherry_pie_a_la_mode', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3000,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #21 Cherry Pie à la Mode (Baking)
  {
    key: 'rcp_pumpkin_pie',
    name: { en: 'Pumpkin Pie', ru: 'Тыквенный пай' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_pie_crust_deluxe', qty: 1 }, { key: 'crop_pumpkin', qty: 4 }, { key: 'ingr_pastry_cream', qty: 1 }],
    output: { key: 'dish_pumpkin_pie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2880,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #22 Pumpkin Pie (Baking)
  {
    key: 'rcp_honey_pecan_pie',
    name: { en: 'Honey Pecan Pie', ru: 'Пекановый пай с мёдом' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_pie_crust_deluxe', qty: 1 }, { key: 'crop_pecan', qty: 5 }, { key: 'honey', qty: 2 }],
    output: { key: 'dish_honey_pecan_pie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3300,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #23 Honey Pecan Pie (Baking)
  {
    key: 'rcp_coffee_crumb_cake',
    name: { en: 'Coffee Crumb Cake', ru: 'Кофейный крамбл-кекс' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }, { key: 'crop_green_coffee_beans', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_coffee_crumb_cake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2520,
    unlock: { kind: 'level', farmLevel: 9 },
  }, // #24 Coffee Crumb Cake (Baking)
  {
    key: 'rcp_georgia_peach_cobbler',
    name: { en: 'Georgia Peach Cobbler', ru: 'Персиковый коблер Джорджии' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_georgia_peach', qty: 5 }, { key: 'ingr_pie_crust_deluxe', qty: 1 }],
    output: { key: 'dish_georgia_peach_cobbler', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6600,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #25 Georgia Peach Cobbler (Baking)
  {
    key: 'rcp_peach_melba_tart',
    name: { en: 'Peach Melba Tart', ru: 'Тарт «Пич Мельба»' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_georgia_peach', qty: 3 }, { key: 'ingr_pastry_cream', qty: 1 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_peach_melba_tart', qty: 1, itemClass: 'dish' },
    baseCraftSec: 7200,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #26 Peach Melba Tart (Baking)
  {
    key: 'rcp_maple_pecan_roll',
    name: { en: 'Maple Pecan Roll', ru: 'Рулет с кленовым сиропом и пеканом' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_maple_syrup', qty: 2 }, { key: 'crop_pecan', qty: 3 }, { key: 'ingr_basic_dough', qty: 1 }],
    output: { key: 'dish_maple_pecan_roll', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'level', farmLevel: 14 } /* TODO(architecture): Mail Catalog unlock — RecipeUnlock не поддерживает kind 'mail' (contracts.ts/types/recipes.ts), приближено уровнем кухни; см. 06-recipes.md §3.4 */,
  }, // #27 Maple Pecan Roll (Baking)
  {
    key: 'rcp_truffle_butter_croissant',
    name: { en: 'Truffle Butter Croissant', ru: 'Круассан с трюфельным маслом' },
    tier: 5,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 2 }, { key: 'ingr_butter', qty: 1 }, { key: 'black_truffle', qty: 1 }],
    output: { key: 'dish_truffle_butter_croissant', qty: 1, itemClass: 'dish' },
    baseCraftSec: 15600,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // #28 Truffle Butter Croissant (Baking)
  {
    key: 'rcp_lobster_pot_pie',
    name: { en: 'Lobster Pot Pie', ru: 'Пай с лобстером' },
    tier: 5,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_pie_crust_deluxe', qty: 1 }, { key: 'crop_maine_lobster', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_lobster_pot_pie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 16800,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #29 Lobster Pot Pie (Baking)
  {
    key: 'rcp_vanilla_bean_layer_cake',
    name: { en: 'Vanilla Bean Layer Cake', ru: 'Слоёный торт с ванилью' },
    tier: 5,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 2 }, { key: 'crop_california_vanilla_bean', qty: 2 }, { key: 'ingr_pastry_cream', qty: 2 }],
    output: { key: 'dish_vanilla_bean_layer_cake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 14400,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // #30 Vanilla Bean Layer Cake (Baking)
  {
    key: 'rcp_grilled_corn',
    name: { en: 'Grilled Corn', ru: 'Кукуруза на гриле' },
    tier: 1,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_corn', qty: 2 }],
    output: { key: 'dish_grilled_corn', qty: 1, itemClass: 'dish' },
    baseCraftSec: 240,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #31 Grilled Corn (Grill)
  {
    key: 'rcp_veggie_skewer',
    name: { en: 'Veggie Skewer', ru: 'Овощной шашлык' },
    tier: 1,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_tomato', qty: 2 }, { key: 'crop_onion', qty: 1 }],
    output: { key: 'dish_veggie_skewer', qty: 1, itemClass: 'dish' },
    baseCraftSec: 300,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #32 Veggie Skewer (Grill)
  {
    key: 'rcp_classic_burger',
    name: { en: 'Classic Burger', ru: 'Классический бургер' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }, { key: 'bacon', qty: 2 }],
    output: { key: 'dish_classic_burger', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #33 Classic Burger (Grill)
  {
    key: 'rcp_corn_dog',
    name: { en: 'Corn Dog', ru: 'Кукурузный хот-дог' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_hushpuppy_batter', qty: 1 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_corn_dog', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #34 Corn Dog (Grill)
  {
    key: 'rcp_bacon_cheeseburger',
    name: { en: 'Bacon Cheeseburger', ru: 'Бекон-чизбургер' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'dish_classic_burger', qty: 1 }, { key: 'ingr_cheese_curds', qty: 1 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_bacon_cheeseburger', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1080,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #35 Bacon Cheeseburger (Grill)
  {
    key: 'rcp_strawberry_glazed_ham',
    name: { en: 'Strawberry Glazed Ham', ru: 'Ветчина в клубничной глазури' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'bacon', qty: 3 }, { key: 'crop_strawberry', qty: 2 }],
    output: { key: 'dish_strawberry_glazed_ham', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1200,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #36 Strawberry Glazed Ham (Grill)
  {
    key: 'rcp_county_beef_burger',
    name: { en: 'County Beef Burger', ru: 'Бургер из говядины округа' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }, { key: 'crop_beef', qty: 2 }],
    output: { key: 'dish_county_beef_burger', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2100,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #37 County Beef Burger (Grill)
  {
    key: 'rcp_deluxe_burger',
    name: { en: 'Deluxe Burger', ru: 'Делюкс-бургер' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'dish_bacon_cheeseburger', qty: 1 }, { key: 'crop_beef', qty: 1 }, { key: 'ingr_pickles', qty: 1 }],
    output: { key: 'dish_deluxe_burger', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #38 Deluxe Burger (Grill)
  {
    key: 'rcp_grilled_beef_steak',
    name: { en: 'Grilled Beef Steak', ru: 'Стейк на гриле' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_beef', qty: 3 }],
    output: { key: 'dish_grilled_beef_steak', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3000,
    unlock: { kind: 'level', farmLevel: 9 },
  }, // #39 Grilled Beef Steak (Grill)
  {
    key: 'rcp_honey_bbq_ribs',
    name: { en: 'Honey BBQ Ribs', ru: 'Мини-рёбрышки в мёде и барбекю' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_beef', qty: 2 }, { key: 'ingr_bbq_sauce', qty: 1 }, { key: 'honey', qty: 1 }],
    output: { key: 'dish_honey_bbq_ribs', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3300,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #40 Honey BBQ Ribs (Grill)
  {
    key: 'rcp_chicago_deep_dish_sausage_melt',
    name: { en: 'Chicago Deep-Dish Sausage Melt', ru: 'Чикагский колбасный мелт' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 1 }, { key: 'ingr_cheese_curds', qty: 2 }, { key: 'bacon', qty: 2 }],
    output: { key: 'dish_chicago_deep_dish_sausage_melt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'state', stateKey: 'st_illinois' },
  }, // #41 Chicago Deep-Dish Sausage Melt (Grill)
  {
    key: 'rcp_peach_glazed_pork_chop',
    name: { en: 'Peach-Glazed Pork Chop', ru: 'Свиная отбивная в персиковой глазури' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'bacon', qty: 3 }, { key: 'crop_georgia_peach', qty: 2 }],
    output: { key: 'dish_peach_glazed_pork_chop', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #42 Peach-Glazed Pork Chop (Grill)
  {
    key: 'rcp_texas_smoked_brisket_plate',
    name: { en: 'Texas Smoked Brisket Plate', ru: 'Тарелка техасского бришкета' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'crop_beef_brisket', qty: 3 }, { key: 'ingr_bbq_sauce', qty: 1 }],
    output: { key: 'dish_texas_smoked_brisket_plate', qty: 1, itemClass: 'dish' },
    baseCraftSec: 9000,
    unlock: { kind: 'state', stateKey: 'st_texas' },
  }, // #43 Texas Smoked Brisket Plate (Grill)
  {
    key: 'rcp_cajun_grilled_shrimp_skewer',
    name: { en: 'Cajun Grilled Shrimp Skewer', ru: 'Каджун-шашлык из креветок' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 3 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_cajun_grilled_shrimp_skewer', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5400,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #44 Cajun Grilled Shrimp Skewer (Grill)
  {
    key: 'rcp_maple_bacon_burger',
    name: { en: 'Maple Bacon Burger', ru: 'Бургер с кленовым беконом' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'dish_deluxe_burger', qty: 1 }, { key: 'ingr_maple_syrup', qty: 1 }, { key: 'bacon', qty: 2 }],
    output: { key: 'dish_maple_bacon_burger', qty: 1, itemClass: 'dish' },
    baseCraftSec: 7800,
    unlock: { kind: 'level', farmLevel: 14 } /* TODO(architecture): Mail Catalog unlock — RecipeUnlock не поддерживает kind 'mail' (contracts.ts/types/recipes.ts), приближено уровнем кухни; см. 06-recipes.md §3.4 */,
  }, // #45 Maple Bacon Burger (Grill)
  {
    key: 'rcp_legends_lobster_steak',
    name: { en: 'Legends Lobster Steak', ru: 'Стейк-лобстер «Легенды»' },
    tier: 5,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_maine_lobster', qty: 2 }, { key: 'black_truffle', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_legends_lobster_steak', qty: 1, itemClass: 'dish' },
    baseCraftSec: 18000,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #46 Legends Lobster Steak (Grill)
  {
    key: 'rcp_sweet_tea',
    name: { en: 'Sweet Tea', ru: 'Сладкий чай' },
    tier: 1,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'crop_lemon', qty: 1 }, { key: 'crop_wheat', qty: 1 }],
    output: { key: 'dish_sweet_tea', qty: 1, itemClass: 'dish' },
    baseCraftSec: 180,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #47 Sweet Tea (Beverages)
  {
    key: 'rcp_cream_soda',
    name: { en: 'Cream Soda', ru: 'Крем-содовая' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 1 }],
    output: { key: 'dish_cream_soda', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #48 Cream Soda (Beverages)
  {
    key: 'rcp_fresh_lemonade_float',
    name: { en: 'Fresh Lemonade Float', ru: 'Лимонадный флоат' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'dish_home_lemonade', qty: 1 }, { key: 'ingr_whipped_cream', qty: 1 }],
    output: { key: 'dish_fresh_lemonade_float', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #49 Fresh Lemonade Float (Beverages)
  {
    key: 'rcp_classic_milkshake',
    name: { en: 'Classic Milkshake', ru: 'Классический молочный коктейль' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'crop_strawberry', qty: 1 }],
    output: { key: 'dish_classic_milkshake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #50 Classic Milkshake (Beverages)
  {
    key: 'rcp_chocolate_soda',
    name: { en: 'Chocolate Soda', ru: 'Шоколадная содовая' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 2 }, { key: 'crop_cocoa', qty: 1 }],
    output: { key: 'dish_chocolate_soda', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #51 Chocolate Soda (Beverages)
  {
    key: 'rcp_farmhouse_coffee',
    name: { en: 'Farmhouse Coffee', ru: 'Домашний кофе' },
    tier: 2,
    machineKey: 'mch_coffee',
    inputs: [{ key: 'crop_wheat', qty: 2 }],
    output: { key: 'dish_farmhouse_coffee', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // #52 Farmhouse Coffee (Beverages)
  {
    key: 'rcp_strawberry_malt',
    name: { en: 'Strawberry Malt', ru: 'Клубничный малт' },
    tier: 3,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'dish_classic_milkshake', qty: 1 }, { key: 'crop_strawberry', qty: 2 }],
    output: { key: 'dish_strawberry_malt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1500,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #53 Strawberry Malt (Beverages)
  {
    key: 'rcp_southern_coffee',
    name: { en: 'Southern Coffee', ru: 'Южный кофе' },
    tier: 3,
    machineKey: 'mch_coffee',
    inputs: [{ key: 'crop_green_coffee_beans', qty: 2 }],
    output: { key: 'dish_southern_coffee', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1200,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #54 Southern Coffee (Beverages)
  {
    key: 'rcp_honey_cream_coffee',
    name: { en: 'Honey Cream Coffee', ru: 'Кофе со сливками и мёдом' },
    tier: 3,
    machineKey: 'mch_coffee',
    inputs: [{ key: 'crop_green_coffee_beans', qty: 2 }, { key: 'honey', qty: 1 }, { key: 'ingr_whipped_cream', qty: 1 }],
    output: { key: 'dish_honey_cream_coffee', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1500,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #55 Honey Cream Coffee (Beverages)
  {
    key: 'rcp_pumpkin_spice_shake',
    name: { en: 'Pumpkin Spice Shake', ru: 'Тыквенно-пряный шейк' },
    tier: 3,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'crop_pumpkin', qty: 2 }],
    output: { key: 'dish_pumpkin_spice_shake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1800,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #56 Pumpkin Spice Shake (Beverages)
  {
    key: 'rcp_peach_sweet_tea',
    name: { en: 'Peach Sweet Tea', ru: 'Персиковый сладкий чай' },
    tier: 4,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'crop_georgia_peach', qty: 2 }, { key: 'crop_lemon', qty: 2 }],
    output: { key: 'dish_peach_sweet_tea', qty: 1, itemClass: 'dish' },
    baseCraftSec: 4800,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #57 Peach Sweet Tea (Beverages)
  {
    key: 'rcp_maple_coffee_malt',
    name: { en: 'Maple Coffee Malt', ru: 'Кленовый кофейный малт' },
    tier: 4,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'dish_strawberry_malt', qty: 1 }, { key: 'ingr_maple_syrup', qty: 1 }, { key: 'crop_green_coffee_beans', qty: 1 }],
    output: { key: 'dish_maple_coffee_malt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'level', farmLevel: 14 } /* TODO(architecture): Mail Catalog unlock — RecipeUnlock не поддерживает kind 'mail' (contracts.ts/types/recipes.ts), приближено уровнем кухни; см. 06-recipes.md §3.4 */,
  }, // #58 Maple Coffee Malt (Beverages)
  {
    key: 'rcp_banana_split',
    name: { en: 'Banana Split', ru: 'Банана-сплит' },
    tier: 3,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'dish_strawberry_malt', qty: 1 }, { key: 'ingr_vanilla_custard', qty: 1 }, { key: 'ingr_caramel_sauce', qty: 1 }],
    output: { key: 'dish_banana_split', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3300,
    unlock: { kind: 'level', farmLevel: 10 },
  }, // #59 Banana Split (Beverages)
  {
    key: 'rcp_california_citrus_cooler',
    name: { en: 'California Citrus Cooler', ru: 'Калифорнийский цитрусовый кулер' },
    tier: 5,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'crop_california_navel_orange', qty: 3 }, { key: 'crop_california_vanilla_bean', qty: 1 }],
    output: { key: 'dish_california_citrus_cooler', qty: 1, itemClass: 'dish' },
    baseCraftSec: 14400,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // #60 California Citrus Cooler (Beverages)
  {
    key: 'rcp_vanilla_scoop',
    name: { en: 'Vanilla Scoop', ru: 'Шарик пломбира' },
    tier: 2,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_vanilla_scoop', qty: 1, itemClass: 'dish' },
    baseCraftSec: 480,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #61 Vanilla Scoop (Desserts)
  {
    key: 'rcp_honey_cookie',
    name: { en: 'Honey Cookie', ru: 'Медовое печенье' },
    tier: 1,
    machineKey: 'mch_oven',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'crop_corn', qty: 1 }],
    output: { key: 'dish_honey_cookie', qty: 1, itemClass: 'dish' },
    baseCraftSec: 360,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #62 Honey Cookie (Desserts)
  {
    key: 'rcp_strawberry_sundae',
    name: { en: 'Strawberry Sundae', ru: 'Клубничный санди' },
    tier: 2,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'ingr_vanilla_custard', qty: 1 }, { key: 'crop_strawberry', qty: 2 }, { key: 'ingr_whipped_cream', qty: 1 }],
    output: { key: 'dish_strawberry_sundae', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #63 Strawberry Sundae (Desserts)
  {
    key: 'rcp_buttermilk_pudding',
    name: { en: 'Buttermilk Pudding', ru: 'Пудинг на пахте' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'ingr_pastry_cream', qty: 1 }],
    output: { key: 'dish_buttermilk_pudding', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1080,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #64 Buttermilk Pudding (Desserts)
  {
    key: 'rcp_caramel_apple',
    name: { en: 'Caramel Apple', ru: 'Карамельное яблоко' },
    tier: 2,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_apple', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_caramel_apple', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #65 Caramel Apple (Desserts)
  {
    key: 'rcp_cherry_cobbler_sundae',
    name: { en: 'Cherry Cobbler Sundae', ru: 'Санди с вишнёвым коблером' },
    tier: 3,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'dish_cherry_pie', qty: 1 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_cherry_cobbler_sundae', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #66 Cherry Cobbler Sundae (Desserts)
  {
    key: 'rcp_pumpkin_ice_cream',
    name: { en: 'Pumpkin Ice Cream', ru: 'Тыквенное мороженое' },
    tier: 3,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'crop_pumpkin', qty: 3 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_pumpkin_ice_cream', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #67 Pumpkin Ice Cream (Desserts)
  {
    key: 'rcp_pecan_praline',
    name: { en: 'Pecan Praline', ru: 'Пекановая пралине' },
    tier: 3,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_pecan', qty: 4 }, { key: 'ingr_caramel_sauce', qty: 1 }],
    output: { key: 'dish_pecan_praline', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2100,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #68 Pecan Praline (Desserts)
  {
    key: 'rcp_honey_pecan_ice_cream',
    name: { en: 'Honey Pecan Ice Cream', ru: 'Мёдово-пекановое мороженое' },
    tier: 3,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'crop_pecan', qty: 3 }, { key: 'honey', qty: 2 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_honey_pecan_ice_cream', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2880,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #69 Honey Pecan Ice Cream (Desserts)
  {
    key: 'rcp_georgia_peach_ice_cream',
    name: { en: 'Georgia Peach Ice Cream', ru: 'Персиковое мороженое Джорджии' },
    tier: 4,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'crop_georgia_peach', qty: 4 }, { key: 'ingr_vanilla_custard', qty: 1 }],
    output: { key: 'dish_georgia_peach_ice_cream', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5700,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #70 Georgia Peach Ice Cream (Desserts)
  {
    key: 'rcp_praline_bread_pudding',
    name: { en: 'Praline Bread Pudding', ru: 'Пекановый брэд-пудинг' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_pecan', qty: 3 }, { key: 'ingr_caramel_sauce', qty: 1 }],
    output: { key: 'dish_praline_bread_pudding', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3600,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #71 Praline Bread Pudding (Desserts)
  {
    key: 'rcp_maple_pecan_sundae',
    name: { en: 'Maple Pecan Sundae', ru: 'Санди с кленовым сиропом и пеканом' },
    tier: 4,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'ingr_vanilla_custard', qty: 2 }, { key: 'ingr_maple_syrup', qty: 1 }, { key: 'crop_pecan', qty: 3 }],
    output: { key: 'dish_maple_pecan_sundae', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'level', farmLevel: 14 } /* TODO(architecture): Mail Catalog unlock — RecipeUnlock не поддерживает kind 'mail' (contracts.ts/types/recipes.ts), приближено уровнем кухни; см. 06-recipes.md §3.4 */,
  }, // #72 Maple Pecan Sundae (Desserts)
  {
    key: 'rcp_truffle_honey_gelato',
    name: { en: 'Truffle Honey Gelato', ru: 'Трюфельно-медовое джелато' },
    tier: 5,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'black_truffle', qty: 1 }, { key: 'honey', qty: 2 }, { key: 'ingr_vanilla_custard', qty: 2 }],
    output: { key: 'dish_truffle_honey_gelato', qty: 1, itemClass: 'dish' },
    baseCraftSec: 15000,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // #73 Truffle Honey Gelato (Desserts)
  {
    key: 'rcp_vanilla_citrus_panna_cotta',
    name: { en: 'Vanilla Citrus Panna Cotta', ru: 'Ванильно-цитрусовая панна-котта' },
    tier: 5,
    machineKey: 'mch_churn',
    inputs: [{ key: 'crop_california_vanilla_bean', qty: 2 }, { key: 'crop_california_navel_orange', qty: 2 }, { key: 'ingr_pastry_cream', qty: 1 }],
    output: { key: 'dish_vanilla_citrus_panna_cotta', qty: 1, itemClass: 'dish' },
    baseCraftSec: 13800,
    unlock: { kind: 'state', stateKey: 'st_california' },
  }, // #74 Vanilla Citrus Panna Cotta (Desserts)
  {
    key: 'rcp_egg_salad_sandwich',
    name: { en: 'Egg Salad Sandwich', ru: 'Сэндвич с яичным салатом' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'egg', qty: 2 }],
    output: { key: 'dish_egg_salad_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 360,
    unlock: { kind: 'level', farmLevel: 2 },
  }, // #75 Egg Salad Sandwich (Sandwiches)
  {
    key: 'rcp_tomato_and_lettuce_sandwich',
    name: { en: 'Tomato & Lettuce Sandwich', ru: 'Сэндвич с томатом и салатом' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_tomato', qty: 1 }, { key: 'crop_lettuce', qty: 1 }],
    output: { key: 'dish_tomato_and_lettuce_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 300,
    unlock: { kind: 'level', farmLevel: 1 },
  }, // #76 Tomato & Lettuce Sandwich (Sandwiches)
  {
    key: 'rcp_grilled_cheese',
    name: { en: 'Grilled Cheese', ru: 'Гриль-сэндвич с сыром' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'ingr_cheese_curds', qty: 1 }],
    output: { key: 'dish_grilled_cheese', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 3 },
  }, // #77 Grilled Cheese (Sandwiches)
  {
    key: 'rcp_blt',
    name: { en: 'BLT', ru: 'БЛТ (бекон-салат-томат)' },
    tier: 2,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'bacon', qty: 2 }, { key: 'crop_lettuce', qty: 1 }, { key: 'crop_tomato', qty: 1 }],
    output: { key: 'dish_blt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #78 BLT (Sandwiches)
  {
    key: 'rcp_ham_and_cheese_melt',
    name: { en: 'Ham & Cheese Melt', ru: 'Ветчинно-сырный мелт' },
    tier: 2,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'bacon', qty: 2 }, { key: 'ingr_cheese_curds', qty: 1 }],
    output: { key: 'dish_ham_and_cheese_melt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #79 Ham & Cheese Melt (Sandwiches)
  {
    key: 'rcp_club_sandwich',
    name: { en: 'Club Sandwich', ru: 'Клаб-сэндвич' },
    tier: 2,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'dish_toast', qty: 2 }, { key: 'bacon', qty: 1 }, { key: 'egg', qty: 1 }, { key: 'crop_tomato', qty: 1 }],
    output: { key: 'dish_club_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1080,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #80 Club Sandwich (Sandwiches)
  {
    key: 'rcp_patty_melt',
    name: { en: 'Patty Melt', ru: 'Пэтти-мелт' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'dish_county_beef_burger', qty: 1 }, { key: 'ingr_cheese_curds', qty: 1 }],
    output: { key: 'dish_patty_melt', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #81 Patty Melt (Sandwiches)
  {
    key: 'rcp_beef_dip_sandwich',
    name: { en: 'Beef Dip Sandwich', ru: 'Сэндвич с говяжьим дипом' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_beef', qty: 2 }, { key: 'ingr_gravy', qty: 1 }],
    output: { key: 'dish_beef_dip_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #82 Beef Dip Sandwich (Sandwiches)
  {
    key: 'rcp_southern_pimento_cheese_sandwich',
    name: { en: 'Southern Pimento Cheese Sandwich', ru: 'Сэндвич с пимento-сыром' },
    tier: 3,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'ingr_cheese_curds', qty: 2 }, { key: 'crop_tomato', qty: 1 }],
    output: { key: 'dish_southern_pimento_cheese_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1800,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #83 Southern Pimento Cheese Sandwich (Sandwiches)
  {
    key: 'rcp_cajun_chicken_sandwich',
    name: { en: 'Cajun Chicken Sandwich', ru: 'Каджун-сэндвич с курицей' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'chicken', qty: 2 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_cajun_chicken_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5400,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #84 Cajun Chicken Sandwich (Sandwiches)
  {
    key: 'rcp_brisket_sandwich',
    name: { en: 'Brisket Sandwich', ru: 'Сэндвич с бришкетом' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_beef_brisket', qty: 2 }, { key: 'ingr_bbq_sauce', qty: 1 }],
    output: { key: 'dish_brisket_sandwich', qty: 1, itemClass: 'dish' },
    baseCraftSec: 8400,
    unlock: { kind: 'state', stateKey: 'st_texas' },
  }, // #85 Brisket Sandwich (Sandwiches)
  {
    key: 'rcp_lobster_roll',
    name: { en: 'Lobster Roll', ru: 'Лобстер-ролл' },
    tier: 5,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_maine_lobster', qty: 2 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_lobster_roll', qty: 1, itemClass: 'dish' },
    baseCraftSec: 13200,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #86 Lobster Roll (Sandwiches)
  {
    key: 'rcp_buttermilk_biscuits_and_gravy',
    name: { en: 'Buttermilk Biscuits & Gravy', ru: 'Бисквиты с гарви' },
    tier: 2,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_biscuit', qty: 2 }, { key: 'ingr_gravy', qty: 1 }],
    output: { key: 'dish_buttermilk_biscuits_and_gravy', qty: 1, itemClass: 'dish' },
    baseCraftSec: 600,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #87 Buttermilk Biscuits & Gravy (Southern)
  {
    key: 'rcp_cornbread_and_honey',
    name: { en: 'Cornbread & Honey', ru: 'Кукурузный хлеб с мёдом' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_cornbread', qty: 1 }, { key: 'crop_corn', qty: 1 }],
    output: { key: 'dish_cornbread_and_honey', qty: 1, itemClass: 'dish' },
    baseCraftSec: 720,
    unlock: { kind: 'level', farmLevel: 4 },
  }, // #88 Cornbread & Honey (Southern)
  {
    key: 'rcp_fried_green_tomatoes',
    name: { en: 'Fried Green Tomatoes', ru: 'Жареные зелёные томаты' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_tomato', qty: 4 }, { key: 'ingr_hushpuppy_batter', qty: 1 }],
    output: { key: 'dish_fried_green_tomatoes', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2100,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #89 Fried Green Tomatoes (Southern)
  {
    key: 'rcp_southern_fried_chicken',
    name: { en: 'Southern Fried Chicken', ru: 'Жареная курица по-южному' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 3 }],
    output: { key: 'dish_southern_fried_chicken', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 8 },
  }, // #90 Southern Fried Chicken (Southern)
  {
    key: 'rcp_hushpuppies_basket',
    name: { en: 'Hushpuppies Basket', ru: 'Корзинка хашпаппи' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'ingr_hushpuppy_batter', qty: 3 }],
    output: { key: 'dish_hushpuppies_basket', qty: 1, itemClass: 'dish' },
    baseCraftSec: 1500,
    unlock: { kind: 'level', farmLevel: 7 },
  }, // #91 Hushpuppies Basket (Southern)
  {
    key: 'rcp_catfish_fry_plate',
    name: { en: 'Catfish Fry Plate', ru: 'Тарелка жареного сома' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_catfish', qty: 2 }, { key: 'ingr_hushpuppy_batter', qty: 1 }],
    output: { key: 'dish_catfish_fry_plate', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 9 },
  }, // #92 Catfish Fry Plate (Southern)
  {
    key: 'rcp_pecan_crusted_chicken',
    name: { en: 'Pecan-Crusted Chicken', ru: 'Курица в пекановой панировке' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 2 }, { key: 'crop_pecan', qty: 2 }],
    output: { key: 'dish_pecan_crusted_chicken', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2520,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #93 Pecan-Crusted Chicken (Southern)
  {
    key: 'rcp_nashville_hot_chicken',
    name: { en: 'Nashville Hot Chicken', ru: '«Нэшвиллская» острая курица' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 3 }, { key: 'ingr_bbq_sauce', qty: 1 }],
    output: { key: 'dish_nashville_hot_chicken', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2880,
    unlock: { kind: 'state', stateKey: 'st_tennessee' },
  }, // #94 Nashville Hot Chicken (Southern)
  {
    key: 'rcp_chicago_beef_stew',
    name: { en: 'Chicago Beef Stew', ru: 'Чикагское говяжье рагу' },
    tier: 3,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_beef', qty: 3 }, { key: 'crop_potato', qty: 2 }],
    output: { key: 'dish_chicago_beef_stew', qty: 1, itemClass: 'dish' },
    baseCraftSec: 3300,
    unlock: { kind: 'state', stateKey: 'st_illinois' },
  }, // #95 Chicago Beef Stew (Southern)
  {
    key: 'rcp_cajun_jambalaya',
    name: { en: 'Cajun Jambalaya', ru: 'Каджун-джамбалайя' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'chicken', qty: 2 }, { key: 'crop_gulf_shrimp', qty: 2 }, { key: 'ingr_roux', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_cajun_jambalaya', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6600,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #96 Cajun Jambalaya (Southern)
  {
    key: 'rcp_louisiana_gumbo',
    name: { en: 'Louisiana Gumbo', ru: 'Гамбо Луизианы' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'ingr_roux', qty: 1 }, { key: 'crop_gulf_shrimp', qty: 2 }, { key: 'chicken', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_louisiana_gumbo', qty: 1, itemClass: 'dish' },
    baseCraftSec: 7200,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #97 Louisiana Gumbo (Southern)
  {
    key: 'rcp_texas_chili',
    name: { en: 'Texas Chili', ru: 'Техасский чили' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_beef_brisket', qty: 2 }, { key: 'crop_tomato', qty: 3 }],
    output: { key: 'dish_texas_chili', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'state', stateKey: 'st_texas' },
  }, // #98 Texas Chili (Southern)
  {
    key: 'rcp_smoked_bbq_ribs_platter',
    name: { en: 'Smoked BBQ Ribs Platter', ru: 'Тарелка копчёных рёбрышек' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'crop_beef_brisket', qty: 3 }, { key: 'ingr_bbq_sauce', qty: 2 }],
    output: { key: 'dish_smoked_bbq_ribs_platter', qty: 1, itemClass: 'dish' },
    baseCraftSec: 9600,
    unlock: { kind: 'state', stateKey: 'st_texas' },
  }, // #99 Smoked BBQ Ribs Platter (Southern)
  {
    key: 'rcp_georgia_pecan_pie_plate_special',
    name: { en: 'Georgia Pecan Pie Plate Special', ru: 'Тарелка «Джорджия»' },
    tier: 4,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 2 }, { key: 'crop_pecan', qty: 2 }, { key: 'crop_georgia_peach', qty: 2 }],
    output: { key: 'dish_georgia_pecan_pie_plate_special', qty: 1, itemClass: 'dish' },
    baseCraftSec: 8400,
    unlock: { kind: 'state', stateKey: 'st_georgia' },
  }, // #100 Georgia Pecan Pie Plate Special (Southern)
  {
    key: 'rcp_catfish_bites',
    name: { en: 'Catfish Bites', ru: 'Кусочки сома в панировке' },
    tier: 2,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_catfish', qty: 2 }],
    output: { key: 'dish_catfish_bites', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900,
    unlock: { kind: 'level', farmLevel: 5 },
  }, // #101 Catfish Bites (Seafood)
  {
    key: 'rcp_corn_and_catfish_chowder',
    name: { en: 'Corn & Catfish Chowder', ru: 'Чаудер из сома с кукурузой' },
    tier: 3,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_catfish', qty: 2 }, { key: 'crop_corn', qty: 2 }, { key: 'milk', qty: 1 }],
    output: { key: 'dish_corn_and_catfish_chowder', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2700,
    unlock: { kind: 'level', farmLevel: 9 },
  }, // #102 Corn & Catfish Chowder (Seafood)
  {
    key: 'rcp_county_fish_fry',
    name: { en: 'County Fish Fry', ru: 'Тарелка жареной рыбы округа' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_catfish', qty: 3 }, { key: 'ingr_hushpuppy_batter', qty: 1 }],
    output: { key: 'dish_county_fish_fry', qty: 1, itemClass: 'dish' },
    baseCraftSec: 2400,
    unlock: { kind: 'level', farmLevel: 9 },
  }, // #103 County Fish Fry (Seafood)
  {
    key: 'rcp_shrimp_gumbo_bowl',
    name: { en: 'Shrimp Gumbo Bowl', ru: 'Миска гамбо с креветками' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 3 }, { key: 'ingr_roux', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_shrimp_gumbo_bowl', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6600,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #104 Shrimp Gumbo Bowl (Seafood)
  {
    key: 'rcp_fried_gulf_shrimp_basket',
    name: { en: 'Fried Gulf Shrimp Basket', ru: 'Корзинка жареных креветок Галфа' },
    tier: 4,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 4 }],
    output: { key: 'dish_fried_gulf_shrimp_basket', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5400,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #105 Fried Gulf Shrimp Basket (Seafood)
  {
    key: 'rcp_crawfish_boil',
    name: { en: 'Crawfish Boil', ru: 'Отварные раки по-луизиански' },
    tier: 4,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 5 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_crawfish_boil', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6000,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #106 Crawfish Boil (Seafood)
  {
    key: 'rcp_shrimp_poboy',
    name: { en: 'Shrimp Po\'Boy', ru: 'По-бой с креветками' },
    tier: 4,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'crop_gulf_shrimp', qty: 3 }, { key: 'ingr_coleslaw', qty: 1 }],
    output: { key: 'dish_shrimp_poboy', qty: 1, itemClass: 'dish' },
    baseCraftSec: 5700,
    unlock: { kind: 'state', stateKey: 'st_louisiana' },
  }, // #107 Shrimp Po'Boy (Seafood)
  {
    key: 'rcp_crab_cake_duo',
    name: { en: 'Crab Cake Duo', ru: 'Дуэт крабовых котлет' },
    tier: 4,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_gulf_shrimp', qty: 2 }, { key: 'ingr_cheese_curds', qty: 1 }, { key: 'ingr_bread', qty: 1 }],
    output: { key: 'dish_crab_cake_duo', qty: 1, itemClass: 'dish' },
    baseCraftSec: 6300,
    unlock: { kind: 'level', farmLevel: 14 },
  }, // #108 Crab Cake Duo (Seafood)
  {
    key: 'rcp_maine_lobster_bisque',
    name: { en: 'Maine Lobster Bisque', ru: 'Биск из лобстера Мэна' },
    tier: 5,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_maine_lobster', qty: 2 }, { key: 'ingr_butter', qty: 1 }, { key: 'milk', qty: 2 }],
    output: { key: 'dish_maine_lobster_bisque', qty: 1, itemClass: 'dish' },
    baseCraftSec: 15600,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #109 Maine Lobster Bisque (Seafood)
  {
    key: 'rcp_fried_lobster_tail',
    name: { en: 'Fried Lobster Tail', ru: 'Жареный хвост лобстера' },
    tier: 5,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_maine_lobster', qty: 2 }, { key: 'ingr_hushpuppy_batter', qty: 1 }],
    output: { key: 'dish_fried_lobster_tail', qty: 1, itemClass: 'dish' },
    baseCraftSec: 14400,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #110 Fried Lobster Tail (Seafood)
  {
    key: 'rcp_lobster_roll_deluxe',
    name: { en: 'Lobster Roll Deluxe', ru: 'Лобстер-ролл делюкс' },
    tier: 5,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'dish_lobster_roll', qty: 1 }, { key: 'black_truffle', qty: 1 }, { key: 'ingr_butter', qty: 1 }],
    output: { key: 'dish_lobster_roll_deluxe', qty: 1, itemClass: 'dish' },
    baseCraftSec: 18000,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #111 Lobster Roll Deluxe (Seafood)
  {
    key: 'rcp_maine_clam_and_truffle_chowder',
    name: { en: 'Maine Clam & Truffle Chowder', ru: 'Чаудер из моллюсков Мэна с трюфелем' },
    tier: 5,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'crop_maine_lobster', qty: 1 }, { key: 'black_truffle', qty: 1 }, { key: 'milk', qty: 3 }],
    output: { key: 'dish_maine_clam_and_truffle_chowder', qty: 1, itemClass: 'dish' },
    baseCraftSec: 16800,
    unlock: { kind: 'state', stateKey: 'st_maine' },
  }, // #112 Maine Clam & Truffle Chowder (Seafood)
]
// ─────────────────────────────────────────────────────────────────────────────
// Секретные рецепты-эксперименты — §4.5, 22 шт. (mech_experiment, unlock:'experiment').
// Sec.7/8/12/22 — уникальные блюда сверх основных 112 (§4.5 сноска, §8.4 открытый вопрос).
// Остальные 18 — премиум/кросс-штатные варианты существующих блюд: отдельный Recipe Card
// с собственным output-ключом (а не мутация существующего рецепта).
// Sec.22 Kitchen Sink Special — server-side fallback ЛЮБОГО неудачного эксперимента (R3/R8,
// §7 edge cases); формальный `inputs` — заглушка ×1 базового сырья: реальный расход при
// неудаче считает сервер по фактически потраченным ингредиентам эксперимента.
export const secretRecipes: Recipe[] = [
  {
    key: 'rcp_secret_bacon_shake',
    name: { en: 'Bacon Shake', ru: 'Шейк с беконом' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 3 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_bacon_shake', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.1 Bacon Shake
  {
    key: 'rcp_secret_pickle_lemonade',
    name: { en: 'Pickle Lemonade', ru: 'Лимонад с рассолом' },
    tier: 1,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_lemon', qty: 3 }, { key: 'ingr_pickles', qty: 1 }],
    output: { key: 'dish_pickle_lemonade', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.2 Pickle Lemonade
  {
    key: 'rcp_secret_coffee_glazed_bacon',
    name: { en: 'Coffee-Glazed Bacon', ru: 'Бекон в кофейной глазури' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'bacon', qty: 3 }, { key: 'crop_green_coffee_beans', qty: 1 }],
    output: { key: 'dish_coffee_glazed_bacon', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.3 Coffee-Glazed Bacon
  {
    key: 'rcp_secret_cherry_cola_float',
    name: { en: 'Cherry Cola Float', ru: 'Вишнёво-колный флоат' },
    tier: 2,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 1 }, { key: 'crop_cherry', qty: 2 }],
    output: { key: 'dish_cherry_cola_float', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.4 Cherry Cola Float
  {
    key: 'rcp_secret_honey_fried_chicken',
    name: { en: 'Honey Fried Chicken', ru: 'Курица в медовой панировке' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 3 }, { key: 'honey', qty: 1 }],
    output: { key: 'dish_honey_fried_chicken', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.5 Honey Fried Chicken
  {
    key: 'rcp_secret_peach_bbq_ribs',
    name: { en: 'Peach BBQ Ribs', ru: 'Рёбрышки в персиковом барбекю' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'crop_beef_brisket', qty: 3 }, { key: 'ingr_bbq_sauce', qty: 2 }, { key: 'crop_georgia_peach', qty: 1 }],
    output: { key: 'dish_peach_bbq_ribs', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.6 Peach BBQ Ribs
  {
    key: 'rcp_secret_maple_bacon_doughnut',
    name: { en: 'Maple Bacon Doughnut', ru: 'Пончик с кленовым беконом' },
    tier: 3,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_basic_dough', qty: 1 }, { key: 'bacon', qty: 1 }, { key: 'ingr_maple_syrup', qty: 1 }],
    output: { key: 'dish_maple_bacon_doughnut', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.7 Maple Bacon Doughnut
  {
    key: 'rcp_secret_truffle_fries',
    name: { en: 'Truffle Fries', ru: 'Картофель фри с трюфелем' },
    tier: 5,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_potato', qty: 4 }, { key: 'black_truffle', qty: 1 }],
    output: { key: 'dish_truffle_fries', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.8 Truffle Fries
  {
    key: 'rcp_secret_bacon_maple_ice_cream',
    name: { en: 'Bacon Maple Ice Cream', ru: 'Мороженое с беконом и кленовым сиропом' },
    tier: 4,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'ingr_vanilla_custard', qty: 2 }, { key: 'bacon', qty: 1 }, { key: 'ingr_maple_syrup', qty: 1 }],
    output: { key: 'dish_bacon_maple_ice_cream', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.9 Bacon Maple Ice Cream
  {
    key: 'rcp_secret_spicy_honey_lemonade',
    name: { en: 'Spicy Honey Lemonade', ru: 'Острый медовый лимонад' },
    tier: 3,
    machineKey: 'mch_prep_counter',
    inputs: [{ key: 'crop_lemon', qty: 3 }, { key: 'honey', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_spicy_honey_lemonade', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.10 Spicy Honey Lemonade
  {
    key: 'rcp_secret_cheese_stuffed_cornbread',
    name: { en: 'Cheese-Stuffed Cornbread', ru: 'Кукурузный хлеб с сыром внутри' },
    tier: 2,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_cornbread', qty: 1 }, { key: 'ingr_cheese_curds', qty: 1 }],
    output: { key: 'dish_cheese_stuffed_cornbread', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.11 Cheese-Stuffed Cornbread
  {
    key: 'rcp_secret_lobster_mac_bites',
    name: { en: 'Lobster Mac Bites', ru: 'Лобстерные мак-биты' },
    tier: 5,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'crop_maine_lobster', qty: 1 }, { key: 'ingr_cheese_curds', qty: 2 }, { key: 'ingr_bread', qty: 1 }],
    output: { key: 'dish_lobster_mac_bites', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.12 Lobster Mac Bites
  {
    key: 'rcp_secret_crawfish_cornbread',
    name: { en: 'Crawfish Cornbread', ru: 'Кукурузный хлеб с раками' },
    tier: 4,
    machineKey: 'mch_oven',
    inputs: [{ key: 'ingr_cornbread', qty: 1 }, { key: 'crop_gulf_shrimp', qty: 2 }],
    output: { key: 'dish_crawfish_cornbread', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.13 Crawfish Cornbread
  {
    key: 'rcp_secret_chili_chocolate_soda',
    name: { en: 'Chili Chocolate Soda', ru: 'Шоколадная содовая с перцем' },
    tier: 3,
    machineKey: 'mch_soda_fountain',
    inputs: [{ key: 'milk', qty: 2 }, { key: 'crop_cocoa', qty: 1 }, { key: 'ingr_cajun_spice_blend', qty: 1 }],
    output: { key: 'dish_chili_chocolate_soda', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.14 Chili Chocolate Soda
  {
    key: 'rcp_secret_smoked_honey_butter',
    name: { en: 'Smoked Honey Butter', ru: 'Копчёное медовое масло' },
    tier: 3,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'ingr_butter', qty: 2 }, { key: 'honey', qty: 1 }],
    output: { key: 'dish_smoked_honey_butter', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.15 Smoked Honey Butter
  {
    key: 'rcp_secret_sweet_tea_fried_chicken',
    name: { en: 'Sweet Tea Fried Chicken', ru: 'Курица, жаренная в сладком чае' },
    tier: 3,
    machineKey: 'mch_fryer',
    inputs: [{ key: 'chicken', qty: 3 }, { key: 'dish_sweet_tea', qty: 1 }],
    output: { key: 'dish_sweet_tea_fried_chicken', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.16 Sweet Tea Fried Chicken
  {
    key: 'rcp_secret_truffle_grilled_cheese',
    name: { en: 'Truffle Grilled Cheese', ru: 'Гриль-сэндвич с трюфелем' },
    tier: 5,
    machineKey: 'mch_grill',
    inputs: [{ key: 'ingr_bread', qty: 2 }, { key: 'ingr_cheese_curds', qty: 1 }, { key: 'black_truffle', qty: 1 }],
    output: { key: 'dish_truffle_grilled_cheese', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.17 Truffle Grilled Cheese
  {
    key: 'rcp_secret_coffee_bbq_brisket',
    name: { en: 'Coffee BBQ Brisket', ru: 'Бришкет в кофейном барбекю' },
    tier: 4,
    machineKey: 'mch_smoker',
    inputs: [{ key: 'crop_beef_brisket', qty: 3 }, { key: 'ingr_bbq_sauce', qty: 1 }, { key: 'crop_green_coffee_beans', qty: 1 }],
    output: { key: 'dish_coffee_bbq_brisket', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.18 Coffee BBQ Brisket
  {
    key: 'rcp_secret_cornbread_ice_cream',
    name: { en: 'Cornbread Ice Cream', ru: 'Мороженое с кукурузным хлебом' },
    tier: 3,
    machineKey: 'mch_ice_cream',
    inputs: [{ key: 'ingr_vanilla_custard', qty: 1 }, { key: 'ingr_cornbread', qty: 1 }],
    output: { key: 'dish_cornbread_ice_cream', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.19 Cornbread Ice Cream
  {
    key: 'rcp_secret_pecan_bacon_waffles',
    name: { en: 'Pecan Bacon Waffles', ru: 'Вафли с пеканом и беконом' },
    tier: 3,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_wheat', qty: 2 }, { key: 'egg', qty: 1 }, { key: 'crop_pecan', qty: 2 }, { key: 'bacon', qty: 1 }],
    output: { key: 'dish_pecan_bacon_waffles', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.20 Pecan Bacon Waffles
  {
    key: 'rcp_secret_ghost_pepper_gumbo',
    name: { en: 'Ghost Pepper Gumbo', ru: 'Гамбо с перцем-призраком' },
    tier: 5,
    machineKey: 'mch_steam_kettle',
    inputs: [{ key: 'ingr_roux', qty: 1 }, { key: 'crop_gulf_shrimp', qty: 2 }, { key: 'chicken', qty: 1 }, { key: 'crop_california_navel_orange', qty: 1 }],
    output: { key: 'dish_ghost_pepper_gumbo', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.21 Ghost Pepper Gumbo
  {
    key: 'rcp_secret_kitchen_sink_special',
    name: { en: 'Kitchen Sink Special', ru: 'Что бог послал' },
    tier: 1,
    machineKey: 'mch_grill',
    inputs: [{ key: 'crop_wheat', qty: 1 }],
    output: { key: 'dish_kitchen_sink_special', qty: 1, itemClass: 'dish' },
    baseCraftSec: 900, // фиксировано 15 мин для ЛЮБОГО эксперимента (§3.5)
    unlock: { kind: 'experiment' },
  }, // Sec.22 Kitchen Sink Special
]

// ─────────────────────────────────────────────────────────────────────────────
// Основной экспорт каталога — контракт CONTENT_CATALOGS (schema.ts): file='recipes',
// exportName='recipes'.
// ─────────────────────────────────────────────────────────────────────────────
export const recipes: Recipe[] = [
  ...bridgeSemiProducts,
  ...newSemiProducts,
  ...dishes,
  ...secretRecipes,
]
// ─────────────────────────────────────────────────────────────────────────────
// Blue Plate Special — §4.4, 34 сета (Main+Side+Drink). Доп. экспорт (BluePlateSchema),
// не входит в CONTENT_CATALOGS (нет отдельной проверки в validate.test.ts) — см. свой
// co-located тест catalogs/recipes.test.ts для схемы + ссылочной целостности на `recipes`.
// Тир сета = тир Main (§3.6, закрытое правило). #34 — заявленное исключение (смешение
// тиров, штраф к бонусу, см. R9 §7).
// ─────────────────────────────────────────────────────────────────────────────
export const bluePlateSets: BluePlate[] = [
  {
    key: 'bp_01_morning_starter',
    main: 'rcp_farm_scramble',
    side: 'rcp_toast',
    drink: 'rcp_home_lemonade',
    priceBonusPct: 15,
  }, // 1 Morning Starter / Утренний старт (T1, main=#2 side=#1 drink=#3)
  {
    key: 'bp_02_griddle_classic',
    main: 'rcp_buttermilk_pancakes',
    side: 'rcp_country_ham_and_eggs',
    drink: 'rcp_cream_soda',
    priceBonusPct: 16,
  }, // 2 Griddle Classic / Классика с гриля (T2, main=#5 side=#4 drink=#48)
  {
    key: 'bp_03_diner_waffle_combo',
    main: 'rcp_strawberry_waffles',
    side: 'rcp_bacon_grilled_cheese',
    drink: 'rcp_classic_milkshake',
    priceBonusPct: 17,
  }, // 3 Diner Waffle Combo / Вафельный сет дайнера (T2, main=#6 side=#7 drink=#50)
  {
    key: 'bp_04_blue_plate_classic',
    main: 'rcp_classic_burger',
    side: 'rcp_corn_dog',
    drink: 'rcp_classic_milkshake',
    priceBonusPct: 18,
  }, // 4 Blue Plate Classic / Классический сет дня (T2, main=#33 side=#34 drink=#50)
  {
    key: 'bp_05_diner_coffee_plate',
    main: 'rcp_bacon_cheeseburger',
    side: 'rcp_grilled_cheese',
    drink: 'rcp_farmhouse_coffee',
    priceBonusPct: 18,
  }, // 5 Diner Coffee Plate / Кофейная тарелка дайнера (T2, main=#35 side=#77 drink=#52)
  {
    key: 'bp_06_county_harvest_plate',
    main: 'rcp_county_beef_burger',
    side: 'rcp_fried_green_tomatoes',
    drink: 'rcp_strawberry_malt',
    priceBonusPct: 19,
  }, // 6 County Harvest Plate / Тарелка урожая округа (T3, main=#37 side=#89 drink=#53)
  {
    key: 'bp_07_deluxe_diner_set',
    main: 'rcp_deluxe_burger',
    side: 'rcp_hushpuppies_basket',
    drink: 'rcp_southern_coffee',
    priceBonusPct: 20,
  }, // 7 Deluxe Diner Set / Делюкс-сет дайнера (T3, main=#38 side=#91 drink=#54)
  {
    key: 'bp_08_cherry_on_top',
    main: 'rcp_cherry_pie_a_la_mode',
    side: 'rcp_honey_pecan_toast',
    drink: 'rcp_honey_cream_coffee',
    priceBonusPct: 20,
  }, // 8 Cherry on Top / Вишенка на вершине (T3, main=#21 side=#10 drink=#55)
  {
    key: 'bp_09_pumpkin_harvest_combo',
    main: 'rcp_pumpkin_pie',
    side: 'rcp_pumpkin_ice_cream',
    drink: 'rcp_pumpkin_spice_shake',
    priceBonusPct: 22,
  }, // 9 Pumpkin Harvest Combo / Тыквенный сет урожая (T3, main=#22 side=#67 drink=#56)
  {
    key: 'bp_10_nashville_sweet_and_heat',
    main: 'rcp_nashville_hot_chicken',
    side: 'rcp_honey_pecan_pie',
    drink: 'rcp_honey_cream_coffee',
    priceBonusPct: 21,
  }, // 10 Nashville Sweet & Heat / Нэшвиллская сладко-остро (T3, main=#94 side=#23 drink=#55)
  {
    key: 'bp_11_pecan_praline_plate',
    main: 'rcp_pecan_crusted_chicken',
    side: 'rcp_pecan_praline',
    drink: 'rcp_southern_coffee',
    priceBonusPct: 20,
  }, // 11 Pecan Praline Plate / Тарелка пекановой пралине (T3, main=#93 side=#68 drink=#54)
  {
    key: 'bp_12_catfish_county_plate',
    main: 'rcp_county_fish_fry',
    side: 'rcp_corn_and_catfish_chowder',
    drink: 'rcp_sweet_tea',
    priceBonusPct: 19,
  }, // 12 Catfish County Plate / Сомовая тарелка округа (T3, main=#103 side=#102 drink=#47)
  {
    key: 'bp_13_chicago_stopover',
    main: 'rcp_chicago_deep_dish_sausage_melt',
    side: 'rcp_chicago_beef_stew',
    drink: 'rcp_farmhouse_coffee',
    priceBonusPct: 20,
  }, // 13 Chicago Stopover / Чикагская остановка (T3, main=#41 side=#95 drink=#52)
  {
    key: 'bp_14_grill_master_combo',
    main: 'rcp_grilled_beef_steak',
    side: 'rcp_honey_bbq_ribs',
    drink: 'rcp_strawberry_malt',
    priceBonusPct: 21,
  }, // 14 Grill Master Combo / Комбо гриль-мастера (T3, main=#39 side=#40 drink=#53)
  {
    key: 'bp_15_patty_melt_plate',
    main: 'rcp_patty_melt',
    side: 'rcp_fried_green_tomatoes',
    drink: 'rcp_southern_coffee',
    priceBonusPct: 19,
  }, // 15 Patty Melt Plate / Тарелка пэтти-мелт (T3, main=#81 side=#89 drink=#54)
  {
    key: 'bp_16_beef_dip_diner',
    main: 'rcp_beef_dip_sandwich',
    side: 'rcp_sunrise_skillet',
    drink: 'rcp_honey_cream_coffee',
    priceBonusPct: 20,
  }, // 16 Beef Dip Diner / Дайнер-дип из говядины (T3, main=#82 side=#8 drink=#55)
  {
    key: 'bp_17_pimento_porch_plate',
    main: 'rcp_southern_pimento_cheese_sandwich',
    side: 'rcp_buttermilk_biscuits_and_gravy',
    drink: 'rcp_sweet_tea',
    priceBonusPct: 18,
  }, // 17 Pimento Porch Plate / Пимento-тарелка на веранде (T3, main=#83 side=#87 drink=#47)
  {
    key: 'bp_18_georgia_peach_plate',
    main: 'rcp_peach_glazed_pork_chop',
    side: 'rcp_georgia_peach_cobbler',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 23,
  }, // 18 Georgia Peach Plate / Персиковая тарелка Джорджии (T4, main=#42 side=#25 drink=#57)
  {
    key: 'bp_19_georgia_sunday_special',
    main: 'rcp_peach_melba_tart',
    side: 'rcp_georgia_peach_ice_cream',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 24,
  }, // 19 Georgia Sunday Special / Джорджийский воскресный сет (T4, main=#26 side=#70 drink=#57)
  {
    key: 'bp_20_texas_smokehouse_plate',
    main: 'rcp_texas_smoked_brisket_plate',
    side: 'rcp_texas_chili',
    drink: 'rcp_maple_coffee_malt',
    priceBonusPct: 23,
  }, // 20 Texas Smokehouse Plate / Тарелка техасской коптильни (T4, main=#43 side=#98 drink=#58)
  {
    key: 'bp_21_texas_bbq_feast',
    main: 'rcp_smoked_bbq_ribs_platter',
    side: 'rcp_brisket_sandwich',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 24,
  }, // 21 Texas BBQ Feast / Пир техасского барбекю (T4, main=#99 side=#85 drink=#57)
  {
    key: 'bp_22_bayou_boil_plate',
    main: 'rcp_crawfish_boil',
    side: 'rcp_louisiana_gumbo',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 25,
  }, // 22 Bayou Boil Plate / Тарелка Кипячение на байю (T4, main=#106 side=#97 drink=#57)
  {
    key: 'bp_23_cajun_fishermans_plate',
    main: 'rcp_fried_gulf_shrimp_basket',
    side: 'rcp_cajun_jambalaya',
    drink: 'rcp_maple_coffee_malt',
    priceBonusPct: 24,
  }, // 23 Cajun Fisherman's Plate / Тарелка каджун-рыбака (T4, main=#105 side=#96 drink=#58)
  {
    key: 'bp_24_poboy_combo',
    main: 'rcp_shrimp_poboy',
    side: 'rcp_shrimp_gumbo_bowl',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 23,
  }, // 24 Po'Boy Combo / Сет с по-боем (T4, main=#107 side=#104 drink=#57)
  {
    key: 'bp_25_cajun_chicken_plate',
    main: 'rcp_cajun_chicken_sandwich',
    side: 'rcp_cajun_grilled_shrimp_skewer',
    drink: 'rcp_maple_coffee_malt',
    priceBonusPct: 22,
  }, // 25 Cajun Chicken Plate / Тарелка каджун-курицы (T4, main=#84 side=#44 drink=#58)
  {
    key: 'bp_26_maple_bacon_diner_set',
    main: 'rcp_maple_bacon_burger',
    side: 'rcp_maple_waffles',
    drink: 'rcp_maple_coffee_malt',
    priceBonusPct: 25,
  }, // 26 Maple Bacon Diner Set / Дайнер-сет с кленовым беконом (T4, main=#45 side=#11 drink=#58)
  {
    key: 'bp_27_crab_and_corn_plate',
    main: 'rcp_crab_cake_duo',
    side: 'rcp_corn_and_catfish_chowder',
    drink: 'rcp_peach_sweet_tea',
    priceBonusPct: 21,
  }, // 27 Crab & Corn Plate / Тарелка краб и кукуруза (T4, main=#108 side=#102 drink=#57)
  {
    key: 'bp_28_georgia_grand_plate',
    main: 'rcp_georgia_pecan_pie_plate_special',
    side: 'rcp_praline_bread_pudding',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 25,
  }, // 28 Georgia Grand Plate / Большая тарелка Джорджии (T4, main=#100 side=#71 drink=#60)
  {
    key: 'bp_29_maine_lobster_feast',
    main: 'rcp_legends_lobster_steak',
    side: 'rcp_maine_lobster_bisque',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 26,
  }, // 29 Maine Lobster Feast / Пир лобстера Мэна (T5, main=#46 side=#109 drink=#60)
  {
    key: 'bp_30_lobster_roll_royale',
    main: 'rcp_lobster_roll_deluxe',
    side: 'rcp_fried_lobster_tail',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 26,
  }, // 30 Lobster Roll Royale / Лобстер-ролл рояль (T5, main=#111 side=#110 drink=#60)
  {
    key: 'bp_31_california_vanilla_dream',
    main: 'rcp_vanilla_bean_layer_cake',
    side: 'rcp_truffle_honey_gelato',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 25,
  }, // 31 California Vanilla Dream / Калифорнийская ванильная мечта (T5, main=#30 side=#73 drink=#60)
  {
    key: 'bp_32_truffle_indulgence_plate',
    main: 'rcp_truffle_butter_croissant',
    side: 'rcp_vanilla_citrus_panna_cotta',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 25,
  }, // 32 Truffle Indulgence Plate / Тарелка трюфельного наслаждения (T5, main=#28 side=#74 drink=#60)
  {
    key: 'bp_33_chowder_and_clam_feast',
    main: 'rcp_maine_clam_and_truffle_chowder',
    side: 'rcp_maine_lobster_bisque',
    drink: 'rcp_california_citrus_cooler',
    priceBonusPct: 26,
  }, // 33 Chowder & Clam Feast / Пир из чаудера и моллюсков (T5, main=#112 side=#109 drink=#60)
  {
    key: 'bp_34_grand_county_sampler',
    main: 'rcp_deluxe_burger',
    side: 'rcp_corn_bread_loaf',
    drink: 'rcp_strawberry_malt',
    priceBonusPct: 17,
  }, // 34 Grand County Sampler / Большой сет округа (кросс-тирный) (T3, main=#38 side=#19 drink=#53)
]

// ─────────────────────────────────────────────────────────────────────────────
// recipeCatalogMeta — мост цена/категория спроса до появления catalogs/ingredients.ts.
// RecipeSchema намеренно НЕ несёт basePrice/demandCategory (те живут на IngredientSchema
// итогового товара, см. докстринг schema.ts). Полуфабрикаты не продаются — здесь нет записей
// для prod_* выходов (04-machines.md §3.5 R-modelle «нельзя продать напрямую»).
// ─────────────────────────────────────────────────────────────────────────────
export interface RecipeCatalogMeta {
  recipeKey: string
  basePrice: number
  demandCategory: string
}

export const recipeCatalogMeta: RecipeCatalogMeta[] = [
  { recipeKey: 'rcp_toast', basePrice: 5, demandCategory: 'breakfasts' }, // #1
  { recipeKey: 'rcp_farm_scramble', basePrice: 6, demandCategory: 'breakfasts' }, // #2
  { recipeKey: 'rcp_home_lemonade', basePrice: 6, demandCategory: 'breakfasts' }, // #3
  { recipeKey: 'rcp_country_ham_and_eggs', basePrice: 18, demandCategory: 'breakfasts' }, // #4
  { recipeKey: 'rcp_buttermilk_pancakes', basePrice: 16, demandCategory: 'breakfasts' }, // #5
  { recipeKey: 'rcp_strawberry_waffles', basePrice: 24, demandCategory: 'breakfasts' }, // #6
  { recipeKey: 'rcp_bacon_grilled_cheese', basePrice: 22, demandCategory: 'breakfasts' }, // #7
  { recipeKey: 'rcp_sunrise_skillet', basePrice: 65, demandCategory: 'breakfasts' }, // #8
  { recipeKey: 'rcp_cherry_blintz', basePrice: 70, demandCategory: 'breakfasts' }, // #9
  { recipeKey: 'rcp_honey_pecan_toast', basePrice: 25, demandCategory: 'breakfasts' }, // #10
  { recipeKey: 'rcp_maple_waffles', basePrice: 190, demandCategory: 'breakfasts' }, // #11
  { recipeKey: 'rcp_peach_morning_cobbler', basePrice: 220, demandCategory: 'breakfasts' }, // #12
  { recipeKey: 'rcp_dinner_roll', basePrice: 5, demandCategory: 'baking' }, // #13
  { recipeKey: 'rcp_sugar_cookie', basePrice: 7, demandCategory: 'baking' }, // #14
  { recipeKey: 'rcp_corn_muffin', basePrice: 6, demandCategory: 'baking' }, // #15
  { recipeKey: 'rcp_strawberry_shortcake', basePrice: 26, demandCategory: 'baking' }, // #16
  { recipeKey: 'rcp_buttermilk_biscuit_plate', basePrice: 20, demandCategory: 'baking' }, // #17
  { recipeKey: 'rcp_apple_pie', basePrice: 28, demandCategory: 'baking' }, // #18
  { recipeKey: 'rcp_corn_bread_loaf', basePrice: 21, demandCategory: 'baking' }, // #19
  { recipeKey: 'rcp_cherry_pie', basePrice: 75, demandCategory: 'baking' }, // #20
  { recipeKey: 'rcp_cherry_pie_a_la_mode', basePrice: 75, demandCategory: 'baking' }, // #21
  { recipeKey: 'rcp_pumpkin_pie', basePrice: 82, demandCategory: 'baking' }, // #22
  { recipeKey: 'rcp_honey_pecan_pie', basePrice: 88, demandCategory: 'baking' }, // #23
  { recipeKey: 'rcp_coffee_crumb_cake', basePrice: 70, demandCategory: 'baking' }, // #24
  { recipeKey: 'rcp_georgia_peach_cobbler', basePrice: 240, demandCategory: 'baking' }, // #25
  { recipeKey: 'rcp_peach_melba_tart', basePrice: 265, demandCategory: 'baking' }, // #26
  { recipeKey: 'rcp_maple_pecan_roll', basePrice: 210, demandCategory: 'baking' }, // #27
  { recipeKey: 'rcp_truffle_butter_croissant', basePrice: 780, demandCategory: 'baking' }, // #28
  { recipeKey: 'rcp_lobster_pot_pie', basePrice: 850, demandCategory: 'baking' }, // #29
  { recipeKey: 'rcp_vanilla_bean_layer_cake', basePrice: 720, demandCategory: 'baking' }, // #30
  { recipeKey: 'rcp_grilled_corn', basePrice: 5, demandCategory: 'grill' }, // #31
  { recipeKey: 'rcp_veggie_skewer', basePrice: 6, demandCategory: 'grill' }, // #32
  { recipeKey: 'rcp_classic_burger', basePrice: 20, demandCategory: 'grill' }, // #33
  { recipeKey: 'rcp_corn_dog', basePrice: 18, demandCategory: 'grill' }, // #34
  { recipeKey: 'rcp_bacon_cheeseburger', basePrice: 30, demandCategory: 'grill' }, // #35
  { recipeKey: 'rcp_strawberry_glazed_ham', basePrice: 26, demandCategory: 'grill' }, // #36
  { recipeKey: 'rcp_county_beef_burger', basePrice: 68, demandCategory: 'grill' }, // #37
  { recipeKey: 'rcp_deluxe_burger', basePrice: 90, demandCategory: 'grill' }, // #38
  { recipeKey: 'rcp_grilled_beef_steak', basePrice: 85, demandCategory: 'grill' }, // #39
  { recipeKey: 'rcp_honey_bbq_ribs', basePrice: 80, demandCategory: 'grill' }, // #40
  { recipeKey: 'rcp_chicago_deep_dish_sausage_melt', basePrice: 72, demandCategory: 'grill' }, // #41
  { recipeKey: 'rcp_peach_glazed_pork_chop', basePrice: 210, demandCategory: 'grill' }, // #42
  { recipeKey: 'rcp_texas_smoked_brisket_plate', basePrice: 300, demandCategory: 'grill' }, // #43
  { recipeKey: 'rcp_cajun_grilled_shrimp_skewer', basePrice: 230, demandCategory: 'grill' }, // #44
  { recipeKey: 'rcp_maple_bacon_burger', basePrice: 270, demandCategory: 'grill' }, // #45
  { recipeKey: 'rcp_legends_lobster_steak', basePrice: 900, demandCategory: 'grill' }, // #46
  { recipeKey: 'rcp_sweet_tea', basePrice: 4, demandCategory: 'beverages' }, // #47
  { recipeKey: 'rcp_cream_soda', basePrice: 14, demandCategory: 'beverages' }, // #48
  { recipeKey: 'rcp_fresh_lemonade_float', basePrice: 15, demandCategory: 'beverages' }, // #49
  { recipeKey: 'rcp_classic_milkshake', basePrice: 20, demandCategory: 'beverages' }, // #50
  { recipeKey: 'rcp_chocolate_soda', basePrice: 18, demandCategory: 'beverages' }, // #51
  { recipeKey: 'rcp_farmhouse_coffee', basePrice: 14, demandCategory: 'beverages' }, // #52
  { recipeKey: 'rcp_strawberry_malt', basePrice: 42, demandCategory: 'beverages' }, // #53
  { recipeKey: 'rcp_southern_coffee', basePrice: 33, demandCategory: 'beverages' }, // #54
  { recipeKey: 'rcp_honey_cream_coffee', basePrice: 42, demandCategory: 'beverages' }, // #55
  { recipeKey: 'rcp_pumpkin_spice_shake', basePrice: 60, demandCategory: 'beverages' }, // #56
  { recipeKey: 'rcp_peach_sweet_tea', basePrice: 165, demandCategory: 'beverages' }, // #57
  { recipeKey: 'rcp_maple_coffee_malt', basePrice: 200, demandCategory: 'beverages' }, // #58
  { recipeKey: 'rcp_banana_split', basePrice: 95, demandCategory: 'beverages' }, // #59   // #59 Banana Split — доп. тег 'desserts' не выражен (открытый вопрос §8.3, одна категория на meta-запись)
  { recipeKey: 'rcp_california_citrus_cooler', basePrice: 560, demandCategory: 'beverages' }, // #60
  { recipeKey: 'rcp_vanilla_scoop', basePrice: 14, demandCategory: 'desserts' }, // #61
  { recipeKey: 'rcp_honey_cookie', basePrice: 6, demandCategory: 'desserts' }, // #62
  { recipeKey: 'rcp_strawberry_sundae', basePrice: 24, demandCategory: 'desserts' }, // #63
  { recipeKey: 'rcp_buttermilk_pudding', basePrice: 22, demandCategory: 'desserts' }, // #64
  { recipeKey: 'rcp_caramel_apple', basePrice: 19, demandCategory: 'desserts' }, // #65
  { recipeKey: 'rcp_cherry_cobbler_sundae', basePrice: 78, demandCategory: 'desserts' }, // #66
  { recipeKey: 'rcp_pumpkin_ice_cream', basePrice: 74, demandCategory: 'desserts' }, // #67
  { recipeKey: 'rcp_pecan_praline', basePrice: 68, demandCategory: 'desserts' }, // #68
  { recipeKey: 'rcp_honey_pecan_ice_cream', basePrice: 80, demandCategory: 'desserts' }, // #69
  { recipeKey: 'rcp_georgia_peach_ice_cream', basePrice: 200, demandCategory: 'desserts' }, // #70
  { recipeKey: 'rcp_praline_bread_pudding', basePrice: 105, demandCategory: 'desserts' }, // #71
  { recipeKey: 'rcp_maple_pecan_sundae', basePrice: 210, demandCategory: 'desserts' }, // #72
  { recipeKey: 'rcp_truffle_honey_gelato', basePrice: 620, demandCategory: 'desserts' }, // #73
  { recipeKey: 'rcp_vanilla_citrus_panna_cotta', basePrice: 590, demandCategory: 'desserts' }, // #74
  { recipeKey: 'rcp_egg_salad_sandwich', basePrice: 7, demandCategory: 'sandwiches' }, // #75
  { recipeKey: 'rcp_tomato_and_lettuce_sandwich', basePrice: 6, demandCategory: 'sandwiches' }, // #76
  { recipeKey: 'rcp_grilled_cheese', basePrice: 16, demandCategory: 'sandwiches' }, // #77
  { recipeKey: 'rcp_blt', basePrice: 22, demandCategory: 'sandwiches' }, // #78
  { recipeKey: 'rcp_ham_and_cheese_melt', basePrice: 24, demandCategory: 'sandwiches' }, // #79
  { recipeKey: 'rcp_club_sandwich', basePrice: 28, demandCategory: 'sandwiches' }, // #80
  { recipeKey: 'rcp_patty_melt', basePrice: 72, demandCategory: 'sandwiches' }, // #81
  { recipeKey: 'rcp_beef_dip_sandwich', basePrice: 76, demandCategory: 'sandwiches' }, // #82
  { recipeKey: 'rcp_southern_pimento_cheese_sandwich', basePrice: 62, demandCategory: 'sandwiches' }, // #83
  { recipeKey: 'rcp_cajun_chicken_sandwich', basePrice: 195, demandCategory: 'sandwiches' }, // #84
  { recipeKey: 'rcp_brisket_sandwich', basePrice: 280, demandCategory: 'sandwiches' }, // #85
  { recipeKey: 'rcp_lobster_roll', basePrice: 540, demandCategory: 'sandwiches' }, // #86
  { recipeKey: 'rcp_buttermilk_biscuits_and_gravy', basePrice: 19, demandCategory: 'southern_cuisine' }, // #87
  { recipeKey: 'rcp_cornbread_and_honey', basePrice: 20, demandCategory: 'southern_cuisine' }, // #88
  { recipeKey: 'rcp_fried_green_tomatoes', basePrice: 65, demandCategory: 'southern_cuisine' }, // #89
  { recipeKey: 'rcp_southern_fried_chicken', basePrice: 78, demandCategory: 'southern_cuisine' }, // #90
  { recipeKey: 'rcp_hushpuppies_basket', basePrice: 42, demandCategory: 'southern_cuisine' }, // #91
  { recipeKey: 'rcp_catfish_fry_plate', basePrice: 70, demandCategory: 'southern_cuisine' }, // #92
  { recipeKey: 'rcp_pecan_crusted_chicken', basePrice: 74, demandCategory: 'southern_cuisine' }, // #93
  { recipeKey: 'rcp_nashville_hot_chicken', basePrice: 82, demandCategory: 'southern_cuisine' }, // #94
  { recipeKey: 'rcp_chicago_beef_stew', basePrice: 85, demandCategory: 'southern_cuisine' }, // #95
  { recipeKey: 'rcp_cajun_jambalaya', basePrice: 250, demandCategory: 'southern_cuisine' }, // #96
  { recipeKey: 'rcp_louisiana_gumbo', basePrice: 260, demandCategory: 'southern_cuisine' }, // #97
  { recipeKey: 'rcp_texas_chili', basePrice: 220, demandCategory: 'southern_cuisine' }, // #98
  { recipeKey: 'rcp_smoked_bbq_ribs_platter', basePrice: 310, demandCategory: 'southern_cuisine' }, // #99
  { recipeKey: 'rcp_georgia_pecan_pie_plate_special', basePrice: 340, demandCategory: 'southern_cuisine' }, // #100
  { recipeKey: 'rcp_catfish_bites', basePrice: 20, demandCategory: 'seafood' }, // #101
  { recipeKey: 'rcp_corn_and_catfish_chowder', basePrice: 76, demandCategory: 'seafood' }, // #102
  { recipeKey: 'rcp_county_fish_fry', basePrice: 72, demandCategory: 'seafood' }, // #103
  { recipeKey: 'rcp_shrimp_gumbo_bowl', basePrice: 245, demandCategory: 'seafood' }, // #104
  { recipeKey: 'rcp_fried_gulf_shrimp_basket', basePrice: 210, demandCategory: 'seafood' }, // #105
  { recipeKey: 'rcp_crawfish_boil', basePrice: 225, demandCategory: 'seafood' }, // #106
  { recipeKey: 'rcp_shrimp_poboy', basePrice: 215, demandCategory: 'seafood' }, // #107
  { recipeKey: 'rcp_crab_cake_duo', basePrice: 230, demandCategory: 'seafood' }, // #108
  { recipeKey: 'rcp_maine_lobster_bisque', basePrice: 640, demandCategory: 'seafood' }, // #109
  { recipeKey: 'rcp_fried_lobster_tail', basePrice: 610, demandCategory: 'seafood' }, // #110
  { recipeKey: 'rcp_lobster_roll_deluxe', basePrice: 950, demandCategory: 'seafood' }, // #111
  { recipeKey: 'rcp_maine_clam_and_truffle_chowder', basePrice: 900, demandCategory: 'seafood' }, // #112
]

export const secretRecipeCatalogMeta: RecipeCatalogMeta[] = [
  { recipeKey: 'rcp_secret_bacon_shake', basePrice: 50, demandCategory: 'beverages' }, // Sec.1 Bacon Shake
  { recipeKey: 'rcp_secret_pickle_lemonade', basePrice: 6, demandCategory: 'beverages' }, // Sec.2 Pickle Lemonade
  { recipeKey: 'rcp_secret_coffee_glazed_bacon', basePrice: 37, demandCategory: 'grill' }, // Sec.3 Coffee-Glazed Bacon
  { recipeKey: 'rcp_secret_cherry_cola_float', basePrice: 14, demandCategory: 'beverages' }, // Sec.4 Cherry Cola Float
  { recipeKey: 'rcp_secret_honey_fried_chicken', basePrice: 94, demandCategory: 'southern_cuisine' }, // Sec.5 Honey Fried Chicken
  { recipeKey: 'rcp_secret_peach_bbq_ribs', basePrice: 341, demandCategory: 'southern_cuisine' }, // Sec.6 Peach BBQ Ribs
  { recipeKey: 'rcp_secret_maple_bacon_doughnut', basePrice: 55, demandCategory: 'baking' }, // Sec.7 Maple Bacon Doughnut
  { recipeKey: 'rcp_secret_truffle_fries', basePrice: 560, demandCategory: 'southern_cuisine' }, // Sec.8 Truffle Fries
  { recipeKey: 'rcp_secret_bacon_maple_ice_cream', basePrice: 195, demandCategory: 'desserts' }, // Sec.9 Bacon Maple Ice Cream
  { recipeKey: 'rcp_secret_spicy_honey_lemonade', basePrice: 45, demandCategory: 'beverages' }, // Sec.10 Spicy Honey Lemonade
  { recipeKey: 'rcp_secret_cheese_stuffed_cornbread', basePrice: 23, demandCategory: 'baking' }, // Sec.11 Cheese-Stuffed Cornbread
  { recipeKey: 'rcp_secret_lobster_mac_bites', basePrice: 580, demandCategory: 'seafood' }, // Sec.12 Lobster Mac Bites
  { recipeKey: 'rcp_secret_crawfish_cornbread', basePrice: 215, demandCategory: 'southern_cuisine' }, // Sec.13 Crawfish Cornbread
  { recipeKey: 'rcp_secret_chili_chocolate_soda', basePrice: 23, demandCategory: 'beverages' }, // Sec.14 Chili Chocolate Soda
  { recipeKey: 'rcp_secret_smoked_honey_butter', basePrice: 75, demandCategory: 'baking' }, // Sec.15 Smoked Honey Butter
  { recipeKey: 'rcp_secret_sweet_tea_fried_chicken', basePrice: 92, demandCategory: 'southern_cuisine' }, // Sec.16 Sweet Tea Fried Chicken
  { recipeKey: 'rcp_secret_truffle_grilled_cheese', basePrice: 580, demandCategory: 'sandwiches' }, // Sec.17 Truffle Grilled Cheese
  { recipeKey: 'rcp_secret_coffee_bbq_brisket', basePrice: 330, demandCategory: 'southern_cuisine' }, // Sec.18 Coffee BBQ Brisket
  { recipeKey: 'rcp_secret_cornbread_ice_cream', basePrice: 28, demandCategory: 'desserts' }, // Sec.19 Cornbread Ice Cream
  { recipeKey: 'rcp_secret_pecan_bacon_waffles', basePrice: 30, demandCategory: 'breakfasts' }, // Sec.20 Pecan Bacon Waffles
  { recipeKey: 'rcp_secret_ghost_pepper_gumbo', basePrice: 320, demandCategory: 'southern_cuisine' }, // Sec.21 Ghost Pepper Gumbo
  { recipeKey: 'rcp_secret_kitchen_sink_special', basePrice: 4, demandCategory: 'breakfasts' }, // Sec.22 Kitchen Sink Special
]

// ─────────────────────────────────────────────────────────────────────────────
// RECIPE_MASTERY_CURVE — единственный источник истины (R18, §3.3): 5 уровней ★,
// общие для ВСЕХ рецептов (не по одному конфигу на рецепт). requiredCrafts — порог
// счётчика «готовили N раз»; timeBonusPct/priceBonusPct — модификаторы к baseCraftSec
// / basePrice (отрицательное время = быстрее, положительная цена = дороже).
// ─────────────────────────────────────────────────────────────────────────────
export interface MasteryTier {
  /** Число закрашенных ★ на карточке (1..5) — НЕ ноль-индекс. ★☆☆☆☆ (база) считается stars=1. */
  stars: 1 | 2 | 3 | 4 | 5
  requiredCrafts: number
  timeBonusPct: number
  priceBonusPct: number
  visualTier: string
}

export const RECIPE_MASTERY_CURVE: MasteryTier[] = [
  { stars: 1, requiredCrafts: 0, timeBonusPct: 0, priceBonusPct: 0, visualTier: 'base' },
  { stars: 2, requiredCrafts: 10, timeBonusPct: -5, priceBonusPct: 5, visualTier: 'bronze' },
  { stars: 3, requiredCrafts: 30, timeBonusPct: -10, priceBonusPct: 10, visualTier: 'silver_local_favorite' },
  { stars: 4, requiredCrafts: 75, timeBonusPct: -15, priceBonusPct: 18, visualTier: 'gold' },
  { stars: 5, requiredCrafts: 150, timeBonusPct: -20, priceBonusPct: 25, visualTier: 'legendary_plate' },
]

