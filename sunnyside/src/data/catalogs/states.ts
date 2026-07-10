/**
 * catalogs/states.ts — контент-каталог штатов роуд-трипа (07-expeditions §3.1).
 *
 * Волна 1 (canon §3.4, MVP) — 8 стопов, Дом → Калифорния. Только эти ключи
 * зафиксированы каноном (`@/types/expeditions.ts` STATE_KEYS/StateKeySchema);
 * волны 2–3 — нейминг-кандидаты 07-expeditions §3.1 (O4), не в каноне —
 * не включаются в каталог до PR в `00-canon.md` §3.4 (см. AGENTS.md §7:
 * «новый ключ сущности — через PR к canon, не выдумывается»).
 *
 * `routeSlot` = порядковый индекс лестницы роуд-трипа (0 = st_home), из
 * таблицы §3.1; используется формулой длительности (§4.1, дистанция «усл.»).
 * `highlights` — хайлайт-продукты стопа (§3.1/§4.2, топ-строка лут-таблицы
 * форсится к 100% — см. `04-machines.md`/`06-recipes.md` для полного реестра
 * продуктов; здесь только ключи, сами `Ingredient`-записи живут в `ingredients.ts`).
 *
 * `highlights` УНИФИЦИРОВАНЫ под реальные ключи `ingredients.ts` (были писавшиеся
 * параллельным агентом плейсхолдеры `prod_*`, которых нет в каталоге ингредиентов:
 * `prod_egg`→`egg`, `prod_milk`→`milk`, `prod_beef_trim`→`crop_beef`,
 * `prod_coffee_beans_green`→`crop_green_coffee_beans`, `prod_honey`→`honey`,
 * `prod_pecan`→`crop_pecan`, `prod_peach`→`crop_georgia_peach`,
 * `prod_peach_jam_base`→`ingr_peach_cobbler_filling`, `prod_gulf_shrimp`→`crop_gulf_shrimp`,
 * `prod_cajun_spice`→`ingr_cajun_spice_blend`, `prod_brisket_raw`→`crop_beef_brisket`,
 * `prod_bbq_sauce_base`→`ingr_bbq_sauce`, `prod_lobster`→`crop_maine_lobster`,
 * `prod_maple_syrup_deluxe`→`ingr_maple_syrup`, `prod_citrus`→`crop_california_navel_orange`,
 * `prod_vanilla`→`crop_california_vanilla_bean`). Ссылочная проверка StateContent→Ingredient
 * добавлена в `validate.test.ts`, чтобы рассинхрон ловился автоматически.
 */

import type { StateContent } from '../schema'

export const states: StateContent[] = [
  {
    key: 'st_home',
    name: { en: 'Home County', ru: 'Родной округ' },
    tier: 1,
    highlights: ['egg', 'milk'],
    routeSlot: 0,
  },
  {
    key: 'st_illinois',
    name: { en: 'Illinois / Chicago', ru: 'Иллинойс / Чикаго' },
    tier: 3,
    highlights: ['crop_beef', 'crop_green_coffee_beans'],
    routeSlot: 1,
  },
  {
    key: 'st_tennessee',
    name: { en: 'Tennessee / Nashville', ru: 'Теннесси / Нэшвилл' },
    tier: 3,
    highlights: ['honey', 'crop_pecan'],
    routeSlot: 2,
  },
  {
    key: 'st_georgia',
    name: { en: 'Georgia', ru: 'Джорджия' },
    tier: 4,
    highlights: ['crop_georgia_peach', 'ingr_peach_cobbler_filling'],
    routeSlot: 3,
  },
  {
    key: 'st_louisiana',
    name: { en: 'Louisiana / New Orleans', ru: 'Луизиана / Новый Орлеан' },
    tier: 4,
    highlights: ['crop_gulf_shrimp', 'ingr_cajun_spice_blend'],
    routeSlot: 4,
  },
  {
    key: 'st_texas',
    name: { en: 'Texas', ru: 'Техас' },
    tier: 4,
    highlights: ['crop_beef_brisket', 'ingr_bbq_sauce'],
    routeSlot: 5,
  },
  {
    key: 'st_maine',
    name: { en: 'Maine', ru: 'Мэн' },
    tier: 5,
    highlights: ['crop_maine_lobster', 'ingr_maple_syrup'],
    routeSlot: 6,
  },
  {
    key: 'st_california',
    name: { en: 'California', ru: 'Калифорния' },
    tier: 5,
    highlights: ['crop_california_navel_orange', 'crop_california_vanilla_bean'],
    routeSlot: 7,
  },
]
