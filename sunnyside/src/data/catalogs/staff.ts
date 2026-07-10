/**
 * data/catalogs/staff.ts — контент-каталог 12 архетипов стаффа (канон §3.2,
 * `docs/specs/13-progression.md §3.1.1`).
 *
 * Владелец: staff-knowhow-buildings контент-агент (см. AGENTS.md §2 — карта владения).
 * Схема — `StaffDefSchema` (`../schema.ts`), проверяется `../validate.test.ts`.
 *
 * ГРАНИЦА: ноль three/scene/net — чистые данные (AGENTS.md §3).
 *
 * Числа — ИЗ СПЕКИ (13-progression.md §3.1.1/§3.1.4), помеченные там как
 * (гипотеза) до калибровки в `14-economy.md`:
 *  - `maxLevel = 5` для всех (§3.1.2 — 5 уровней на персонажа).
 *  - `hireCostBucks = 0` для всех: найм — ТОЛЬКО детерминированные неденежные
 *    каналы (сюжет / Farm Level гейт / штаты-экспедиции / ивенты, §3.1.4) —
 *    ни один персонаж не заперт за прямой покупкой (D11, канон §4).
 *  - `skillDescription` — базовый навык на Ур.1 (×1.00), до масштабирования
 *    по уровню (§3.1.2: ×1.00/1.25/1.50/1.75/2.00) — множители и вторичные
 *    перки Ур.3 не входят в `StaffDefSchema` (контент верхнего уровня же
 *    считает система прогрессии, не этот каталог).
 *
 * Порядок записей = порядок `STAFF_KEYS` (`@/types/progression.ts`) = порядок
 * ростера в спеке (Kitchen 3 · Counter 3 · Field 2 · Yard 4).
 */

import type { StaffDef } from '../schema'

export const staff: StaffDef[] = [
  // ── Kitchen (3) ──────────────────────────────────────────────────────────
  {
    key: 'staff_bruno',
    name: { en: 'Chef Bruno', ru: 'Шеф Бруно' },
    post: 'Kitchen',
    skillDescription: { en: '-10% cooking time', ru: '−10% время готовки' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_rosalind',
    name: { en: 'Pastry Chef Rosalind', ru: 'Кондитер Розалинд' },
    post: 'Kitchen',
    skillDescription: { en: '+1★ pastry mastery gain', ru: '+1★ прирост mastery выпечки' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_marty',
    name: { en: 'Grill Master Marty', ru: 'Гриль-мастер Марти' },
    post: 'Kitchen',
    skillDescription: { en: '+1 to grill batch size', ru: '+1 к размеру партии гриля' },
    maxLevel: 5,
    hireCostBucks: 0,
  },

  // ── Counter (3) ──────────────────────────────────────────────────────────
  {
    key: 'staff_peggy',
    name: { en: 'Carhop Peggy', ru: 'Кархоп Пегги' },
    post: 'Counter',
    skillDescription: { en: '+15% tips', ru: '+15% чаевые' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_dizzy',
    name: { en: 'Soda Jerk Dizzy', ru: 'Содовщик Диззи' },
    post: 'Counter',
    skillDescription: { en: '+20% shake/soda value', ru: '+20% ценность шейков/содовой' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_lorraine',
    name: { en: 'Hostess Lorraine', ru: 'Хостес Лоррейн' },
    post: 'Counter',
    skillDescription: {
      en: '+guests / faster fair queue seating',
      ru: '+посетители / быстрее очередь ярмарки',
    },
    maxLevel: 5,
    hireCostBucks: 0,
  },

  // ── Field (2) ────────────────────────────────────────────────────────────
  {
    key: 'staff_hank',
    name: { en: 'Farmhand Hank', ru: 'Работник Хэнк' },
    post: 'Field',
    skillDescription: { en: 'auto-waters 4 plots', ru: 'авто-полив 4 грядок' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_clara',
    name: { en: 'Dairymaid Clara', ru: 'Скотница Клара' },
    post: 'Field',
    skillDescription: { en: '-animal feeding cycle time', ru: '−цикл кормления животных' },
    maxLevel: 5,
    hireCostBucks: 0,
  },

  // ── Yard (4) ─────────────────────────────────────────────────────────────
  {
    key: 'staff_ada',
    name: { en: 'Bookkeeper Ada', ru: 'Бухгалтер Ада' },
    post: 'Yard',
    skillDescription: { en: '+5% Bucks from sales', ru: '+5% Bucks с продаж' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_gus',
    name: { en: 'Mechanic Gus', ru: 'Механик Гас' },
    post: 'Yard',
    skillDescription: { en: '-15% expedition time', ru: '−15% время экспедиции' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_buck',
    name: { en: 'Trucker Buck', ru: 'Дальнобойщик Бак' },
    post: 'Yard',
    skillDescription: { en: '+1 expedition route slot', ru: '+1 слот маршрута экспедиции' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
  {
    key: 'staff_vernon',
    name: { en: 'Handyman Vernon', ru: 'Мастер Вернон' },
    post: 'Yard',
    skillDescription: { en: '-building construction time', ru: '−время постройки' },
    maxLevel: 5,
    hireCostBucks: 0,
  },
]
