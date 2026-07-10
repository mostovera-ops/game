/**
 * catalogs/achievements.ts — 63 таблички Achievement Wall (17-collections §3.5).
 *
 * Источник: `docs/specs/17-collections.md` §3.5.1–§3.5.8 (закрытый список для MVP,
 * "не переиспользовать номера"). `key`/`category`(RU-заголовок раздела)/`condition.ru`/
 * `rewardTitle` — дословно из спеки (условие RU по таблице, `rewardTitle` — колонка
 * «Награда-табличка», кавычки «» убраны, EN-имя оставлено как есть кандидатом).
 * `condition.en` — авторский перевод RU-условия (спека не даёт EN-текст условий;
 * сами условия/числа НЕ меняются, только язык).
 *
 * `key` в спеке помечены как "нейминг-кандидаты, требуют канона" (§3.5 сноска,
 * 17-collections §8 п.1) — используем как есть, ничего не переименовываем.
 *
 * `hidden` не проставляется: спека не указывает явно, какие таблички скрыты до
 * получения — не выдумываем этот флаг там, где источник молчит.
 */

import type { Achievement } from '../schema'

const FARM_AND_PRODUCTION = 'Ферма и производство'
const KITCHEN_AND_MASTERY = 'Кухня и mastery'
const FAIR_AND_CONTESTS = 'Ярмарка и конкурсы'
const COOP_AND_STREET = 'Кооп и стрит'
const EXPEDITIONS_AND_POSTCARDS = 'Экспедиции и открытки'
const STREAK_AND_REGULARS = 'Стрик и завсегдатаи'
const COLLECTIONS_AND_COSMETICS = 'Коллекции и косметика'
const TOWN_AND_SPECIAL = 'Общегородские и особые'

export const achievements: Achievement[] = [
  // §3.5.1 Ферма и производство (12)
  {
    key: 'ach_first_harvest',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'First harvest', ru: 'Первый урожай' },
    rewardTitle: 'First Harvest',
  },
  {
    key: 'ach_100_crops',
    category: FARM_AND_PRODUCTION,
    condition: { en: '100 crops harvested', ru: 'Собрано 100 урожаев' },
    rewardTitle: 'Green Thumb',
  },
  {
    key: 'ach_1000_crops',
    category: FARM_AND_PRODUCTION,
    condition: { en: '1,000 crops harvested', ru: 'Собрано 1,000 урожаев' },
    rewardTitle: 'Master Grower',
  },
  {
    key: 'ach_first_animal',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'First animal purchased', ru: 'Первое животное куплено' },
    rewardTitle: 'First Friend',
  },
  {
    key: 'ach_barn_full',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'Barn filled to capacity at least once', ru: 'Амбар заполнен полностью хотя бы раз' },
    rewardTitle: 'Full House',
  },
  {
    key: 'ach_all_t1',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'All T1 recipes unlocked', ru: 'Все рецепты T1 открыты' },
    rewardTitle: 'Garden Graduate',
  },
  {
    key: 'ach_all_t2',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'All T2 recipes unlocked', ru: 'Все рецепты T2 открыты' },
    rewardTitle: 'Farmhand Certified',
  },
  {
    key: 'ach_all_t3',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'All T3 recipes unlocked', ru: 'Все рецепты T3 открыты' },
    rewardTitle: 'County Fair Regular',
  },
  {
    key: 'ach_all_t4',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'All T4 recipes unlocked', ru: 'Все рецепты T4 открыты' },
    rewardTitle: 'States Traveler',
  },
  {
    key: 'ach_all_t5',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'All T5 recipes unlocked', ru: 'Все рецепты T5 открыты' },
    rewardTitle: 'Living Legend',
  },
  {
    key: 'ach_first_secret_recipe',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'First secret recipe unlocked', ru: 'Открыта первая секретка-рецепт' },
    rewardTitle: 'Kitchen Alchemist',
  },
  {
    key: 'ach_farm_value_10k',
    category: FARM_AND_PRODUCTION,
    condition: { en: 'Farm Value reached 10,000', ru: 'Farm Value достиг 10,000' },
    rewardTitle: 'Ten Grand Farm',
  },

  // §3.5.2 Кухня и mastery (8)
  {
    key: 'ach_first_5star',
    category: KITCHEN_AND_MASTERY,
    condition: { en: 'First recipe reaches ★★★★★', ru: 'Первый рецепт до ★★★★★' },
    rewardTitle: 'Five-Star Kitchen',
  },
  {
    key: 'ach_10_5star',
    category: KITCHEN_AND_MASTERY,
    condition: { en: '10 recipes reach ★★★★★', ru: '10 рецептов до ★★★★★' },
    rewardTitle: 'Kitchen Legend',
  },
  {
    key: 'ach_100_dishes',
    category: KITCHEN_AND_MASTERY,
    condition: { en: '100 dishes cooked (any)', ru: '100 приготовленных блюд (любых)' },
    rewardTitle: 'Short Order Cook',
  },
  {
    key: 'ach_1000_dishes',
    category: KITCHEN_AND_MASTERY,
    condition: { en: '1,000 dishes cooked', ru: '1,000 приготовленных блюд' },
    rewardTitle: 'Line Cook Legend',
  },
  {
    key: 'ach_10000_dishes',
    category: KITCHEN_AND_MASTERY,
    condition: { en: '10,000 dishes cooked', ru: '10,000 приготовленных блюд' },
    rewardTitle: 'Kitchen Immortal',
  },
  {
    key: 'ach_first_blue_plate',
    category: KITCHEN_AND_MASTERY,
    condition: { en: 'First Blue Plate Special assembled', ru: 'Собран первый Blue Plate Special' },
    rewardTitle: 'Blue Plate Debut',
  },
  {
    key: 'ach_50_blue_plate',
    category: KITCHEN_AND_MASTERY,
    condition: { en: '50 Blue Plate Specials sold', ru: '50 Blue Plate Special проданы' },
    rewardTitle: 'Blue Plate Regular',
  },
  {
    key: 'ach_mystery_plate_5',
    category: KITCHEN_AND_MASTERY,
    condition: {
      en: 'Mystery Plate received 5 times (failed experiment, no penalty)',
      ru: '5 раз получен Mystery Plate (неудачный эксперимент без штрафа)',
    },
    rewardTitle: 'Mad Scientist',
  },

  // §3.5.3 Ярмарка и конкурсы (10)
  {
    key: 'ach_first_fair',
    category: FAIR_AND_CONTESTS,
    condition: { en: 'First fair participation (stock listed)', ru: 'Первое участие в ярмарке (выложил сток)' },
    rewardTitle: 'Opening Day',
  },
  {
    key: 'ach_first_shift',
    category: FAIR_AND_CONTESTS,
    condition: { en: 'First active Counter Shift', ru: 'Первая активная Counter Shift' },
    rewardTitle: 'First Shift',
  },
  {
    key: 'ach_combo_10',
    category: FAIR_AND_CONTESTS,
    condition: { en: 'A ×10 no-miss streak in a single shift', ru: 'Серия без промаха ×10 за одну смену' },
    rewardTitle: 'Hot Streak',
  },
  {
    key: 'ach_1000_dishes_sold',
    category: FAIR_AND_CONTESTS,
    condition: { en: '1,000 dishes sold at the fair', ru: 'Продано 1,000 блюд на ярмарке' },
    rewardTitle: 'Sold Out',
  },
  {
    key: 'ach_first_ribbon',
    category: FAIR_AND_CONTESTS,
    condition: { en: 'First Blue Ribbon', ru: 'Первая Blue Ribbon' },
    rewardTitle: 'Blue Ribbon Debut',
  },
  {
    key: 'ach_10_ribbons',
    category: FAIR_AND_CONTESTS,
    condition: { en: '10 Blue Ribbons (any)', ru: '10 Blue Ribbon (любых)' },
    rewardTitle: 'Ribbon Collector',
  },
  {
    key: 'ach_pie_champion_3',
    category: FAIR_AND_CONTESTS,
    condition: { en: '3 Pie of the Week wins', ru: '3 победы в Pie of the Week' },
    rewardTitle: 'Pie Champion',
  },
  {
    key: 'ach_giant_veg_champion_3',
    category: FAIR_AND_CONTESTS,
    condition: { en: '3 Giant Vegetable wins', ru: '3 победы в Giant Vegetable' },
    rewardTitle: 'Giant Grower',
  },
  {
    key: 'ach_best_window_champion_3',
    category: FAIR_AND_CONTESTS,
    condition: { en: '3 Best Window wins', ru: '3 победы в Best Window' },
    rewardTitle: 'Window Dresser',
  },
  {
    key: 'ach_all_divisions',
    category: FAIR_AND_CONTESTS,
    condition: {
      en: 'A contest win in each of the 4 divisions (as you grow)',
      ru: 'Победа в конкурсе в каждом из 4 дивизионов (по мере роста)',
    },
    rewardTitle: 'Rose Through the Ranks',
  },

  // §3.5.4 Кооп и стрит (8)
  {
    key: 'ach_first_coop_order',
    category: COOP_AND_STREET,
    condition: { en: 'First Co-op Order contribution', ru: 'Первый вклад в Co-op Orders' },
    rewardTitle: 'Team Player',
  },
  {
    key: 'ach_50_coop_orders',
    category: COOP_AND_STREET,
    condition: { en: '50 Co-op Order contributions', ru: '50 вкладов в Co-op Orders' },
    rewardTitle: "Street's Backbone",
  },
  {
    key: 'ach_first_potluck',
    category: COOP_AND_STREET,
    condition: { en: 'First Street Potluck contribution', ru: 'Первый вклад в Street Potluck' },
    rewardTitle: 'Potluck Regular',
  },
  {
    key: 'ach_gift_10_neighbors',
    category: COOP_AND_STREET,
    condition: { en: 'Gifted surplus to neighbors 10 times (E3)', ru: 'Подарено 10 раз излишков соседям (E3)' },
    rewardTitle: 'Good Neighbor',
  },
  {
    key: 'ach_mentor_first',
    category: COOP_AND_STREET,
    condition: { en: 'First time mentoring a newcomer', ru: 'Первое менторство новичка' },
    rewardTitle: 'Mentor',
  },
  {
    key: 'ach_mentor_10',
    category: COOP_AND_STREET,
    condition: { en: '10 mentees brought to Grand Opening', ru: '10 подопечных доведены до Grand Opening' },
    rewardTitle: "Old Man Whittaker's Pride",
  },
  {
    key: 'ach_street_caravan',
    category: COOP_AND_STREET,
    condition: { en: 'Participated in a Street Caravan', ru: 'Участие в Street Caravan' },
    rewardTitle: 'On the Move',
  },
  {
    key: 'ach_town_merge_survivor',
    category: COOP_AND_STREET,
    condition: { en: 'Survived a Town Merge', ru: 'Пережил Town Merge' },
    rewardTitle: 'Grand Reopening',
  },

  // §3.5.5 Экспедиции и открытки (8)
  {
    key: 'ach_first_expedition',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'First completed expedition', ru: 'Первая завершённая экспедиция' },
    rewardTitle: 'Hit the Road',
  },
  {
    key: 'ach_all_wave1_states',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'All 8 wave-1 states unlocked', ru: 'Все 8 штатов волны 1 открыты' },
    rewardTitle: 'Route 66 Veteran',
  },
  {
    key: 'ach_full_postcard_album',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'Full wave-1 postcard album', ru: 'Полный альбом открыток волны 1' },
    rewardTitle: 'Well-Traveled',
  },
  {
    key: 'ach_100_expeditions',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: '100 completed expeditions', ru: '100 завершённых экспедиций' },
    rewardTitle: 'Road Warrior',
  },
  {
    key: 'ach_first_foraging',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'First foraging', ru: 'Первый фуражинг' },
    rewardTitle: 'Forager',
  },
  {
    key: 'ach_mail_catalog_first',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'First mail-order catalog order', ru: 'Первый заказ по каталогу почтой' },
    // Спека помечает это название как рабочее, требующее нарратив-ревью — оставляем дословно.
    rewardTitle: 'Mail Order Bride... of Farming (working title, needs narrative review)',
  },
  {
    key: 'ach_gus_max_level',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: { en: 'Mechanic Gus (staff_gus) leveled to max', ru: 'Механик Гас (staff_gus) прокачан до максимума' },
    rewardTitle: 'Pit Crew',
  },
  {
    key: 'ach_buck_max_level',
    category: EXPEDITIONS_AND_POSTCARDS,
    condition: {
      en: 'Trucker Buck (staff_buck) leveled to max',
      ru: 'Дальнобойщик Бак (staff_buck) прокачан до максимума',
    },
    rewardTitle: 'King of the Road',
  },

  // §3.5.6 Стрик и завсегдатаи (6)
  {
    key: 'ach_streak_7',
    category: STREAK_AND_REGULARS,
    condition: { en: '7-day streak (mech_regular_streak)', ru: 'Стрик 7 дней (mech_regular_streak)' },
    rewardTitle: 'Regular',
  },
  {
    key: 'ach_streak_30',
    category: STREAK_AND_REGULARS,
    condition: { en: '30-day streak', ru: 'Стрик 30 дней' },
    rewardTitle: 'Fixture',
  },
  {
    key: 'ach_streak_100',
    category: STREAK_AND_REGULARS,
    condition: { en: '100-day streak', ru: 'Стрик 100 дней' },
    rewardTitle: 'Sunnyside Institution',
  },
  {
    key: 'ach_streak_365',
    category: STREAK_AND_REGULARS,
    condition: { en: '365-day streak', ru: 'Стрик 365 дней' },
    rewardTitle: 'Founding Family',
  },
  {
    key: 'ach_streak_recovered_5',
    category: STREAK_AND_REGULARS,
    condition: {
      en: 'Streak recovered from a freeze 5 times (no reset, E2)',
      ru: '5 раз восстановлен стрик после заморозки (без обнуления, E2)',
    },
    rewardTitle: 'Never Really Left',
  },
  {
    key: 'ach_gone_fishin_return',
    category: STREAK_AND_REGULARS,
    condition: { en: 'Returned from Vacation Mode', ru: 'Вернулся из Vacation Mode' },
    rewardTitle: "Gone Fishin', Back Now",
  },

  // §3.5.7 Коллекции и косметика (7)
  {
    key: 'ach_first_toy',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'First toy from the Prize Machine', ru: 'Первая игрушка из Prize Machine' },
    rewardTitle: 'Capsule Debut',
  },
  {
    key: 'ach_complete_toy_series',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'One complete toy series collected', ru: 'Собрана 1 полная серия игрушек' },
    rewardTitle: 'Series Complete',
  },
  {
    key: 'ach_all_toy_series',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'All 5 toy series collected', ru: 'Собраны все 5 серий' },
    rewardTitle: 'Shelf Life Achievement',
  },
  {
    key: 'ach_first_neon',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'First sign assembled in Neon Builder', ru: 'Собрана первая вывеска в Neon Builder' },
    rewardTitle: 'Lights On',
  },
  {
    key: 'ach_full_decor_slots',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'All decor slots filled', ru: 'Все A-слоты декора заполнены' },
    rewardTitle: 'House Proud',
  },
  {
    key: 'ach_cosmetic_set_complete',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: 'A full cosmetic set (cos_*) collected', ru: 'Собран полный косметик-сет (cos_*)' },
    rewardTitle: 'Themed Out',
  },
  {
    key: 'ach_100_photos',
    category: COLLECTIONS_AND_COSMETICS,
    condition: { en: '100 photos taken in Kodachrome', ru: 'Сделано 100 фото в Kodachrome' },
    rewardTitle: 'Shutterbug',
  },

  // §3.5.8 Общегородские и особые (4)
  {
    key: 'ach_first_event_milestone',
    category: TOWN_AND_SPECIAL,
    condition: {
      en: 'First personal event milestone reached (canon §3.5)',
      ru: 'Достигнута первая личная веха ивента (§3.5 канона)',
    },
    rewardTitle: 'Answered the Call',
  },
  {
    key: 'ach_town_project_contributor',
    category: TOWN_AND_SPECIAL,
    condition: { en: 'Contributed to at least 1 Town Project', ru: 'Внёс вклад хотя бы в 1 Town Project' },
    rewardTitle: 'Civic Pride',
  },
  {
    key: 'ach_all_town_projects',
    category: TOWN_AND_SPECIAL,
    condition: { en: 'Contributed to all 6 Town Projects', ru: 'Внёс вклад во все 6 Town Projects' },
    rewardTitle: 'Pillar of the Community',
  },
  {
    key: 'ach_fair_patron',
    category: TOWN_AND_SPECIAL,
    condition: { en: 'Fair Patron status attained (E10)', ru: 'Получен статус Fair Patron (E10)' },
    // Спека: «особая табличка с позолотой, некупленная напрямую» — не отдельное
    // поле схемы (AchievementSchema не имеет qualifier "gilded"), фиксируем в rewardTitle дословно.
    rewardTitle: 'Fair Patron (special gilded plaque, not directly purchasable)',
  },
]
