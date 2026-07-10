/**
 * data/catalogs/knowHow.ts — контент-каталог дерева Know-How: 4 ветки × 15 узлов
 * (канон §3.9, `docs/specs/13-progression.md §3.2`).
 *
 * Владелец: staff-knowhow-buildings контент-агент (см. AGENTS.md §2 — карта владения).
 * Схема — `KnowHowNodeDefSchema` (`../schema.ts`), проверяется `../validate.test.ts`
 * (в т.ч. ссылочная целостность `prereqs → node.key`).
 *
 * ГРАНИЦА: ноль three/scene/net — чистые данные (AGENTS.md §3).
 *
 * Числа — ИЗ СПЕКИ, все помечены там как (гипотеза) до калибровки в `14-economy.md`:
 *  - `pointsCost = tier` очков (§3.2.1: «cost = tier очков»; тир 1 = 1 очко … тир 15 = 15).
 *  - `studySec` — по тиру глубины, §4.3 (переведено в секунды):
 *    т1=0 (мгновенно), т2=600 (10м), т3=1800 (30м), т4=3600 (1ч), т5=7200 (2ч),
 *    т6=14400 (4ч), т7=21600 (6ч), т8=28800 (8ч), т9=36000 (10ч), т10=43200 (12ч),
 *    т11=50400 (14ч), т12=57600 (16ч), т13=64800 (18ч), т14=72000 (20ч), т15=86400 (24ч).
 *  - `prereqs` — «хребтовая» цепочка: узел тира N требует изученного узла тира
 *    N−1 той же ветки (§3.2.1 — ни одна из 4 таблиц §3.2.2–3.2.5 не указывает
 *    иной пред, значит правило по умолчанию применяется по всей ветке); тир 1 —
 *    без предпосылок (`prereqs: []`).
 *  - Гейт по Farm Level (§4.3, колонка «Гейт Farm Level») — НЕ часть
 *    `KnowHowNodeDefSchema` (схема не предусматривает это поле для данного
 *    каталога; гейт применяется системой прогрессии при `research_start`, не
 *    хранится здесь).
 *
 * Ключи узлов: `kh_<branch>_<node>` — английский slug названия узла из таблиц
 * §3.2.2–3.2.5 (напр. «Green Thumb» → `green_thumb`).
 */

import type { KnowHowNodeDef } from '../schema'

interface NodeSeed {
  slug: string
  name: { en: string; ru: string }
  effect: { en: string; ru: string }
}

const AGRONOMY: NodeSeed[] = [
  { slug: 'green_thumb', name: { en: 'Green Thumb', ru: 'Зелёный палец' }, effect: { en: '+5% Select chance on T1 crops', ru: '+5% шанс Select на T1' } },
  { slug: 'quick_sprout', name: { en: 'Quick Sprout', ru: 'Быстрый всход' }, effect: { en: '-5% T1 grow time', ru: '−5% время роста T1' } },
  { slug: 'composting', name: { en: 'Composting', ru: 'Компост' }, effect: { en: 'unlocks basic Fertilizer', ru: 'открывает базовое удобрение (Fertilizer)' } },
  { slug: 'raised_beds', name: { en: 'Raised Beds', ru: 'Приподнятые грядки' }, effect: { en: 'unlocks Raised plot tier', ru: 'открывает тир грядки Raised' } },
  { slug: 'crop_rotation', name: { en: 'Crop Rotation', ru: 'Севооборот' }, effect: { en: '+5% yield', ru: '+5% урожайность (yield)' } },
  { slug: 'irrigation_1', name: { en: 'Irrigation I', ru: 'Ирригация I' }, effect: { en: 'unlocks Irrigated plot tier', ru: 'открывает тир грядки Irrigated' } },
  { slug: 'orchard_care', name: { en: 'Orchard Care', ru: 'Уход за садом' }, effect: { en: '-10% tree/bush grow time', ru: '−10% время роста деревьев/кустов' } },
  { slug: 'prize_seeds', name: { en: 'Prize Seeds', ru: 'Призовые семена' }, effect: { en: '+5% Select chance on T2 crops', ru: '+5% шанс Select на T2' } },
  { slug: 'bee_friendly', name: { en: 'Bee-Friendly', ru: 'Дружба с пчёлами' }, effect: { en: '+10% honey yield, +orchard pollination', ru: '+10% выход мёда, +опыление садов' } },
  { slug: 'drip_lines', name: { en: 'Drip Lines', ru: 'Капельный полив' }, effect: { en: "+2 plots to Hank's auto-water", ru: '+2 грядки к авто-поливу Hank' } },
  { slug: 'heirloom_strains', name: { en: 'Heirloom Strains', ru: 'Реликтовые сорта' }, effect: { en: '+quality for ct_giant_veg contest', ru: '+качество для конкурса ct_giant_veg' } },
  { slug: 'soil_science', name: { en: 'Soil Science', ru: 'Почвоведение' }, effect: { en: '+10% yield (stacks)', ru: '+10% урожайность (стек)' } },
  { slug: 'greenhouse', name: { en: 'Greenhouse', ru: 'Теплица' }, effect: { en: 'year-round growth, removes off-season penalty', ru: 'круглогодичный рост, −эффект «несезона»' } },
  { slug: 'master_gardener', name: { en: 'Master Gardener', ru: 'Мастер-садовод' }, effect: { en: '+5% Select chance globally (all tiers)', ru: '+5% Select глобально (все тиры)' } },
  { slug: 'agronomy_mastery', name: { en: 'Agronomy Mastery', ru: 'Мастерство агрономии' }, effect: { en: 'capstone: +5% Select globally (stacks) + T5 garden seed slot', ru: 'капстоун: +5% Select глоб. (стек) + слот T5-садового семени' } },
]

const COOKERY: NodeSeed[] = [
  { slug: 'mise_en_place', name: { en: 'Mise en Place', ru: 'Всё по местам' }, effect: { en: '-5% T1-T2 cooking time', ru: '−5% время готовки T1–T2' } },
  { slug: 'batch_cooking', name: { en: 'Batch Cooking', ru: 'Партиями' }, effect: { en: '+1 to base machine batch size', ru: '+1 к размеру партии базовых станков' } },
  { slug: 'recipe_sense', name: { en: 'Recipe Sense', ru: 'Чутьё рецепта' }, effect: { en: '+5% Mastery ★ gain', ru: '+5% прирост Mastery ★' } },
  { slug: 'sharp_knives', name: { en: 'Sharp Knives', ru: 'Острые ножи' }, effect: { en: '-5% ingredient prep time', ru: '−5% время подготовки ингредиентов' } },
  { slug: 'flavor_pairing', name: { en: 'Flavor Pairing', ru: 'Сочетание вкусов' }, effect: { en: '+bonus to Blue Plate Special price', ru: '+бонус к цене Blue Plate Special' } },
  { slug: 'second_oven', name: { en: 'Second Oven', ru: 'Второй духовой шкаф' }, effect: { en: '+1 kitchen machine slot', ru: '+1 слот станка на кухне' } },
  { slug: 'sauce_base', name: { en: 'Sauce Base', ru: 'Соусная база' }, effect: { en: '+5% dish value', ru: '+5% ценность блюд' } },
  { slug: 'pastry_arts', name: { en: 'Pastry Arts', ru: 'Кондитерское дело' }, effect: { en: '+1★ pastry mastery (stacks with Rosalind)', ru: '+1★ mastery выпечки (стек с Rosalind)' } },
  { slug: 'grill_mastery', name: { en: 'Grill Mastery', ru: 'Мастерство гриля' }, effect: { en: '+1 grill batch (stacks with Marty)', ru: '+1 партия гриля (стек с Marty)' } },
  { slug: 'slow_low', name: { en: 'Slow & Low', ru: 'Долго и на медленном' }, effect: { en: '+15% value of "overnight" recipes (8h+)', ru: '+15% ценность «ночных» рецептов (8ч+)' } },
  { slug: 'plating', name: { en: 'Plating', ru: 'Подача' }, effect: { en: '+5% tips on "plated" dishes', ru: '+5% чаевые с «выложенных» блюд' } },
  { slug: 'test_kitchen', name: { en: 'Test Kitchen', ru: 'Экспериментальная кухня' }, effect: { en: '+chance to discover a secret recipe', ru: '+шанс открыть секретный рецепт' } },
  { slug: 'prep_crew', name: { en: 'Prep Crew', ru: 'Бригада заготовки' }, effect: { en: '-5% cooking time at full kitchen', ru: '−5% время готовки при полной кухне' } },
  { slug: 'signature_dish', name: { en: 'Signature Dish', ru: 'Фирменное блюдо' }, effect: { en: 'unlocks 1 House Signature recipe slot', ru: 'открывает 1 слот House Signature-рецепта' } },
  { slug: 'cookery_mastery', name: { en: 'Cookery Mastery', ru: 'Мастерство кухни' }, effect: { en: 'capstone: -5% cooking time globally + 1 batch globally', ru: 'капстоун: −5% готовка глоб. + 1 партия глоб.' } },
]

const COMMERCE: NodeSeed[] = [
  { slug: 'penny_saver', name: { en: 'Penny Saver', ru: 'Экономный' }, effect: { en: '-5% building upgrade cost', ru: '−5% стоимость апгрейдов построек' } },
  { slug: 'good_tips', name: { en: 'Good Tips', ru: 'Хорошие чаевые' }, effect: { en: '+5% tips', ru: '+5% чаевые' } },
  { slug: 'grain_bins', name: { en: 'Grain Bins', ru: 'Зерновые бункеры' }, effect: { en: '+25% bld_silo capacity', ru: '+25% ёмкость bld_silo' } },
  { slug: 'cold_storage', name: { en: 'Cold Storage', ru: 'Холодное хранение' }, effect: { en: '+25% bld_icehouse capacity', ru: '+25% ёмкость bld_icehouse' } },
  { slug: 'wholesale', name: { en: 'Wholesale', ru: 'Опт' }, effect: { en: '-10% seed/feed/catalog price', ru: '−10% цена семян/корма/каталога' } },
  { slug: 'menu_pricing', name: { en: 'Menu Pricing', ru: 'Ценник меню' }, effect: { en: '+5% dish price', ru: '+5% цена блюд' } },
  { slug: 'regulars', name: { en: 'Regulars', ru: 'Завсегдатаи' }, effect: { en: '+bonus to mech_regular_streak', ru: '+бонус к mech_regular_streak' } },
  { slug: 'bulk_sales', name: { en: 'Bulk Sales', ru: 'Оптовые продажи' }, effect: { en: '+10% Co-op Order reward', ru: '+10% награда за Co-op Orders' } },
  { slug: 'bookkeeping', name: { en: 'Bookkeeping', ru: 'Бухучёт' }, effect: { en: '+5% Bucks from sales (stacks with Ada)', ru: '+5% Bucks с продаж (стек с Ada)' } },
  { slug: 'marquee', name: { en: 'Marquee', ru: 'Неоновая вывеска' }, effect: { en: '+counter guests', ru: '+посетители прилавка' } },
  { slug: 'premium_combo', name: { en: 'Premium Combo', ru: 'Премиум-сет' }, effect: { en: '+10% Blue Plate Special price', ru: '+10% цена Blue Plate Special' } },
  { slug: 'warehouse', name: { en: 'Warehouse', ru: 'Склад' }, effect: { en: '+15% global storage capacity', ru: '+15% глобальная ёмкость хранения' } },
  { slug: 'franchising', name: { en: 'Franchising', ru: 'Франшиза' }, effect: { en: '+2nd passive sales channel', ru: '+2-й канал пассивных продаж' } },
  { slug: 'bargaining', name: { en: 'Bargaining', ru: 'Торг' }, effect: { en: '-15% Mail Catalog prices', ru: '−15% цены Mail Catalog' } },
  { slug: 'commerce_mastery', name: { en: 'Commerce Mastery', ru: 'Мастерство коммерции' }, effect: { en: 'capstone: +5% to all Bucks income', ru: 'капстоун: +5% ко всему Bucks-доходу' } },
]

const CIVICS: NodeSeed[] = [
  { slug: 'neighborly', name: { en: 'Neighborly', ru: 'По-соседски' }, effect: { en: '+bonus to Street Potluck', ru: '+бонус к Street Potluck' } },
  { slug: 'convoy', name: { en: 'Convoy', ru: 'Конвой' }, effect: { en: '-5% expedition time', ru: '−5% время экспедиций' } },
  { slug: 'town_spirit', name: { en: 'Town Spirit', ru: 'Дух города' }, effect: { en: '+5% Appetite Meter contribution value', ru: '+5% ценность вклада в Appetite Meter' } },
  { slug: 'extra_route', name: { en: 'Extra Route', ru: 'Лишний маршрут' }, effect: { en: 'gates the 3rd expedition route slot', ru: 'гейт 3-го слота маршрута экспедиции' } },
  { slug: 'postal_pull', name: { en: 'Postal Pull', ru: 'Почтовые связи' }, effect: { en: '-20% Mail Catalog delivery time', ru: '−20% время доставки Mail Catalog' } },
  { slug: 'mentor', name: { en: 'Mentor', ru: 'Наставник' }, effect: { en: '+newcomer mentorship bonus', ru: '+бонус менторства новичкам' } },
  { slug: 'carpool', name: { en: 'Carpool', ru: 'Совместные поездки' }, effect: { en: '+Field synergy effect', ru: '+эффект Field-синергии' } },
  { slug: 'fair_prep', name: { en: 'Fair Prep', ru: 'Подготовка к ярмарке' }, effect: { en: '+ui_fair_stall throughput', ru: '+пропускная способность ui_fair_stall' } },
  { slug: 'volunteer', name: { en: 'Volunteer', ru: 'Волонтёр' }, effect: { en: '+10% Town Projects contribution', ru: '+10% вклад в Town Projects' } },
  { slug: 'road_crew', name: { en: 'Road Crew', ru: 'Дорожная бригада' }, effect: { en: '-10% expedition cost/fuel', ru: '−10% стоимость/топливо экспедиций' } },
  { slug: 'welcome_wagon', name: { en: 'Welcome Wagon', ru: 'Приветственный фургон' }, effect: { en: '+mech_grand_opening duration/strength', ru: '+длительность/сила Grand Opening (mech_grand_opening)' } },
  { slug: 'radio_hour', name: { en: 'Radio Hour', ru: 'Час радио' }, effect: { en: 'preview next week\'s Demand Board', ru: 'предпросмотр Demand Board следующей недели' } },
  { slug: 'block_party', name: { en: 'Block Party', ru: 'Уличная вечеринка' }, effect: { en: '+street buff on full potluck', ru: '+бафф стриту при полном potluck' } },
  { slug: 'county_fair', name: { en: 'County Fair', ru: 'Окружная ярмарка' }, effect: { en: '+fair contest judging points', ru: '+очки в судействе конкурсов ярмарки' } },
  { slug: 'civics_mastery', name: { en: 'Civics Mastery', ru: 'Мастерство города' }, effect: { en: 'capstone: +event rewards + gates the 4th (max) route slot', ru: 'капстоун: +событийные награды + гейт 4-го (макс.) слота маршрута' } },
]

/** Время исследования по тиру глубины (§4.3), в секундах. Индекс 0 = тир 1. */
const STUDY_SEC_BY_TIER: readonly number[] = [
  0, 600, 1800, 3600, 7200, 14400, 21600, 28800, 36000, 43200, 50400, 57600, 64800, 72000, 86400,
]

/** Индексация массива фиксированной длины с проверкой границ (noUncheckedIndexedAccess). */
function at(arr: readonly number[], idx: number): number {
  const v = arr[idx]
  if (v === undefined) {
    throw new Error(`at: индекс ${idx} вне диапазона (длина массива ${arr.length})`)
  }
  return v
}

function buildBranch(branch: 'kh_agronomy' | 'kh_cookery' | 'kh_commerce' | 'kh_civics', nodes: NodeSeed[]): KnowHowNodeDef[] {
  if (nodes.length !== 15) {
    throw new Error(`buildBranch(${branch}): ожидается ровно 15 узлов, получено ${nodes.length}`)
  }
  return nodes.map((node, idx) => {
    const tier = idx + 1
    const key = `${branch}_${node.slug}`
    const prevNode = idx === 0 ? undefined : nodes[idx - 1]
    const prevKey = prevNode ? `${branch}_${prevNode.slug}` : undefined
    return {
      key,
      branch,
      name: node.name,
      effect: node.effect,
      prereqs: prevKey ? [prevKey] : [],
      pointsCost: tier,
      studySec: at(STUDY_SEC_BY_TIER, idx),
    }
  })
}

export const knowHowNodes: KnowHowNodeDef[] = [
  ...buildBranch('kh_agronomy', AGRONOMY),
  ...buildBranch('kh_cookery', COOKERY),
  ...buildBranch('kh_commerce', COMMERCE),
  ...buildBranch('kh_civics', CIVICS),
]
