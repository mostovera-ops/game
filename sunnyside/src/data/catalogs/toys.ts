/**
 * catalogs/toys.ts — контент-каталог фигурок Prize Machine (`ui_prize_machine`,
 * 15-monetization.md §3.3.1/§3.3.2, 17-collections.md §3.4).
 *
 * 5 серий (canon §3.10, `@/types/collections.ts` TOY_SERIES_KEYS) × 8 фигурок
 * (4 Common · 2 Uncommon · 1 Rare · 1 Chase) = 40 записей. Дроп-шансы и
 * скрап-выход дубля — числа per-rarity, не per-toy (живут в econ-слое Prize
 * Machine, не здесь; см. 15-monetization.md §3.3.2 для мастер-таблицы).
 *
 * Ключ — `toy_<series-без-toy_>_<nn>` (регекс `ToyDefSchema`:
 * `^toy_[a-z0-9]+(_[a-z0-9]+)+$`), `_nn` — порядковый номер в серии (01–08),
 * без привязки к редкости (используется только для уникальности/сортировки
 * витрины Toy Shelf).
 *
 * Chase-имена — из спеки дословно (15-monetization.md §3.3.1 таблица);
 * Common/Uncommon/Rare-имена внутри серии — тематическое наполнение
 * (спека фиксирует только счётчик по редкости, не конкретные имена).
 */

import type { ToyDef } from '../schema'

export const toys: ToyDef[] = [
  // ── toy_highway_dinos (Динозавры шоссе) ──────────────────────────────────
  {
    key: 'toy_highway_dinos_01',
    series: 'toy_highway_dinos',
    name: { en: 'Pebble Compsognathus', ru: 'Компсогнат-Камешек' },
    rarity: 'common',
  },
  {
    key: 'toy_highway_dinos_02',
    series: 'toy_highway_dinos',
    name: { en: 'Sunset Stegosaurus', ru: 'Стегозавр Закат' },
    rarity: 'common',
  },
  {
    key: 'toy_highway_dinos_03',
    series: 'toy_highway_dinos',
    name: { en: 'Roadrunner Raptor', ru: 'Раптор-Бегун' },
    rarity: 'common',
  },
  {
    key: 'toy_highway_dinos_04',
    series: 'toy_highway_dinos',
    name: { en: 'Diner Triceratops', ru: 'Трицератопс-Дайнер' },
    rarity: 'common',
  },
  {
    key: 'toy_highway_dinos_05',
    series: 'toy_highway_dinos',
    name: { en: 'Chrome Brontosaurus', ru: 'Хромовый Бронтозавр' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_highway_dinos_06',
    series: 'toy_highway_dinos',
    name: { en: 'Route Pterodactyl', ru: 'Птеродактиль Трассы' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_highway_dinos_07',
    series: 'toy_highway_dinos',
    name: { en: 'Turquoise Ankylosaurus', ru: 'Бирюзовый Анкилозавр' },
    rarity: 'rare',
  },
  {
    key: 'toy_highway_dinos_08',
    series: 'toy_highway_dinos',
    name: { en: 'Neon T-Rex', ru: 'Неоновый Ти-Рекс' },
    rarity: 'chase',
  },

  // ── toy_cosmos_57 (Космос-57) ─────────────────────────────────────────────
  {
    key: 'toy_cosmos_57_01',
    series: 'toy_cosmos_57',
    name: { en: 'Starlight Rocket', ru: 'Ракета «Звёздный свет»' },
    rarity: 'common',
  },
  {
    key: 'toy_cosmos_57_02',
    series: 'toy_cosmos_57',
    name: { en: 'Orbit Capsule', ru: 'Орбитальная капсула' },
    rarity: 'common',
  },
  {
    key: 'toy_cosmos_57_03',
    series: 'toy_cosmos_57',
    name: { en: 'Comet Buggy', ru: 'Багги «Комета»' },
    rarity: 'common',
  },
  {
    key: 'toy_cosmos_57_04',
    series: 'toy_cosmos_57',
    name: { en: 'Lunar Rover', ru: 'Лунный вездеход' },
    rarity: 'common',
  },
  {
    key: 'toy_cosmos_57_05',
    series: 'toy_cosmos_57',
    name: { en: 'Nebula Probe', ru: 'Зонд «Туманность»' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_cosmos_57_06',
    series: 'toy_cosmos_57',
    name: { en: 'Solar Sailor', ru: 'Солнечный парусник' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_cosmos_57_07',
    series: 'toy_cosmos_57',
    name: { en: 'Meteor Shuttle', ru: 'Шаттл «Метеор»' },
    rarity: 'rare',
  },
  {
    key: 'toy_cosmos_57_08',
    series: 'toy_cosmos_57',
    name: { en: 'Chrome Satellite', ru: 'Хромовый спутник' },
    rarity: 'chase',
  },

  // ── toy_route_critters (Зверьки шоссе) ───────────────────────────────────
  {
    key: 'toy_route_critters_01',
    series: 'toy_route_critters',
    name: { en: 'Highway Raccoon', ru: 'Енот с шоссе' },
    rarity: 'common',
  },
  {
    key: 'toy_route_critters_02',
    series: 'toy_route_critters',
    name: { en: 'Desert Roadrunner', ru: 'Пустынный бегунок' },
    rarity: 'common',
  },
  {
    key: 'toy_route_critters_03',
    series: 'toy_route_critters',
    name: { en: 'Prairie Dog Trucker', ru: 'Луговая собачка-дальнобойщик' },
    rarity: 'common',
  },
  {
    key: 'toy_route_critters_04',
    series: 'toy_route_critters',
    name: { en: 'Armadillo Cruiser', ru: 'Броненосец-круизёр' },
    rarity: 'common',
  },
  {
    key: 'toy_route_critters_05',
    series: 'toy_route_critters',
    name: { en: 'Coyote Hitchhiker', ru: 'Койот-автостопщик' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_route_critters_06',
    series: 'toy_route_critters',
    name: { en: 'Bobcat Biker', ru: 'Рысь-байкер' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_route_critters_07',
    series: 'toy_route_critters',
    name: { en: 'Silver Fox Rider', ru: 'Серебристый лис-наездник' },
    rarity: 'rare',
  },
  {
    key: 'toy_route_critters_08',
    series: 'toy_route_critters',
    name: { en: 'Golden Jackalope', ru: 'Золотой джекалоп' },
    rarity: 'chase',
  },

  // ── toy_chrome_rockets (Хромовые ракеты) ─────────────────────────────────
  {
    key: 'toy_chrome_rockets_01',
    series: 'toy_chrome_rockets',
    name: { en: 'Streamline Rocket', ru: 'Ракета «Стримлайн»' },
    rarity: 'common',
  },
  {
    key: 'toy_chrome_rockets_02',
    series: 'toy_chrome_rockets',
    name: { en: 'Tailfin Rocket', ru: 'Ракета с килем-плавником' },
    rarity: 'common',
  },
  {
    key: 'toy_chrome_rockets_03',
    series: 'toy_chrome_rockets',
    name: { en: 'Bullet Rocket', ru: 'Ракета-пуля' },
    rarity: 'common',
  },
  {
    key: 'toy_chrome_rockets_04',
    series: 'toy_chrome_rockets',
    name: { en: 'Rivet Rocket', ru: 'Ракета-заклёпка' },
    rarity: 'common',
  },
  {
    key: 'toy_chrome_rockets_05',
    series: 'toy_chrome_rockets',
    name: { en: 'Afterburner Rocket', ru: 'Ракета с форсажем' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_chrome_rockets_06',
    series: 'toy_chrome_rockets',
    name: { en: 'Countdown Rocket', ru: 'Ракета «Обратный отсчёт»' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_chrome_rockets_07',
    series: 'toy_chrome_rockets',
    name: { en: 'Platinum Rocket', ru: 'Платиновая ракета' },
    rarity: 'rare',
  },
  {
    key: 'toy_chrome_rockets_08',
    series: 'toy_chrome_rockets',
    name: { en: 'Sunburst Rocket', ru: 'Ракета «Солнечный всплеск»' },
    rarity: 'chase',
  },

  // ── toy_diner_mascots (Талисманы дайнера) ────────────────────────────────
  {
    key: 'toy_diner_mascots_01',
    series: 'toy_diner_mascots',
    name: { en: 'Burger Buddy', ru: 'Дружище Бургер' },
    rarity: 'common',
  },
  {
    key: 'toy_diner_mascots_02',
    series: 'toy_diner_mascots',
    name: { en: 'Milkshake Pal', ru: 'Приятель Молочный Коктейль' },
    rarity: 'common',
  },
  {
    key: 'toy_diner_mascots_03',
    series: 'toy_diner_mascots',
    name: { en: 'Fry Guy', ru: 'Парень-Картошка Фри' },
    rarity: 'common',
  },
  {
    key: 'toy_diner_mascots_04',
    series: 'toy_diner_mascots',
    name: { en: 'Soda Pop Sam', ru: 'Сэм Газировка' },
    rarity: 'common',
  },
  {
    key: 'toy_diner_mascots_05',
    series: 'toy_diner_mascots',
    name: { en: 'Pie Slice Patty', ru: 'Пэтти-Кусок Пирога' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_diner_mascots_06',
    series: 'toy_diner_mascots',
    name: { en: 'Waffle Wendell', ru: 'Уэнделл Вафля' },
    rarity: 'uncommon',
  },
  {
    key: 'toy_diner_mascots_07',
    series: 'toy_diner_mascots',
    name: { en: 'Neon Sundae Sue', ru: 'Сью Неоновый Сандей' },
    rarity: 'rare',
  },
  {
    key: 'toy_diner_mascots_08',
    series: 'toy_diner_mascots',
    name: { en: 'Glow Burger Buddy', ru: 'Светящийся Дружище Бургер' },
    rarity: 'chase',
  },
]
