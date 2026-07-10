/**
 * catalogs/ingredients.ts — полный каталог ингредиентов T1–T5 (`docs/specs/05-ingredients.md`).
 *
 * Источник цифр — `docs/specs/05-ingredients.md` §4 (таблицы §4.1–4.5), уже прошедший
 * ревью (см. AGENTS.md). `basePrice` берётся из колонки «Цена продажи, $» этих таблиц
 * (там, где §3.8/§4.6 документа зафиксировали пересчитанные/сниженные цены — Cherry,
 * Georgia Peach, Gulf Shrimp, Maine Lobster — таблицы §4.1–4.5 уже содержат финальные
 * скорректированные значения, дополнительный пересчёт здесь не требуется).
 *
 * ВАЖНО о полноте данных: `IngredientSchema` (см. `../schema.ts`) — интерфейс-суперсет,
 * общий для всех источников (грядка/животное/станок/экспедиция/фуражинг/каталог), и
 * сознательно НЕ несёт «источник/тайминги/себестоимость» как рантайм-поля — эти данные
 * распределены по каталогам-потребителям (`crops.ts` — seedCost/growSec, `animals.ts` —
 * cycleMin, `recipes.ts` — baseCraftSec/inputs) и по экспедициям/фуражингу/каталогу
 * (спеки 07/08, ещё не написаны на момент этого коммита). Здесь, как у владельца
 * `ingredients`, для трассируемости и будущих авторов `crops.ts`/`recipes.ts`/`animals.ts`
 * каждая запись сопровождается комментарием-источником `// §4.x #N: <источник> · <время> ·
 * себест. $<X>` — справочно, не часть схемы.
 *
 * Нейминг ключей (правило этого каталога, канон §3 не фиксирует префикс для сырья
 * явно — см. `CanonKeySchema` в `../schema.ts`):
 *   - `crop_*`    — сырой урожай/добыча без переработки станком (грядка, сад,
 *                   экспедиционное сырьё-мясо/овощ/фрукт/морепродукт, фуражинг,
 *                   каталог→грядка-семена после сбора урожая);
 *   - `seed_*`    — семя обычной грядочной культуры (itemClass `seed`), нужен как
 *                   отдельная запись каталога, потому что `CropDefSchema.seedKey`
 *                   (см. `catalogs/crops.ts`, владелец — crops-агент) — ссылка на
 *                   Ingredient, а не встроенное число. 05-ingredients.md не даёт
 *                   этим позициям отдельной строки/цены (себестоимость дана одним
 *                   числом на цикл) — `basePrice` семени берётся равным этой же
 *                   себестоимости цикла (то же число, что уже использовано в
 *                   `crops.ts.seedCost` для того же ключа), ничего не выдумываем;
 *   - продукты животных (курица/корова/свинья/пчёлы) — БЕЗ префикса (`egg`, `milk`,
 *                   `bacon`, `honey`), включая редкие RNG-варианты (`golden_egg`,
 *                   `black_truffle` — источник «Животное» по табл. §3.1, хотя Truffle
 *                   физически гриб) — имена заданы контрактом `catalogs/animals.ts`
 *                   (`AnimalDef.productKey`, владелец — animals-агент), который уже
 *                   существовал на момент написания этого каталога; здесь подстроено
 *                   под уже зафиксированный контракт, а не выдумано заново;
 *   - `ingr_*`    — переработанный/составной продукт: станочный полуфабрикат (Butter,
 *                   Roasted Coffee, Aged Cheddar…) ИЛИ готовый расфасованный товар
 *                   каталога/экспедиции (Vanilla Extract, Cajun Spice Blend, Maple
 *                   Syrup…) — объединяет «переработку», а не только «станок»;
 *   - `special_*` — капстоун/ивент-эксклюзив вне обычной экономики продажи (Giant
 *                   Prize Pumpkin — не продаётся; ивент-лавка за 🎟).
 *
 * `goat_milk` (T3, animal_product) — ЕДИНСТВЕННОЕ исключение из правила «числа только
 * из 05-ingredients.md»: этот документ вообще не описывает коз (проверено, ноль
 * упоминаний), однако `catalogs/animals.ts` (уже существующий, прошедший ревью Фазы B)
 * ссылается на `productKey: 'goat_milk'` для вида `an_goat` — без записи здесь
 * `[AnimalDef→Ingredient]`-проверка в `validate.test.ts` не может быть зелёной ни при
 * каком другом решении. Цена $48/цикл взята из `docs/specs/03-animals.md` §3.2.2
 * (таблица «доход в час по видам», колонка «Базовый продукт, $/цикл» — согласуется
 * с колонкой «Доход $/час при Common» 16.0 = 48 × 0.333 цикл/ч) — тоже спека, тоже
 * прошла Фазу B, просто другая, не 05-ingredients.md. TODO(architecture): свести
 * 03-animals.md и 05-ingredients.md — коза нигде не появляется во втором документе,
 * это разрыв между спеками, а не решение этого каталога.
 *
 * Хранение (`storage`, canon §3.4 / 05-ingredients §3.1 §3.4):
 *   - `silo`     — сухое/зерновое: Wheat, Flour, Refined Sugar (единственные явно
 *                  названные позиции §3.4);
 *   - `general`  — не портится: каталожные готовые товары (§3.7 «готовые товары не
 *                  портятся») и сухие специи/сиропы-концентраты экспедиции/каталога
 *                  (Vanilla Extract, Smoked Paprika, Cajun Spice Blend, Texas BBQ Rub,
 *                  Maple Syrup, Chicory Coffee Blend), а также капстоун/ивент-`special_*`;
 *   - `icehouse` — всё прочее скоропортящееся сырьё/полуфабрикаты (умолчание для
 *                  Грядка/Животное/Станок-полуфабрикат по табл. §3.1).
 *
 * `demandCategory` и `assetKey` здесь не заполняются: 05-ingredients.md не фиксирует
 * ни одного, ни другого по позициям (деманд-категории — открытый вопрос `09-fair.md`;
 * `assetKey` — зона владения арт/сцен-агента, `src/assets/placeholders/registry.ts`, AGENTS.md §5).
 * Оба поля optional в схеме — их отсутствие валидно.
 */

import type { Ingredient } from '@/data/schema'

export const ingredients: Ingredient[] = [
  // ── T1 — Garden (Огород), §4.1 ─────────────────────────────────────────────
  { key: 'crop_tomato', name: { en: 'Tomato', ru: 'Томат' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.20 }, // §4.1 #1: Грядка · 8 мин · себест. $0.06
  { key: 'crop_lettuce', name: { en: 'Lettuce', ru: 'Салат-латук' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.18 }, // §4.1 #2: Грядка · 6 мин · себест. $0.05
  { key: 'crop_potato', name: { en: 'Potato', ru: 'Картофель' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.22 }, // §4.1 #3: Грядка · 10 мин · себест. $0.07
  { key: 'crop_wheat', name: { en: 'Wheat', ru: 'Пшеница' }, itemClass: 'crop', tier: 1, storage: 'silo', basePrice: 0.20 }, // §4.1 #4: Грядка · 12 мин · себест. $0.08
  { key: 'crop_carrot', name: { en: 'Carrot', ru: 'Морковь' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.19 }, // §4.1 #5: Грядка · 7 мин · себест. $0.05
  { key: 'crop_cucumber', name: { en: 'Cucumber', ru: 'Огурец' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.17 }, // §4.1 #6: Грядка · 6 мин · себест. $0.05
  { key: 'crop_onion', name: { en: 'Onion', ru: 'Лук репчатый' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.19 }, // §4.1 #7: Грядка · 9 мин · себест. $0.06
  { key: 'crop_bell_pepper', name: { en: 'Bell Pepper', ru: 'Болгарский перец' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.23 }, // §4.1 #8: Грядка · 11 мин · себест. $0.07
  { key: 'crop_green_beans', name: { en: 'Green Beans', ru: 'Стручковая фасоль' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.20 }, // §4.1 #9: Грядка · 8 мин · себест. $0.06
  { key: 'crop_radish', name: { en: 'Radish', ru: 'Редис' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.15 }, // §4.1 #10: Грядка · 5 мин · себест. $0.04
  { key: 'crop_spinach', name: { en: 'Spinach', ru: 'Шпинат' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.18 }, // §4.1 #11: Грядка · 6 мин · себест. $0.05
  { key: 'crop_cabbage', name: { en: 'Cabbage', ru: 'Капуста' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.20 }, // §4.1 #12: Грядка · 10 мин · себест. $0.06
  { key: 'crop_beet', name: { en: 'Beet', ru: 'Свёкла' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.21 }, // §4.1 #13: Грядка · 12 мин · себест. $0.07
  { key: 'crop_scallion', name: { en: 'Scallion', ru: 'Зелёный лук' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.16 }, // §4.1 #14: Грядка · 5 мин · себест. $0.04
  { key: 'crop_basil', name: { en: 'Basil', ru: 'Базилик' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.19 }, // §4.1 #15: Грядка · 6 мин · себест. $0.05
  { key: 'egg', name: { en: 'Eggs', ru: 'Яйца' }, itemClass: 'animal_product', tier: 1, storage: 'icehouse', basePrice: 0.30 }, // §4.1 #16: Животное (Курица, bld_coop) · 15 мин цикл · себест. $0.10
  { key: 'ingr_flour', name: { en: 'Flour', ru: 'Мука' }, itemClass: 'ingredient', tier: 1, storage: 'silo', basePrice: 0.50 }, // §4.1 #17: Станок (Oven, Wheat×2 / v0.2 Mill mch_mill) · 5 мин · себест. $0.15 · ЦЕНА ПОДНЯТА 0.35→0.50: было ниже себест. рецепта Wheat×2=$0.40 (crop_wheat $0.20×2), отрицательная маржа на первом полуфабрикате (флаг recipes.ts §67-72); формула Wheat×2 не тронута
  { key: 'crop_wild_chives', name: { en: 'Wild Chives', ru: 'Дикий лук-резанец' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.25 }, // §4.1 #18: Фуражинг · 1 мин/сутки · себест. $0.00
  { key: 'crop_dandelion_greens', name: { en: 'Dandelion Greens', ru: 'Листья одуванчика' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.22 }, // §4.1 #19: Фуражинг · 1 мин/сутки · себест. $0.00
  { key: 'crop_field_mushroom', name: { en: 'Field Mushroom', ru: 'Полевой гриб' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.28 }, // §4.1 #20: Фуражинг · 1 мин/сутки · себест. $0.00
  { key: 'crop_heirloom_tomato', name: { en: 'Heirloom Tomato', ru: 'Хартичный томат' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.45 }, // §4.1 #21: Каталог→грядка · достав. 12ч + 10 мин · себест. семена $0.40 + $0.06/цикл
  { key: 'crop_rainbow_chard', name: { en: 'Rainbow Chard', ru: 'Радужный мангольд' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.40 }, // §4.1 #22: Каталог→грядка · достав. 12ч + 9 мин · себест. семена $0.35 + $0.06/цикл
  { key: 'crop_sweet_onion', name: { en: 'Sweet Onion (variety)', ru: 'Сладкий лук (сорт)' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.38 }, // §4.1 #23: Каталог→грядка · достав. 12ч + 9 мин · себест. семена $0.30 + $0.06/цикл

  // ── T2 — Farm (Ферма), §4.2 ─────────────────────────────────────────────────
  { key: 'crop_apple', name: { en: 'Apple', ru: 'Яблоко' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.10 }, // §4.2 #24: Грядка (сад) · 45 мин · себест. $0.35
  { key: 'crop_corn', name: { en: 'Corn', ru: 'Кукуруза' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.00 }, // §4.2 #25: Грядка · 40 мин · себест. $0.30
  { key: 'crop_strawberry', name: { en: 'Strawberry', ru: 'Клубника' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.05 }, // §4.2 #26: Грядка · 35 мин · себест. $0.32
  { key: 'crop_green_peas', name: { en: 'Green Peas', ru: 'Зелёный горошек' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 0.85 }, // §4.2 #27: Грядка · 30 мин · себест. $0.25
  { key: 'crop_zucchini', name: { en: 'Zucchini', ru: 'Кабачок' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 0.95 }, // §4.2 #28: Грядка · 50 мин · себест. $0.30
  { key: 'crop_blueberry', name: { en: 'Blueberry', ru: 'Черника' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.15 }, // §4.2 #29: Грядка · 45 мин · себест. $0.34
  { key: 'crop_raspberry', name: { en: 'Raspberry', ru: 'Малина' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.15 }, // §4.2 #30: Грядка · 45 мин · себест. $0.34
  { key: 'crop_rhubarb', name: { en: 'Rhubarb', ru: 'Ревень' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.20 }, // §4.2 #31: Грядка · 55 мин · себест. $0.36
  { key: 'crop_watermelon', name: { en: 'Watermelon', ru: 'Арбуз' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.80 }, // §4.2 #32: Грядка · 90 мин · себест. $0.55
  { key: 'crop_asparagus', name: { en: 'Asparagus', ru: 'Спаржа' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.30 }, // §4.2 #33: Грядка · 60 мин · себест. $0.40
  { key: 'crop_sugar_beet', name: { en: 'Sugar Beet', ru: 'Сахарная свёкла' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.40 }, // §4.2 #34: Грядка · 70 мин · себест. $0.45
  { key: 'milk', name: { en: 'Milk', ru: 'Молоко' }, itemClass: 'animal_product', tier: 2, storage: 'icehouse', basePrice: 1.05 }, // §4.2 #35: Животное (Корова, bld_barn) · 45 мин цикл · себест. $0.40 · ЦЕНА СНИЖЕНА 1.20→1.05 (сверка с 06-recipes): Bread через Dough несёт Butter=Milk×2; при $1.20 холодный сэндвич #76 Tomato&Lettuce ($6) уходил ниже себест. сырья — тонкая маржа Prep Counter-сборки
  { key: 'bacon', name: { en: 'Bacon', ru: 'Бекон' }, itemClass: 'animal_product', tier: 2, storage: 'icehouse', basePrice: 1.75 }, // §4.2 #36: Животное (Свинья, bld_barn) · 60 мин цикл · себест. $0.55
  { key: 'ingr_butter', name: { en: 'Butter', ru: 'Масло' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 1.60 }, // §4.2 #37: Станок (Маслобойка, из Milk) · 25 мин · себест. $0.60
  { key: 'ingr_cheese_curds', name: { en: 'Cheese Curds', ru: 'Сырные зёрна' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 1.70 }, // §4.2 #38: Станок (Маслобойка, из Milk) · 30 мин · себест. $0.65
  { key: 'ingr_cream', name: { en: 'Cream', ru: 'Сливки' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 1.50 }, // §4.2 #39: Станок (Kitchen, из Milk) · 20 мин · себест. $0.55
  { key: 'ingr_basic_dough', name: { en: 'Basic Dough', ru: 'Простое тесто' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 2.20 }, // §4.2 #40: Станок (Kitchen, из Flour+Butter+Eggs) · 20 мин · себест. $0.90
  { key: 'ingr_pie_crust_basic', name: { en: 'Pie Crust (Basic)', ru: 'Простой корж' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 2.60 }, // §4.2 #41: Станок (Печь, из Basic Dough) · 25 мин · себест. $1.10
  { key: 'ingr_refined_sugar', name: { en: 'Refined Sugar', ru: 'Сахар рафинированный' }, itemClass: 'ingredient', tier: 2, storage: 'silo', basePrice: 1.80 }, // §4.2 #42: Станок (Kitchen, из Sugar Beet) · 30 мин · себест. $0.70
  { key: 'crop_blackberry', name: { en: 'Blackberry', ru: 'Ежевика' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.30 }, // §4.2 #43: Фуражинг · 1 мин/сутки · себест. $0.00
  { key: 'crop_wild_mint', name: { en: 'Wild Mint', ru: 'Дикая мята' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.10 }, // §4.2 #44: Фуражинг · 1 мин/сутки · себест. $0.00
  { key: 'crop_heirloom_strawberry', name: { en: 'Heirloom Strawberry', ru: 'Хартичная клубника' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.60 }, // §4.2 #45: Каталог→грядка · достав. 12ч + 35 мин · себест. семена $1.20 + $0.32/цикл
  { key: 'crop_golden_sweet_corn', name: { en: 'Golden Sweet Corn', ru: 'Золотая кукуруза' }, itemClass: 'crop', tier: 2, storage: 'icehouse', basePrice: 1.50 }, // §4.2 #46: Каталог→грядка · достав. 12ч + 40 мин · себест. семена $1.10 + $0.30/цикл

  // ── T3 — County (Округ), §4.3 ────────────────────────────────────────────────
  { key: 'crop_cherry', name: { en: 'Cherry', ru: 'Вишня' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 6.00 }, // §4.3 #47: Грядка (сад) · 3 ч · себест. $2.10 (цена скорректирована §3.8/§4.6)
  { key: 'crop_pumpkin', name: { en: 'Pumpkin', ru: 'Тыква' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 8.20 }, // §4.3 #48: Грядка · 4 ч · себест. $2.60
  { key: 'crop_butternut_squash', name: { en: 'Butternut Squash', ru: 'Мускатная тыква' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 7.80 }, // §4.3 #49: Грядка · 3.5 ч · себест. $2.40
  { key: 'crop_sweet_potato', name: { en: 'Sweet Potato', ru: 'Батат' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 7.00 }, // §4.3 #50: Грядка · 3 ч · себест. $2.10
  { key: 'crop_snap_peas', name: { en: 'Snap Peas', ru: 'Сахарный горошек' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 5.50 }, // §4.3 #51: Грядка · 2 ч · себест. $1.60
  { key: 'honey', name: { en: 'Honey', ru: 'Мёд' }, itemClass: 'animal_product', tier: 3, storage: 'icehouse', basePrice: 9.50 }, // §4.3 #52: Животное (Пчёлы, bld_apiary) · 5 ч цикл · себест. $3.00
  { key: 'goat_milk', name: { en: 'Goat Milk', ru: 'Козье молоко' }, itemClass: 'animal_product', tier: 3, storage: 'icehouse', basePrice: 48.00 }, // НЕ из 05-ingredients.md (коз там нет) — см. преамбулу файла; источник: 03-animals.md §3.2.2, Животное (Коза, bld_barn) · 180 мин цикл
  { key: 'crop_beef', name: { en: 'Beef', ru: 'Говядина' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 14.00 }, // §4.3 #53: Экспедиция (st_illinois, Chicago, 6 ч) · себест. $4.50
  { key: 'crop_pecan', name: { en: 'Pecan', ru: 'Пекан' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 6.00 }, // §4.3 #54: Экспедиция (st_tennessee, Nashville, 5 ч) · себест. $3.80 · ЦЕНА СНИЖЕНА 12.50→6.00 (сверка с 06-recipes §4.2, ровно расхождение из recipes.ts §115): при $12.50 Pecan×2 = вся цена быстрого блюда #10 Honey-Pecan Toast ($25) и #23/#68 уходили ниже себест. сырья
  { key: 'crop_green_coffee_beans', name: { en: 'Green Coffee Beans', ru: 'Зелёные кофейные зёрна' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 11.00 }, // §4.3 #55: Экспедиция (st_illinois, 6 ч) · себест. $3.50
  { key: 'ingr_sorghum_molasses', name: { en: 'Sorghum Molasses', ru: 'Сорговая патока' }, itemClass: 'ingredient', tier: 3, storage: 'general', basePrice: 10.50 }, // §4.3 #56: Экспедиция (st_tennessee, 5 ч) · себест. $3.20 — переработанный сироп, не портится
  { key: 'ingr_roasted_coffee', name: { en: 'Roasted Coffee', ru: 'Жареный кофе' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 13.50 }, // §4.3 #57: Станок (Кофемашина, из Green Coffee Beans) · 45 мин · себест. $5.00
  { key: 'ingr_cherry_pie_filling', name: { en: 'Cherry Pie Filling', ru: 'Вишнёвая начинка' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 10.00 }, // §4.3 #58: Станок (Kitchen, из Cherry+Refined Sugar) · 40 мин · себест. $3.80
  { key: 'ingr_ground_beef_patty', name: { en: 'Ground Beef Patty', ru: 'Говяжья котлета' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 15.00 }, // §4.3 #59: Станок (Гриль, из Beef) · 20 мин · себест. $5.50
  { key: 'ingr_whipped_cream', name: { en: 'Whipped Cream', ru: 'Взбитые сливки' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 4.50 }, // §4.3 #60: Станок (Kitchen, из Cream+Refined Sugar) · 15 мин · себест. $1.80
  { key: 'ingr_pumpkin_puree', name: { en: 'Pumpkin Puree', ru: 'Тыквенное пюре' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 9.00 }, // §4.3 #61: Станок (Kitchen, из Pumpkin) · 35 мин · себест. $3.20
  { key: 'ingr_pecan_praline', name: { en: 'Pecan Praline', ru: 'Пекан-пралине' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 14.00 }, // §4.3 #62: Станок (Kitchen, из Pecan+Refined Sugar) · 45 мин · себест. $5.20
  { key: 'ingr_pie_crust_deluxe', name: { en: 'Deluxe Pie Crust', ru: 'Улучшенный корж' }, itemClass: 'ingredient', tier: 3, storage: 'icehouse', basePrice: 6.50 }, // §4.3 #63: Станок (Печь, из Basic Dough+Butter) · 40 мин · себест. $2.50
  { key: 'crop_chanterelle_mushroom', name: { en: 'Chanterelle Mushroom', ru: 'Лисички' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 6.50 }, // §4.3 #64: Фуражинг · 2 мин/сутки · себест. $0.00
  { key: 'crop_wild_ramps', name: { en: 'Wild Ramps', ru: 'Дикая черемша' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 5.80 }, // §4.3 #65: Фуражинг · 2 мин/сутки · себест. $0.00
  { key: 'ingr_vanilla_extract', name: { en: 'Vanilla Extract (Bottled)', ru: 'Ваниль (бутил. экстракт)' }, itemClass: 'ingredient', tier: 3, storage: 'general', basePrice: 9.50 }, // §4.3 #66: Каталог (товар) · достав. 16 ч · себест. $4.00 — готовый товар, не портится (§3.7)
  { key: 'ingr_smoked_paprika', name: { en: 'Smoked Paprika', ru: 'Копчёная паприка' }, itemClass: 'ingredient', tier: 3, storage: 'general', basePrice: 8.50 }, // §4.3 #67: Каталог (товар) · достав. 16 ч · себест. $3.50 — готовый товар, не портится (§3.7)

  // ── T4 — States (Штаты), §4.4 ─────────────────────────────────────────────────
  { key: 'crop_georgia_peach', name: { en: 'Georgia Peach', ru: 'Персик Джорджии' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 20.00 }, // §4.4 #68: Экспедиция (st_georgia, 14 ч) · себест. $7.50 (цена скорректирована §3.8/§4.6)
  { key: 'crop_vidalia_sweet_onion', name: { en: 'Vidalia Sweet Onion', ru: 'Сладкий лук Видалия' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 38.00 }, // §4.4 #69: Экспедиция (st_georgia, 14 ч) · себест. $12.00
  { key: 'crop_gulf_shrimp', name: { en: 'Gulf Shrimp', ru: 'Креветки Залива' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 24.00 }, // §4.4 #70: Экспедиция (st_louisiana, 16 ч) · себест. $9.00 (цена скорректирована §3.8/§4.6)
  { key: 'ingr_cajun_spice_blend', name: { en: 'Cajun Spice Blend', ru: 'Каджунская смесь специй' }, itemClass: 'ingredient', tier: 4, storage: 'general', basePrice: 18.00 }, // §4.4 #71: Экспедиция (st_louisiana, 16 ч) · себест. $10.00 — сухая смесь специй, не портится · ЦЕНА СНИЖЕНА 32.00→18.00 (сверка с 06-recipes): при $32 секретка Sec.14 Chili Chocolate Soda ($23) уходила ниже себест. (Chocolate Soda база + Cajun Spice×1)
  { key: 'ingr_andouille_sausage', name: { en: 'Andouille Sausage', ru: 'Колбаса андуй' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 48.00 }, // §4.4 #72: Экспедиция (st_louisiana, 16 ч) · себест. $16.00 — переработанное мясное изделие, скоропорт
  { key: 'crop_beef_brisket', name: { en: 'Beef Brisket', ru: 'Говяжья грудинка' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 65.00 }, // §4.4 #73: Экспедиция (st_texas, 18 ч) · себест. $22.00
  { key: 'ingr_texas_bbq_rub', name: { en: 'Texas BBQ Rub', ru: 'Сухая смесь для барбекю' }, itemClass: 'ingredient', tier: 4, storage: 'general', basePrice: 34.00 }, // §4.4 #74: Экспедиция (st_texas, 18 ч) · себест. $11.00 — сухая смесь специй, не портится
  { key: 'ingr_maple_syrup', name: { en: 'Maple Syrup', ru: 'Кленовый сироп' }, itemClass: 'ingredient', tier: 4, storage: 'general', basePrice: 45.00 }, // §4.4 #75: Экспедиция (регион вне волны-1, гипотеза 12 ч) · себест. $15.00 — сироп-концентрат, не портится
  { key: 'ingr_chicory_coffee_blend', name: { en: 'Chicory Coffee Blend', ru: 'Кофе с цикорием (Нью-Орлеан)' }, itemClass: 'ingredient', tier: 4, storage: 'general', basePrice: 30.00 }, // §4.4 #76: Экспедиция (st_louisiana, 16 ч) · себест. $9.00 — обжаренная смесь, не портится
  { key: 'ingr_peach_cobbler_filling', name: { en: 'Peach Cobbler Filling', ru: 'Начинка коблера' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 58.00 }, // §4.4 #77: Станок (Kitchen, из Georgia Peach+Refined Sugar) · 2 ч · себест. $22.00
  { key: 'ingr_shrimp_bisque_base', name: { en: 'Shrimp Bisque Base', ru: 'Основа бисквита с креветками' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 62.00 }, // §4.4 #78: Станок (Kitchen, из Gulf Shrimp) · 2.5 ч · себест. $24.00
  { key: 'ingr_smoked_brisket', name: { en: 'Smoked Brisket', ru: 'Копчёная грудинка' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 75.00 }, // §4.4 #79: Станок (Коптильня, из Beef Brisket+Texas BBQ Rub) · 4 ч · себест. $28.00
  { key: 'ingr_cajun_butter', name: { en: 'Cajun Butter', ru: 'Каджунское масло' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 30.00 }, // §4.4 #80: Станок (Kitchen, из Butter+Cajun Spice Blend) · 1 ч · себест. $11.00
  { key: 'ingr_refined_praline_sauce', name: { en: 'Refined Praline Sauce', ru: 'Соус пралине улучшенный' }, itemClass: 'ingredient', tier: 4, storage: 'icehouse', basePrice: 28.00 }, // §4.4 #81: Станок (Kitchen, из Pecan Praline+Refined Sugar) · 1.5 ч · себест. $9.00
  { key: 'crop_wild_pawpaw', name: { en: 'Wild Pawpaw', ru: 'Дикий папайя-фрукт' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 22.00 }, // §4.4 #82: Фуражинг · 3 мин/сутки · себест. $0.00
  { key: 'crop_muscadine_grapes', name: { en: 'Muscadine Grapes', ru: 'Виноград мускадин' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 20.00 }, // §4.4 #83: Фуражинг · 3 мин/сутки · себест. $0.00
  { key: 'crop_persimmon', name: { en: 'Persimmon', ru: 'Хурма (южноаппалачская)' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 18.00 }, // §4.4 #84: Фуражинг · 3 мин/сутки · себест. $0.00
  { key: 'crop_okra', name: { en: 'Okra', ru: 'Окра' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 28.00 }, // §4.4 #85: Каталог→грядка (после st_louisiana) · достав. 20ч + 3 ч · себест. семена $6.00 + $2.00/цикл
  { key: 'crop_hatch_green_chili', name: { en: 'Hatch Green Chili', ru: 'Зелёный чили Хэтч' }, itemClass: 'crop', tier: 4, storage: 'icehouse', basePrice: 30.00 }, // §4.4 #86: Каталог→грядка (после st_texas) · достав. 20ч + 3 ч · себест. семена $6.00 + $2.20/цикл

  // ── T5 — Legends (Легенды), §4.5 ──────────────────────────────────────────────
  { key: 'crop_maine_lobster', name: { en: 'Maine Lobster', ru: 'Лобстер Мэна' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 120.00 }, // §4.5 #87: Экспедиция (st_maine, 30 ч) · себест. $43.00 (цена скорректирована §3.8/§4.6)
  { key: 'crop_maine_wild_blueberry', name: { en: 'Maine Wild Blueberry', ru: 'Дикая черника Мэна' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 120.00 }, // §4.5 #88: Экспедиция (st_maine, 30 ч) · себест. $40.00
  { key: 'crop_california_vanilla_bean', name: { en: 'California Vanilla Bean', ru: 'Ванильный стручок Калифорнии' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 170.00 }, // §4.5 #89: Экспедиция (st_california, 36 ч) · себест. $55.00
  { key: 'crop_california_meyer_lemon', name: { en: 'California Meyer Lemon', ru: 'Лимон Мейера' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 110.00 }, // §4.5 #90: Экспедиция (st_california, 36 ч) · себест. $35.00
  { key: 'crop_california_navel_orange', name: { en: 'California Navel Orange', ru: 'Апельсин калифорнийский' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 105.00 }, // §4.5 #91: Экспедиция (st_california, 36 ч) · себест. $32.00
  { key: 'black_truffle', name: { en: 'Black Truffle', ru: 'Чёрный трюфель' }, itemClass: 'animal_product', tier: 5, storage: 'icehouse', basePrice: 220.00 }, // §4.5 #92: Животное (редкий шанс, «трюфельная свинья», bld_barn County+) · поиск 8 ч · себест. $70.00
  { key: 'golden_egg', name: { en: 'Golden Egg', ru: 'Золотое яйцо' }, itemClass: 'animal_product', tier: 5, storage: 'icehouse', basePrice: 95.00 }, // §4.5 #93: Животное (редкий шанс, Курица, bld_coop) · цикл 15 мин · себест. $30.00
  { key: 'special_giant_prize_pumpkin', name: { en: 'Giant Prize Pumpkin', ru: 'Гигантская призовая тыква' }, itemClass: 'special', tier: 5, storage: 'general', basePrice: 0 }, // §4.5 #94: Грядка (домашняя, капстоун) · 60 ч (2.5 дня) · себест. $80.00 — не продаётся, только ct_giant_veg
  { key: 'ingr_lobster_bisque_base', name: { en: 'Lobster Bisque Base', ru: 'Основа лобстерового бисквита' }, itemClass: 'ingredient', tier: 5, storage: 'icehouse', basePrice: 200.00 }, // §4.5 #95: Станок (Kitchen, из Maine Lobster) · 6 ч · себест. $75.00
  { key: 'ingr_truffle_butter', name: { en: 'Truffle Butter', ru: 'Трюфельное масло' }, itemClass: 'ingredient', tier: 5, storage: 'icehouse', basePrice: 210.00 }, // §4.5 #96: Станок (Kitchen, из Black Truffle+Butter) · 4 ч · себест. $78.00
  { key: 'ingr_vanilla_bean_paste', name: { en: 'Vanilla Bean Paste', ru: 'Ванильная паста' }, itemClass: 'ingredient', tier: 5, storage: 'icehouse', basePrice: 180.00 }, // §4.5 #97: Станок (Kitchen, из California Vanilla Bean+Refined Sugar) · 5 ч · себест. $62.00
  { key: 'ingr_candied_citrus_peel', name: { en: 'Candied Citrus Peel', ru: 'Цукаты из цитрусовой цедры' }, itemClass: 'ingredient', tier: 5, storage: 'icehouse', basePrice: 115.00 }, // §4.5 #98: Станок (Kitchen, из Meyer Lemon/Navel Orange+Refined Sugar) · 3 ч · себест. $38.00
  { key: 'ingr_aged_cheddar', name: { en: 'Aged Cheddar (3-Year)', ru: 'Выдержанный чеддер (3 года)' }, itemClass: 'ingredient', tier: 5, storage: 'icehouse', basePrice: 130.00 }, // §4.5 #99: Станок (Ледник bld_icehouse, выдержка Cheese Curds) · 72 ч (3 дня) · себест. $45.00
  { key: 'crop_wild_ginseng_root', name: { en: 'Wild Ginseng Root', ru: 'Дикий женьшень' }, itemClass: 'crop', tier: 5, storage: 'icehouse', basePrice: 85.00 }, // §4.5 #100: Фуражинг (крайне редкий спавн) · 5 мин/сутки, низкий шанс · себест. $0.00
  { key: 'special_golden_cherry', name: { en: 'Golden Cherry', ru: 'Золотая вишня' }, itemClass: 'special', tier: 5, storage: 'general', basePrice: 150.00 }, // §4.5 #101: Каталог (ивент-лавка ev_glutton, за 🎟) · мгновенно · себест. 🎟8 (≈$60 экв., гипотеза, курс не согласован — §8.9)
  { key: 'special_festival_saffron', name: { en: 'Festival Saffron', ru: 'Фестивальный шафран' }, itemClass: 'special', tier: 5, storage: 'general', basePrice: 130.00 }, // §4.5 #102: Каталог (ивент-лавка ev_big_festival, за 🎟) · мгновенно · себест. 🎟6 (≈$45 экв., гипотеза — §8.9)
  { key: 'special_frostbite_peppermint', name: { en: 'Frostbite Peppermint', ru: 'Морозная мята' }, itemClass: 'special', tier: 5, storage: 'general', basePrice: 110.00 }, // §4.5 #103: Каталог (ивент-лавка, сезон cos_xmas_55, за 🎟) · мгновенно · себест. 🎟5 (≈$38 экв., гипотеза — §8.9)


  // ── Кросс-каталожная сверка с 06-recipes.md (владелец ingredients.ts закрывает
  //    пробелы, на которые ссылается docstring recipes.ts пп.3–4; validate.test.ts
  //    Recipe→Ingredient требует Ingredient-запись на каждый output/input рецепта) ──
  //
  //    A. Доп. сырьё сверх канонных хайлайтов (06-recipes.md §4.1 сноска / §8.2 —
  //    предвиденный спекой открытый вопрос). Цены выведены консистентно из тира и
  //    соседних позиций §4.x, себест. — гипотеза того же порядка, что у аналогов.
  { key: 'crop_lemon', name: { en: 'Lemon', ru: 'Лимон' }, itemClass: 'crop', tier: 1, storage: 'icehouse', basePrice: 0.25 }, // 06-recipes §4.1 сноска (T1, лимонад/чай) · Грядка(сад) · себест. ~$0.08
  { key: 'crop_cocoa', name: { en: 'Cocoa', ru: 'Какао-бобы' }, itemClass: 'crop', tier: 2, storage: 'general', basePrice: 1.50 }, // 06-recipes §4.1 сноска (T2, шоколадная содовая) · Каталог/грядка · себест. ~$0.45 · сухое → general
  { key: 'chicken', name: { en: 'Chicken', ru: 'Курица (мясо)' }, itemClass: 'animal_product', tier: 2, storage: 'icehouse', basePrice: 3.50 }, // 06-recipes §4.1 сноска (T2, мясо — НЕ egg; животное bld_coop) · себест. ~$1.10
  { key: 'crop_catfish', name: { en: 'Catfish', ru: 'Сом округа' }, itemClass: 'crop', tier: 3, storage: 'icehouse', basePrice: 5.00 }, // 06-recipes §4.1 сноска (T3, шт.Tennessee — рыба округа) · Фуражинг/рыбалка · себест. ~$1.60
  //
  //    B. Полуфабрикаты Prep Counter / Stockpot / Oven (06-recipes.md §4.1 S2–S18),
  //    itemClass 'ingredient'. basePrice > себест. входов §4.1 (положительная маржа);
  //    цены выведены из суммы рыночной стоимости входов + переработка (14-economy §4).
  { key: 'ingr_bread', name: { en: 'Bread', ru: 'Хлеб' }, itemClass: 'ingredient', tier: 1, storage: 'silo', basePrice: 3.10 }, // §4.1 S2: Bake Oven (из Dough) · 8 мин
  { key: 'ingr_biscuit', name: { en: 'Biscuit', ru: 'Южный бисквит' }, itemClass: 'ingredient', tier: 2, storage: 'silo', basePrice: 2.80 }, // §4.1 S11: Bake Oven (Wheat×2, Butter×1) · 8 мин
  { key: 'ingr_cornbread', name: { en: 'Cornbread', ru: 'Кукурузный хлеб' }, itemClass: 'ingredient', tier: 2, storage: 'silo', basePrice: 2.70 }, // §4.1 S12: Bake Oven (Corn×2, Egg×1) · 12 мин
  { key: 'ingr_gravy', name: { en: 'Gravy', ru: 'Соус гарви' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 3.20 }, // §4.1 S13: Stockpot (Milk×1, Bacon×1) · 10 мин
  { key: 'ingr_hushpuppy_batter', name: { en: 'Hushpuppy Batter', ru: 'Тесто хашпаппи' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 2.70 }, // §4.1 S14: Prep Counter (Corn×2, Egg×1) · 10 мин
  { key: 'ingr_pastry_cream', name: { en: 'Pastry Cream', ru: 'Кондитерский крем' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 4.20 }, // §4.1 S15: Butter Churn (Milk×3, Egg×2) · 15 мин
  { key: 'ingr_bbq_sauce', name: { en: 'BBQ Sauce', ru: 'Соус барбекю' }, itemClass: 'ingredient', tier: 3, storage: 'general', basePrice: 12.00 }, // §4.1 S16: Stockpot (Tomato×2, Honey×1) · 15 мин
  { key: 'ingr_roux', name: { en: 'Roux', ru: 'Ру (основа гамбо)' }, itemClass: 'ingredient', tier: 2, storage: 'general', basePrice: 2.60 }, // §4.1 S17: Stockpot (Wheat×1, Butter×1) · 15 мин
  { key: 'ingr_caramel_sauce', name: { en: 'Caramel Sauce', ru: 'Карамель' }, itemClass: 'ingredient', tier: 3, storage: 'general', basePrice: 25.00 }, // §4.1 S18: Butter Churn (Honey×2, Butter×1) · 12 мин
  { key: 'ingr_pickles', name: { en: 'Pickles', ru: 'Соленья' }, itemClass: 'ingredient', tier: 1, storage: 'general', basePrice: 0.65 }, // §4.1 S4: Prep Counter (Cucumber×3) · 15 мин
  { key: 'ingr_coleslaw', name: { en: 'Coleslaw', ru: 'Коулслоу' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 1.60 }, // §4.1 S5: Prep Counter (Lettuce×2, Milk×1) · 10 мин
  { key: 'ingr_cocktail_sauce', name: { en: 'Cocktail Sauce', ru: 'Коктейльный соус' }, itemClass: 'ingredient', tier: 1, storage: 'general', basePrice: 0.55 }, // §4.1 S6: Prep Counter (Tomato×2) · 8 мин
  { key: 'ingr_vanilla_custard', name: { en: 'Vanilla Custard', ru: 'Ванильный пломбир' }, itemClass: 'ingredient', tier: 2, storage: 'icehouse', basePrice: 15.00 }, // §4.1 S10: Ice Cream Maker (Milk×3, Vanilla Essence×1) · 15 мин
  //
  //    C. Готовые блюда (dish_*, itemClass 'dish') — 134 шт (112 §4.2 + 22 секретки §4.5).
  //    basePrice/demandCategory перенесены 1:1 из recipeCatalogMeta/secretRecipeCatalogMeta
  //    (recipes.ts) — единственный источник цены продажи блюда (см. net/local/catalog.ts:
  //    productInfo отдаёт ingredient.basePrice для dish_*, значение обязано совпадать с meta).
  //    storage: скоропорт (морская/десерты/напитки) → icehouse, выпечка/завтраки → silo,
  //    остальное → general (Larder-правило 06-recipes §3.8). tier = tier рецепта §4.x.
  { key: 'dish_toast', name: { en: 'Toast', ru: 'Тост' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 5.00, demandCategory: 'breakfasts' }, // rcp_toast -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_farm_scramble', name: { en: 'Farm Scramble', ru: 'Фермерская яичница' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 6.00, demandCategory: 'breakfasts' }, // rcp_farm_scramble -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_home_lemonade', name: { en: 'Home Lemonade', ru: 'Домашний лимонад' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 6.00, demandCategory: 'breakfasts' }, // rcp_home_lemonade -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_country_ham_and_eggs', name: { en: 'Country Ham & Eggs', ru: 'Ветчина с яйцами' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 18.00, demandCategory: 'breakfasts' }, // rcp_country_ham_and_eggs -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_buttermilk_pancakes', name: { en: 'Buttermilk Pancakes', ru: 'Блинчики на пахте' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 16.00, demandCategory: 'breakfasts' }, // rcp_buttermilk_pancakes -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_strawberry_waffles', name: { en: 'Strawberry Waffles', ru: 'Вафли с клубникой' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 24.00, demandCategory: 'breakfasts' }, // rcp_strawberry_waffles -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_bacon_grilled_cheese', name: { en: 'Bacon Grilled Cheese', ru: 'Гриль-сэндвич с беконом и сыром' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 22.00, demandCategory: 'breakfasts' }, // rcp_bacon_grilled_cheese -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_sunrise_skillet', name: { en: 'Sunrise Skillet', ru: 'Сковородка на рассвете' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 65.00, demandCategory: 'breakfasts' }, // rcp_sunrise_skillet -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cherry_blintz', name: { en: 'Cherry Blintz', ru: 'Вишнёвый блинчик' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 70.00, demandCategory: 'breakfasts' }, // rcp_cherry_blintz -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_pecan_toast', name: { en: 'Honey-Pecan Toast', ru: 'Тост с мёдом и пеканом' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 25.00, demandCategory: 'breakfasts' }, // rcp_honey_pecan_toast -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_waffles', name: { en: 'Maple Waffles', ru: 'Вафли с кленовым сиропом' }, itemClass: 'dish', tier: 4, storage: 'silo', basePrice: 190.00, demandCategory: 'breakfasts' }, // rcp_maple_waffles -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_peach_morning_cobbler', name: { en: 'Peach Morning Cobbler', ru: 'Утренний персиковый коблер' }, itemClass: 'dish', tier: 4, storage: 'silo', basePrice: 220.00, demandCategory: 'breakfasts' }, // rcp_peach_morning_cobbler -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_dinner_roll', name: { en: 'Dinner Roll', ru: 'Булочка к обеду' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 5.00, demandCategory: 'baking' }, // rcp_dinner_roll -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_sugar_cookie', name: { en: 'Sugar Cookie', ru: 'Сахарное печенье' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 7.00, demandCategory: 'baking' }, // rcp_sugar_cookie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_corn_muffin', name: { en: 'Corn Muffin', ru: 'Кукурузный маффин' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 6.00, demandCategory: 'baking' }, // rcp_corn_muffin -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_strawberry_shortcake', name: { en: 'Strawberry Shortcake', ru: 'Клубничный шорткейк' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 26.00, demandCategory: 'baking' }, // rcp_strawberry_shortcake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_buttermilk_biscuit_plate', name: { en: 'Buttermilk Biscuit Plate', ru: 'Тарелка бисквитов' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 20.00, demandCategory: 'baking' }, // rcp_buttermilk_biscuit_plate -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_apple_pie', name: { en: 'Apple Pie', ru: 'Яблочный пай' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 28.00, demandCategory: 'baking' }, // rcp_apple_pie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_corn_bread_loaf', name: { en: 'Corn Bread Loaf', ru: 'Буханка кукурузного хлеба' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 21.00, demandCategory: 'baking' }, // rcp_corn_bread_loaf -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cherry_pie', name: { en: 'Cherry Pie', ru: 'Вишнёвый пай' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 75.00, demandCategory: 'baking' }, // rcp_cherry_pie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cherry_pie_a_la_mode', name: { en: 'Cherry Pie à la Mode', ru: 'Вишнёвый пай а-ля мод' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 75.00, demandCategory: 'baking' }, // rcp_cherry_pie_a_la_mode -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pumpkin_pie', name: { en: 'Pumpkin Pie', ru: 'Тыквенный пай' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 82.00, demandCategory: 'baking' }, // rcp_pumpkin_pie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_pecan_pie', name: { en: 'Honey Pecan Pie', ru: 'Пекановый пай с мёдом' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 88.00, demandCategory: 'baking' }, // rcp_honey_pecan_pie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_coffee_crumb_cake', name: { en: 'Coffee Crumb Cake', ru: 'Кофейный крамбл-кекс' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 70.00, demandCategory: 'baking' }, // rcp_coffee_crumb_cake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_georgia_peach_cobbler', name: { en: 'Georgia Peach Cobbler', ru: 'Персиковый коблер Джорджии' }, itemClass: 'dish', tier: 4, storage: 'silo', basePrice: 240.00, demandCategory: 'baking' }, // rcp_georgia_peach_cobbler -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_peach_melba_tart', name: { en: 'Peach Melba Tart', ru: 'Тарт «Пич Мельба»' }, itemClass: 'dish', tier: 4, storage: 'silo', basePrice: 265.00, demandCategory: 'baking' }, // rcp_peach_melba_tart -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_pecan_roll', name: { en: 'Maple Pecan Roll', ru: 'Рулет с кленовым сиропом и пеканом' }, itemClass: 'dish', tier: 4, storage: 'silo', basePrice: 210.00, demandCategory: 'baking' }, // rcp_maple_pecan_roll -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_truffle_butter_croissant', name: { en: 'Truffle Butter Croissant', ru: 'Круассан с трюфельным маслом' }, itemClass: 'dish', tier: 5, storage: 'silo', basePrice: 780.00, demandCategory: 'baking' }, // rcp_truffle_butter_croissant -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_lobster_pot_pie', name: { en: 'Lobster Pot Pie', ru: 'Пай с лобстером' }, itemClass: 'dish', tier: 5, storage: 'silo', basePrice: 850.00, demandCategory: 'baking' }, // rcp_lobster_pot_pie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_vanilla_bean_layer_cake', name: { en: 'Vanilla Bean Layer Cake', ru: 'Слоёный торт с ванилью' }, itemClass: 'dish', tier: 5, storage: 'silo', basePrice: 720.00, demandCategory: 'baking' }, // rcp_vanilla_bean_layer_cake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_grilled_corn', name: { en: 'Grilled Corn', ru: 'Кукуруза на гриле' }, itemClass: 'dish', tier: 1, storage: 'general', basePrice: 5.00, demandCategory: 'grill' }, // rcp_grilled_corn -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_veggie_skewer', name: { en: 'Veggie Skewer', ru: 'Овощной шашлык' }, itemClass: 'dish', tier: 1, storage: 'general', basePrice: 6.00, demandCategory: 'grill' }, // rcp_veggie_skewer -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_classic_burger', name: { en: 'Classic Burger', ru: 'Классический бургер' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 20.00, demandCategory: 'grill' }, // rcp_classic_burger -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_corn_dog', name: { en: 'Corn Dog', ru: 'Кукурузный хот-дог' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 18.00, demandCategory: 'grill' }, // rcp_corn_dog -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_bacon_cheeseburger', name: { en: 'Bacon Cheeseburger', ru: 'Бекон-чизбургер' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 30.00, demandCategory: 'grill' }, // rcp_bacon_cheeseburger -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_strawberry_glazed_ham', name: { en: 'Strawberry Glazed Ham', ru: 'Ветчина в клубничной глазури' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 26.00, demandCategory: 'grill' }, // rcp_strawberry_glazed_ham -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_county_beef_burger', name: { en: 'County Beef Burger', ru: 'Бургер из говядины округа' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 68.00, demandCategory: 'grill' }, // rcp_county_beef_burger -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_deluxe_burger', name: { en: 'Deluxe Burger', ru: 'Делюкс-бургер' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 90.00, demandCategory: 'grill' }, // rcp_deluxe_burger -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_grilled_beef_steak', name: { en: 'Grilled Beef Steak', ru: 'Стейк на гриле' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 85.00, demandCategory: 'grill' }, // rcp_grilled_beef_steak -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_bbq_ribs', name: { en: 'Honey BBQ Ribs', ru: 'Мини-рёбрышки в мёде и барбекю' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 80.00, demandCategory: 'grill' }, // rcp_honey_bbq_ribs -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_chicago_deep_dish_sausage_melt', name: { en: 'Chicago Deep-Dish Sausage Melt', ru: 'Чикагский колбасный мелт' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 72.00, demandCategory: 'grill' }, // rcp_chicago_deep_dish_sausage_melt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_peach_glazed_pork_chop', name: { en: 'Peach-Glazed Pork Chop', ru: 'Свиная отбивная в персиковой глазури' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 210.00, demandCategory: 'grill' }, // rcp_peach_glazed_pork_chop -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_texas_smoked_brisket_plate', name: { en: 'Texas Smoked Brisket Plate', ru: 'Тарелка техасского бришкета' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 300.00, demandCategory: 'grill' }, // rcp_texas_smoked_brisket_plate -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cajun_grilled_shrimp_skewer', name: { en: 'Cajun Grilled Shrimp Skewer', ru: 'Каджун-шашлык из креветок' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 230.00, demandCategory: 'grill' }, // rcp_cajun_grilled_shrimp_skewer -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_bacon_burger', name: { en: 'Maple Bacon Burger', ru: 'Бургер с кленовым беконом' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 270.00, demandCategory: 'grill' }, // rcp_maple_bacon_burger -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_legends_lobster_steak', name: { en: 'Legends Lobster Steak', ru: 'Стейк-лобстер «Легенды»' }, itemClass: 'dish', tier: 5, storage: 'general', basePrice: 900.00, demandCategory: 'grill' }, // rcp_legends_lobster_steak -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_sweet_tea', name: { en: 'Sweet Tea', ru: 'Сладкий чай' }, itemClass: 'dish', tier: 1, storage: 'icehouse', basePrice: 4.00, demandCategory: 'beverages' }, // rcp_sweet_tea -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cream_soda', name: { en: 'Cream Soda', ru: 'Крем-содовая' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 14.00, demandCategory: 'beverages' }, // rcp_cream_soda -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_fresh_lemonade_float', name: { en: 'Fresh Lemonade Float', ru: 'Лимонадный флоат' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 15.00, demandCategory: 'beverages' }, // rcp_fresh_lemonade_float -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_classic_milkshake', name: { en: 'Classic Milkshake', ru: 'Классический молочный коктейль' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 20.00, demandCategory: 'beverages' }, // rcp_classic_milkshake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_chocolate_soda', name: { en: 'Chocolate Soda', ru: 'Шоколадная содовая' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 18.00, demandCategory: 'beverages' }, // rcp_chocolate_soda -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_farmhouse_coffee', name: { en: 'Farmhouse Coffee', ru: 'Домашний кофе' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 14.00, demandCategory: 'beverages' }, // rcp_farmhouse_coffee -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_strawberry_malt', name: { en: 'Strawberry Malt', ru: 'Клубничный малт' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 42.00, demandCategory: 'beverages' }, // rcp_strawberry_malt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_southern_coffee', name: { en: 'Southern Coffee', ru: 'Южный кофе' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 33.00, demandCategory: 'beverages' }, // rcp_southern_coffee -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_cream_coffee', name: { en: 'Honey Cream Coffee', ru: 'Кофе со сливками и мёдом' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 42.00, demandCategory: 'beverages' }, // rcp_honey_cream_coffee -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pumpkin_spice_shake', name: { en: 'Pumpkin Spice Shake', ru: 'Тыквенно-пряный шейк' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 60.00, demandCategory: 'beverages' }, // rcp_pumpkin_spice_shake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_peach_sweet_tea', name: { en: 'Peach Sweet Tea', ru: 'Персиковый сладкий чай' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 165.00, demandCategory: 'beverages' }, // rcp_peach_sweet_tea -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_coffee_malt', name: { en: 'Maple Coffee Malt', ru: 'Кленовый кофейный малт' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 200.00, demandCategory: 'beverages' }, // rcp_maple_coffee_malt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_banana_split', name: { en: 'Banana Split', ru: 'Банана-сплит' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 95.00, demandCategory: 'beverages' }, // rcp_banana_split -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_california_citrus_cooler', name: { en: 'California Citrus Cooler', ru: 'Калифорнийский цитрусовый кулер' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 560.00, demandCategory: 'beverages' }, // rcp_california_citrus_cooler -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_vanilla_scoop', name: { en: 'Vanilla Scoop', ru: 'Шарик пломбира' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 14.00, demandCategory: 'desserts' }, // rcp_vanilla_scoop -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_cookie', name: { en: 'Honey Cookie', ru: 'Медовое печенье' }, itemClass: 'dish', tier: 1, storage: 'icehouse', basePrice: 6.00, demandCategory: 'desserts' }, // rcp_honey_cookie -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_strawberry_sundae', name: { en: 'Strawberry Sundae', ru: 'Клубничный санди' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 24.00, demandCategory: 'desserts' }, // rcp_strawberry_sundae -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_buttermilk_pudding', name: { en: 'Buttermilk Pudding', ru: 'Пудинг на пахте' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 22.00, demandCategory: 'desserts' }, // rcp_buttermilk_pudding -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_caramel_apple', name: { en: 'Caramel Apple', ru: 'Карамельное яблоко' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 19.00, demandCategory: 'desserts' }, // rcp_caramel_apple -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cherry_cobbler_sundae', name: { en: 'Cherry Cobbler Sundae', ru: 'Санди с вишнёвым коблером' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 78.00, demandCategory: 'desserts' }, // rcp_cherry_cobbler_sundae -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pumpkin_ice_cream', name: { en: 'Pumpkin Ice Cream', ru: 'Тыквенное мороженое' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 74.00, demandCategory: 'desserts' }, // rcp_pumpkin_ice_cream -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pecan_praline', name: { en: 'Pecan Praline', ru: 'Пекановая пралине' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 68.00, demandCategory: 'desserts' }, // rcp_pecan_praline -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_pecan_ice_cream', name: { en: 'Honey Pecan Ice Cream', ru: 'Мёдово-пекановое мороженое' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 80.00, demandCategory: 'desserts' }, // rcp_honey_pecan_ice_cream -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_georgia_peach_ice_cream', name: { en: 'Georgia Peach Ice Cream', ru: 'Персиковое мороженое Джорджии' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 200.00, demandCategory: 'desserts' }, // rcp_georgia_peach_ice_cream -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_praline_bread_pudding', name: { en: 'Praline Bread Pudding', ru: 'Пекановый брэд-пудинг' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 105.00, demandCategory: 'desserts' }, // rcp_praline_bread_pudding -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_pecan_sundae', name: { en: 'Maple Pecan Sundae', ru: 'Санди с кленовым сиропом и пеканом' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 210.00, demandCategory: 'desserts' }, // rcp_maple_pecan_sundae -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_truffle_honey_gelato', name: { en: 'Truffle Honey Gelato', ru: 'Трюфельно-медовое джелато' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 620.00, demandCategory: 'desserts' }, // rcp_truffle_honey_gelato -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_vanilla_citrus_panna_cotta', name: { en: 'Vanilla Citrus Panna Cotta', ru: 'Ванильно-цитрусовая панна-котта' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 590.00, demandCategory: 'desserts' }, // rcp_vanilla_citrus_panna_cotta -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_egg_salad_sandwich', name: { en: 'Egg Salad Sandwich', ru: 'Сэндвич с яичным салатом' }, itemClass: 'dish', tier: 1, storage: 'general', basePrice: 7.00, demandCategory: 'sandwiches' }, // rcp_egg_salad_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_tomato_and_lettuce_sandwich', name: { en: 'Tomato & Lettuce Sandwich', ru: 'Сэндвич с томатом и салатом' }, itemClass: 'dish', tier: 1, storage: 'general', basePrice: 6.00, demandCategory: 'sandwiches' }, // rcp_tomato_and_lettuce_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_grilled_cheese', name: { en: 'Grilled Cheese', ru: 'Гриль-сэндвич с сыром' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 16.00, demandCategory: 'sandwiches' }, // rcp_grilled_cheese -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_blt', name: { en: 'BLT', ru: 'БЛТ (бекон-салат-томат)' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 22.00, demandCategory: 'sandwiches' }, // rcp_blt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_ham_and_cheese_melt', name: { en: 'Ham & Cheese Melt', ru: 'Ветчинно-сырный мелт' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 24.00, demandCategory: 'sandwiches' }, // rcp_ham_and_cheese_melt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_club_sandwich', name: { en: 'Club Sandwich', ru: 'Клаб-сэндвич' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 28.00, demandCategory: 'sandwiches' }, // rcp_club_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_patty_melt', name: { en: 'Patty Melt', ru: 'Пэтти-мелт' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 72.00, demandCategory: 'sandwiches' }, // rcp_patty_melt -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_beef_dip_sandwich', name: { en: 'Beef Dip Sandwich', ru: 'Сэндвич с говяжьим дипом' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 76.00, demandCategory: 'sandwiches' }, // rcp_beef_dip_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_southern_pimento_cheese_sandwich', name: { en: 'Southern Pimento Cheese Sandwich', ru: 'Сэндвич с пимento-сыром' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 62.00, demandCategory: 'sandwiches' }, // rcp_southern_pimento_cheese_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cajun_chicken_sandwich', name: { en: 'Cajun Chicken Sandwich', ru: 'Каджун-сэндвич с курицей' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 195.00, demandCategory: 'sandwiches' }, // rcp_cajun_chicken_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_brisket_sandwich', name: { en: 'Brisket Sandwich', ru: 'Сэндвич с бришкетом' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 280.00, demandCategory: 'sandwiches' }, // rcp_brisket_sandwich -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_lobster_roll', name: { en: 'Lobster Roll', ru: 'Лобстер-ролл' }, itemClass: 'dish', tier: 5, storage: 'general', basePrice: 540.00, demandCategory: 'sandwiches' }, // rcp_lobster_roll -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_buttermilk_biscuits_and_gravy', name: { en: 'Buttermilk Biscuits & Gravy', ru: 'Бисквиты с гарви' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 19.00, demandCategory: 'southern_cuisine' }, // rcp_buttermilk_biscuits_and_gravy -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cornbread_and_honey', name: { en: 'Cornbread & Honey', ru: 'Кукурузный хлеб с мёдом' }, itemClass: 'dish', tier: 2, storage: 'general', basePrice: 20.00, demandCategory: 'southern_cuisine' }, // rcp_cornbread_and_honey -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_fried_green_tomatoes', name: { en: 'Fried Green Tomatoes', ru: 'Жареные зелёные томаты' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 65.00, demandCategory: 'southern_cuisine' }, // rcp_fried_green_tomatoes -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_southern_fried_chicken', name: { en: 'Southern Fried Chicken', ru: 'Жареная курица по-южному' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 78.00, demandCategory: 'southern_cuisine' }, // rcp_southern_fried_chicken -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_hushpuppies_basket', name: { en: 'Hushpuppies Basket', ru: 'Корзинка хашпаппи' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 42.00, demandCategory: 'southern_cuisine' }, // rcp_hushpuppies_basket -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_catfish_fry_plate', name: { en: 'Catfish Fry Plate', ru: 'Тарелка жареного сома' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 70.00, demandCategory: 'southern_cuisine' }, // rcp_catfish_fry_plate -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pecan_crusted_chicken', name: { en: 'Pecan-Crusted Chicken', ru: 'Курица в пекановой панировке' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 74.00, demandCategory: 'southern_cuisine' }, // rcp_pecan_crusted_chicken -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_nashville_hot_chicken', name: { en: 'Nashville Hot Chicken', ru: '«Нэшвиллская» острая курица' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 82.00, demandCategory: 'southern_cuisine' }, // rcp_nashville_hot_chicken -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_chicago_beef_stew', name: { en: 'Chicago Beef Stew', ru: 'Чикагское говяжье рагу' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 85.00, demandCategory: 'southern_cuisine' }, // rcp_chicago_beef_stew -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cajun_jambalaya', name: { en: 'Cajun Jambalaya', ru: 'Каджун-джамбалайя' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 250.00, demandCategory: 'southern_cuisine' }, // rcp_cajun_jambalaya -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_louisiana_gumbo', name: { en: 'Louisiana Gumbo', ru: 'Гамбо Луизианы' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 260.00, demandCategory: 'southern_cuisine' }, // rcp_louisiana_gumbo -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_texas_chili', name: { en: 'Texas Chili', ru: 'Техасский чили' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 220.00, demandCategory: 'southern_cuisine' }, // rcp_texas_chili -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_smoked_bbq_ribs_platter', name: { en: 'Smoked BBQ Ribs Platter', ru: 'Тарелка копчёных рёбрышек' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 310.00, demandCategory: 'southern_cuisine' }, // rcp_smoked_bbq_ribs_platter -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_georgia_pecan_pie_plate_special', name: { en: 'Georgia Pecan Pie Plate Special', ru: 'Тарелка «Джорджия»' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 340.00, demandCategory: 'southern_cuisine' }, // rcp_georgia_pecan_pie_plate_special -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_catfish_bites', name: { en: 'Catfish Bites', ru: 'Кусочки сома в панировке' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 20.00, demandCategory: 'seafood' }, // rcp_catfish_bites -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_corn_and_catfish_chowder', name: { en: 'Corn & Catfish Chowder', ru: 'Чаудер из сома с кукурузой' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 76.00, demandCategory: 'seafood' }, // rcp_corn_and_catfish_chowder -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_county_fish_fry', name: { en: 'County Fish Fry', ru: 'Тарелка жареной рыбы округа' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 72.00, demandCategory: 'seafood' }, // rcp_county_fish_fry -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_shrimp_gumbo_bowl', name: { en: 'Shrimp Gumbo Bowl', ru: 'Миска гамбо с креветками' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 245.00, demandCategory: 'seafood' }, // rcp_shrimp_gumbo_bowl -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_fried_gulf_shrimp_basket', name: { en: 'Fried Gulf Shrimp Basket', ru: 'Корзинка жареных креветок Галфа' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 210.00, demandCategory: 'seafood' }, // rcp_fried_gulf_shrimp_basket -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_crawfish_boil', name: { en: 'Crawfish Boil', ru: 'Отварные раки по-луизиански' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 225.00, demandCategory: 'seafood' }, // rcp_crawfish_boil -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_shrimp_poboy', name: { en: 'Shrimp Po\'Boy', ru: 'По-бой с креветками' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 215.00, demandCategory: 'seafood' }, // rcp_shrimp_poboy -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_crab_cake_duo', name: { en: 'Crab Cake Duo', ru: 'Дуэт крабовых котлет' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 230.00, demandCategory: 'seafood' }, // rcp_crab_cake_duo -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maine_lobster_bisque', name: { en: 'Maine Lobster Bisque', ru: 'Биск из лобстера Мэна' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 640.00, demandCategory: 'seafood' }, // rcp_maine_lobster_bisque -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_fried_lobster_tail', name: { en: 'Fried Lobster Tail', ru: 'Жареный хвост лобстера' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 610.00, demandCategory: 'seafood' }, // rcp_fried_lobster_tail -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_lobster_roll_deluxe', name: { en: 'Lobster Roll Deluxe', ru: 'Лобстер-ролл делюкс' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 950.00, demandCategory: 'seafood' }, // rcp_lobster_roll_deluxe -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maine_clam_and_truffle_chowder', name: { en: 'Maine Clam & Truffle Chowder', ru: 'Чаудер из моллюсков Мэна с трюфелем' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 900.00, demandCategory: 'seafood' }, // rcp_maine_clam_and_truffle_chowder -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_bacon_shake', name: { en: 'Bacon Shake', ru: 'Шейк с беконом' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 50.00, demandCategory: 'beverages' }, // rcp_secret_bacon_shake -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pickle_lemonade', name: { en: 'Pickle Lemonade', ru: 'Лимонад с рассолом' }, itemClass: 'dish', tier: 1, storage: 'icehouse', basePrice: 6.00, demandCategory: 'beverages' }, // rcp_secret_pickle_lemonade -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_coffee_glazed_bacon', name: { en: 'Coffee-Glazed Bacon', ru: 'Бекон в кофейной глазури' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 37.00, demandCategory: 'grill' }, // rcp_secret_coffee_glazed_bacon -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cherry_cola_float', name: { en: 'Cherry Cola Float', ru: 'Вишнёво-колный флоат' }, itemClass: 'dish', tier: 2, storage: 'icehouse', basePrice: 14.00, demandCategory: 'beverages' }, // rcp_secret_cherry_cola_float -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_honey_fried_chicken', name: { en: 'Honey Fried Chicken', ru: 'Курица в медовой панировке' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 94.00, demandCategory: 'southern_cuisine' }, // rcp_secret_honey_fried_chicken -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_peach_bbq_ribs', name: { en: 'Peach BBQ Ribs', ru: 'Рёбрышки в персиковом барбекю' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 341.00, demandCategory: 'southern_cuisine' }, // rcp_secret_peach_bbq_ribs -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_maple_bacon_doughnut', name: { en: 'Maple Bacon Doughnut', ru: 'Пончик с кленовым беконом' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 55.00, demandCategory: 'baking' }, // rcp_secret_maple_bacon_doughnut -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_truffle_fries', name: { en: 'Truffle Fries', ru: 'Картофель фри с трюфелем' }, itemClass: 'dish', tier: 5, storage: 'general', basePrice: 560.00, demandCategory: 'southern_cuisine' }, // rcp_secret_truffle_fries -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_bacon_maple_ice_cream', name: { en: 'Bacon Maple Ice Cream', ru: 'Мороженое с беконом и кленовым сиропом' }, itemClass: 'dish', tier: 4, storage: 'icehouse', basePrice: 195.00, demandCategory: 'desserts' }, // rcp_secret_bacon_maple_ice_cream -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_spicy_honey_lemonade', name: { en: 'Spicy Honey Lemonade', ru: 'Острый медовый лимонад' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 45.00, demandCategory: 'beverages' }, // rcp_secret_spicy_honey_lemonade -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cheese_stuffed_cornbread', name: { en: 'Cheese-Stuffed Cornbread', ru: 'Кукурузный хлеб с сыром внутри' }, itemClass: 'dish', tier: 2, storage: 'silo', basePrice: 23.00, demandCategory: 'baking' }, // rcp_secret_cheese_stuffed_cornbread -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_lobster_mac_bites', name: { en: 'Lobster Mac Bites', ru: 'Лобстерные мак-биты' }, itemClass: 'dish', tier: 5, storage: 'icehouse', basePrice: 580.00, demandCategory: 'seafood' }, // rcp_secret_lobster_mac_bites -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_crawfish_cornbread', name: { en: 'Crawfish Cornbread', ru: 'Кукурузный хлеб с раками' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 215.00, demandCategory: 'southern_cuisine' }, // rcp_secret_crawfish_cornbread -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_chili_chocolate_soda', name: { en: 'Chili Chocolate Soda', ru: 'Шоколадная содовая с перцем' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 23.00, demandCategory: 'beverages' }, // rcp_secret_chili_chocolate_soda -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_smoked_honey_butter', name: { en: 'Smoked Honey Butter', ru: 'Копчёное медовое масло' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 75.00, demandCategory: 'baking' }, // rcp_secret_smoked_honey_butter -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_sweet_tea_fried_chicken', name: { en: 'Sweet Tea Fried Chicken', ru: 'Курица, жаренная в сладком чае' }, itemClass: 'dish', tier: 3, storage: 'general', basePrice: 92.00, demandCategory: 'southern_cuisine' }, // rcp_secret_sweet_tea_fried_chicken -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_truffle_grilled_cheese', name: { en: 'Truffle Grilled Cheese', ru: 'Гриль-сэндвич с трюфелем' }, itemClass: 'dish', tier: 5, storage: 'general', basePrice: 580.00, demandCategory: 'sandwiches' }, // rcp_secret_truffle_grilled_cheese -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_coffee_bbq_brisket', name: { en: 'Coffee BBQ Brisket', ru: 'Бришкет в кофейном барбекю' }, itemClass: 'dish', tier: 4, storage: 'general', basePrice: 330.00, demandCategory: 'southern_cuisine' }, // rcp_secret_coffee_bbq_brisket -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_cornbread_ice_cream', name: { en: 'Cornbread Ice Cream', ru: 'Мороженое с кукурузным хлебом' }, itemClass: 'dish', tier: 3, storage: 'icehouse', basePrice: 28.00, demandCategory: 'desserts' }, // rcp_secret_cornbread_ice_cream -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_pecan_bacon_waffles', name: { en: 'Pecan Bacon Waffles', ru: 'Вафли с пеканом и беконом' }, itemClass: 'dish', tier: 3, storage: 'silo', basePrice: 30.00, demandCategory: 'breakfasts' }, // rcp_secret_pecan_bacon_waffles -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_ghost_pepper_gumbo', name: { en: 'Ghost Pepper Gumbo', ru: 'Гамбо с перцем-призраком' }, itemClass: 'dish', tier: 5, storage: 'general', basePrice: 320.00, demandCategory: 'southern_cuisine' }, // rcp_secret_ghost_pepper_gumbo -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)
  { key: 'dish_kitchen_sink_special', name: { en: 'Kitchen Sink Special', ru: 'Что бог послал' }, itemClass: 'dish', tier: 1, storage: 'silo', basePrice: 4.00, demandCategory: 'breakfasts' }, // rcp_secret_kitchen_sink_special -> продаётся NPC (recipeCatalogMeta 1:1, 06-recipes.md §4.2/§4.5)

  // ── Семена обычных грядочных культур (itemClass 'seed') ───────────────────────
  // Не отдельные строки §4.1–4.3 — см. преамбулу файла: нужны как Ingredient-записи,
  // на которые ссылается `CropDef.seedKey` в `catalogs/crops.ts` (владелец: crops-агент).
  // `basePrice` = та же себестоимость цикла из 05-ingredients.md, что уже используется
  // как `seedCost` в `crops.ts` для того же ключа (числа идентичны, не задвоены выдумкой).
  { key: 'seed_tomato', name: { en: 'Tomato Seed', ru: 'Семена томата' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.06 },
  { key: 'seed_lettuce', name: { en: 'Lettuce Seed', ru: 'Семена салата-латука' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.05 },
  { key: 'seed_potato', name: { en: 'Potato Seed', ru: 'Семена картофеля' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.07 },
  { key: 'seed_wheat', name: { en: 'Wheat Seed', ru: 'Семена пшеницы' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.08 },
  { key: 'seed_carrot', name: { en: 'Carrot Seed', ru: 'Семена моркови' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.05 },
  { key: 'seed_cucumber', name: { en: 'Cucumber Seed', ru: 'Семена огурца' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.05 },
  { key: 'seed_onion', name: { en: 'Onion Seed', ru: 'Семена лука репчатого' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.06 },
  { key: 'seed_bell_pepper', name: { en: 'Bell Pepper Seed', ru: 'Семена болгарского перца' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.07 },
  { key: 'seed_green_beans', name: { en: 'Green Beans Seed', ru: 'Семена стручковой фасоли' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.06 },
  { key: 'seed_radish', name: { en: 'Radish Seed', ru: 'Семена редиса' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.04 },
  { key: 'seed_spinach', name: { en: 'Spinach Seed', ru: 'Семена шпината' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.05 },
  { key: 'seed_cabbage', name: { en: 'Cabbage Seed', ru: 'Семена капусты' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.06 },
  { key: 'seed_beet', name: { en: 'Beet Seed', ru: 'Семена свёклы' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.07 },
  { key: 'seed_scallion', name: { en: 'Scallion Seed', ru: 'Семена зелёного лука' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.04 },
  { key: 'seed_basil', name: { en: 'Basil Seed', ru: 'Семена базилика' }, itemClass: 'seed', tier: 1, storage: 'general', basePrice: 0.05 },
  { key: 'seed_apple', name: { en: 'Apple Seed', ru: 'Семена яблони' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.35 },
  { key: 'seed_corn', name: { en: 'Corn Seed', ru: 'Семена кукурузы' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.30 },
  { key: 'seed_strawberry', name: { en: 'Strawberry Seed', ru: 'Семена клубники' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.32 },
  { key: 'seed_green_peas', name: { en: 'Green Peas Seed', ru: 'Семена зелёного горошка' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.25 },
  { key: 'seed_zucchini', name: { en: 'Zucchini Seed', ru: 'Семена кабачка' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.30 },
  { key: 'seed_blueberry', name: { en: 'Blueberry Seed', ru: 'Семена черники' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.34 },
  { key: 'seed_raspberry', name: { en: 'Raspberry Seed', ru: 'Семена малины' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.34 },
  { key: 'seed_rhubarb', name: { en: 'Rhubarb Seed', ru: 'Семена ревеня' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.36 },
  { key: 'seed_watermelon', name: { en: 'Watermelon Seed', ru: 'Семена арбуза' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.55 },
  { key: 'seed_asparagus', name: { en: 'Asparagus Seed', ru: 'Семена спаржи' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.40 },
  { key: 'seed_sugar_beet', name: { en: 'Sugar Beet Seed', ru: 'Семена сахарной свёклы' }, itemClass: 'seed', tier: 2, storage: 'general', basePrice: 0.45 },
  { key: 'seed_cherry', name: { en: 'Cherry Seed', ru: 'Семена вишни' }, itemClass: 'seed', tier: 3, storage: 'general', basePrice: 2.10 },
  { key: 'seed_pumpkin', name: { en: 'Pumpkin Seed', ru: 'Семена тыквы' }, itemClass: 'seed', tier: 3, storage: 'general', basePrice: 2.60 },
  { key: 'seed_butternut_squash', name: { en: 'Butternut Squash Seed', ru: 'Семена мускатной тыквы' }, itemClass: 'seed', tier: 3, storage: 'general', basePrice: 2.40 },
  { key: 'seed_sweet_potato', name: { en: 'Sweet Potato Seed', ru: 'Семена батата' }, itemClass: 'seed', tier: 3, storage: 'general', basePrice: 2.10 },
  { key: 'seed_snap_peas', name: { en: 'Snap Peas Seed', ru: 'Семена сахарного горошка' }, itemClass: 'seed', tier: 3, storage: 'general', basePrice: 1.60 },
]
