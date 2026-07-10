/**
 * catalogs/passTracks.ts — контент Route Pass (`ui_route_pass`, сезонный пропуск).
 *
 * Источник цифр: `docs/specs/15-monetization.md` §3.1 (Route Pass).
 *  - Длина сезона / уровней: 8 недель, **50 уровней** (§3.1.1).
 *  - Порог уровня: **200 Miles = +1 уровень**, 50×200 = 10,000 Miles/сезон (§3.1.3) —
 *    отсюда `xpRequired = tier * 200` (кумулятивно, не за уровень).
 *  - Тема сезона (пример из спеки, дек стр. 187): «Summer-55 / Лето-55».
 *  - Наполнение треков — таблица §3.1.2 даёт **только каждый 5-й уровень**
 *    (1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50) с конкретными наградами; для
 *    остальных 39 уровней спека НЕ приводит конкретный контент (только
 *    агрегаты: «Free-трек ≈ 30–35% ценности», «на платном треке — 0 предметов
 *    силы», совокупный `◉`-возврат платного трека — 190). Числа туда не
 *    выдумываем (AGENTS.md §0.7/задание) — эти 39 уровней оставлены БЕЗ
 *    `freeReward`/`premiumReward` (оба поля опциональны в `PassTierSchema`):
 *    честная запись «уровень существует, содержимое спекой не зафиксировано»,
 *    а не выдуманный филлер. Тот же подход уже принят в `townProjects.ts` для
 *    неуказанных `goalResources`.
 *  - `PassTierSchema.freeReward`/`premiumReward` — ровно ОДИН `Reward` на трек
 *    на уровень (не массив). Там, где §3.1.2 описывает комбо-награду
 *    («скин + `◉` N»), в каталог попадает ведущий (наиболее статусный) предмет
 *    награды — второй компонент комбо не теряется бесследно, а зафиксирован
 *    комментарием у записи (для будущего расширения `RewardSchema` до массива,
 *    если/когда контракт `schema.ts` будет пересмотрен архитектурой).
 *  - `season`/`name` — season 1, тема "Summer-55" (§3.1.1, дек стр. 187, пример).
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net, только структуры данных +
 * типы `@/data/schema`. Владелец — контент-агент pass-specials.
 */

import type { PassTrack } from '../schema'

const MILES_PER_LEVEL = 200 // 15-monetization.md §3.1.3: "200 Miles = +1 уровень"

export const passTracks: PassTrack[] = [
  {
    season: 1,
    name: { en: 'Summer-55', ru: 'Лето-55' },
    tiers: [
      {
        tier: 1,
        xpRequired: 1 * MILES_PER_LEVEL,
        freeReward: { kind: 'currency', currency: 'tickets', qty: 5 },
        // §3.1.2: "Скин-вывеска «Season Neon» (эксклюзив сезона)".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_neon_sign' },
      },
      { tier: 2, xpRequired: 2 * MILES_PER_LEVEL },
      { tier: 3, xpRequired: 3 * MILES_PER_LEVEL },
      { tier: 4, xpRequired: 4 * MILES_PER_LEVEL },
      {
        tier: 5,
        xpRequired: 5 * MILES_PER_LEVEL,
        // §3.1.2 (веха): "Декор-предмет: столик-дайнер".
        freeReward: { kind: 'item', itemKey: 'decor_diner_table', qty: 1 },
        // §3.1.2 (веха): "Скин грузовика (тема сезона)".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_truck_skin' },
      },
      { tier: 6, xpRequired: 6 * MILES_PER_LEVEL },
      { tier: 7, xpRequired: 7 * MILES_PER_LEVEL },
      { tier: 8, xpRequired: 8 * MILES_PER_LEVEL },
      { tier: 9, xpRequired: 9 * MILES_PER_LEVEL },
      {
        tier: 10,
        xpRequired: 10 * MILES_PER_LEVEL,
        // §3.1.2 (веха): "◉ 40 (возврат)".
        freeReward: { kind: 'currency', currency: 'dimes', qty: 40 },
        // §3.1.2 (веха): "Скин стаффа (форма официантки темы) + ◉ 40" — ведущий
        // предмет награды взят скином; ◉40 этой строки учтён в совокупном
        // возврате платного трека (см. итог 190 в §3.1.2, не теряем число).
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_staff_uniform' },
      },
      {
        tier: 11,
        xpRequired: 11 * MILES_PER_LEVEL,
      },
      { tier: 12, xpRequired: 12 * MILES_PER_LEVEL },
      { tier: 13, xpRequired: 13 * MILES_PER_LEVEL },
      { tier: 14, xpRequired: 14 * MILES_PER_LEVEL },
      {
        tier: 15,
        xpRequired: 15 * MILES_PER_LEVEL,
        // §3.1.2: "Расходник: 3× удобрение".
        freeReward: { kind: 'item', itemKey: 'mat_fertilizer', qty: 3 },
        // §3.1.2: "Prize Machine токен ×2" (разовое право на пулл, не под-валюта).
        premiumReward: { kind: 'item', itemKey: 'token_prize_machine', qty: 2 },
      },
      { tier: 16, xpRequired: 16 * MILES_PER_LEVEL },
      { tier: 17, xpRequired: 17 * MILES_PER_LEVEL },
      { tier: 18, xpRequired: 18 * MILES_PER_LEVEL },
      { tier: 19, xpRequired: 19 * MILES_PER_LEVEL },
      {
        tier: 20,
        xpRequired: 20 * MILES_PER_LEVEL,
        // §3.1.2 (веха): "Рамка профиля (не-Ribbon)".
        freeReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_profile_frame' },
        // §3.1.2 (веха): "Эксклюзив-набор Neon Builder (буквы темы)".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_neon_letters' },
      },
      { tier: 21, xpRequired: 21 * MILES_PER_LEVEL },
      { tier: 22, xpRequired: 22 * MILES_PER_LEVEL },
      { tier: 23, xpRequired: 23 * MILES_PER_LEVEL },
      { tier: 24, xpRequired: 24 * MILES_PER_LEVEL },
      {
        tier: 25,
        xpRequired: 25 * MILES_PER_LEVEL,
        // §3.1.2: "🎟 15".
        freeReward: { kind: 'currency', currency: 'tickets', qty: 15 },
        // §3.1.2: "Скин интерьера: чекерборд-пол темы".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_checker_floor' },
      },
      { tier: 26, xpRequired: 26 * MILES_PER_LEVEL },
      { tier: 27, xpRequired: 27 * MILES_PER_LEVEL },
      { tier: 28, xpRequired: 28 * MILES_PER_LEVEL },
      { tier: 29, xpRequired: 29 * MILES_PER_LEVEL },
      {
        tier: 30,
        xpRequired: 30 * MILES_PER_LEVEL,
        // §3.1.2 (веха): "Декор: джукбокс".
        freeReward: { kind: 'item', itemKey: 'decor_jukebox', qty: 1 },
        // §3.1.2 (веха): "Скин дайнера (фасад темы) — центральный приз".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_diner_facade' },
      },
      { tier: 31, xpRequired: 31 * MILES_PER_LEVEL },
      { tier: 32, xpRequired: 32 * MILES_PER_LEVEL },
      { tier: 33, xpRequired: 33 * MILES_PER_LEVEL },
      { tier: 34, xpRequired: 34 * MILES_PER_LEVEL },
      {
        tier: 35,
        xpRequired: 35 * MILES_PER_LEVEL,
        // §3.1.2: "5× удобрение".
        freeReward: { kind: 'item', itemKey: 'mat_fertilizer', qty: 5 },
        // §3.1.2: "◉ 60 (возврат) + 2× контракт грузовика" — ведущий предмет
        // награды взят валютой (крупнейший разовый возврат трека); контракты
        // грузовика (`bst_truck_contract`, 15-monetization.md §3.7) — второй
        // компонент комбо, не теряется бесследно (см. комментарий у tier 10).
        premiumReward: { kind: 'currency', currency: 'dimes', qty: 60 },
      },
      { tier: 36, xpRequired: 36 * MILES_PER_LEVEL },
      { tier: 37, xpRequired: 37 * MILES_PER_LEVEL },
      { tier: 38, xpRequired: 38 * MILES_PER_LEVEL },
      { tier: 39, xpRequired: 39 * MILES_PER_LEVEL },
      {
        tier: 40,
        xpRequired: 40 * MILES_PER_LEVEL,
        // §3.1.2 (веха): "Фото-рамка Kodachrome темы".
        freeReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_kodachrome_frame' },
        // §3.1.2 (веха): "Питомец-талисман дайнера (косметический маскот)".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_mascot_pet' },
      },
      { tier: 41, xpRequired: 41 * MILES_PER_LEVEL },
      { tier: 42, xpRequired: 42 * MILES_PER_LEVEL },
      { tier: 43, xpRequired: 43 * MILES_PER_LEVEL },
      { tier: 44, xpRequired: 44 * MILES_PER_LEVEL },
      {
        tier: 45,
        xpRequired: 45 * MILES_PER_LEVEL,
        // §3.1.2: "🎟 20".
        freeReward: { kind: 'currency', currency: 'tickets', qty: 20 },
        // §3.1.2: "Скин-хот-род грузовика (chase-скин сезона)".
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_hotrod_truck' },
      },
      { tier: 46, xpRequired: 46 * MILES_PER_LEVEL },
      { tier: 47, xpRequired: 47 * MILES_PER_LEVEL },
      { tier: 48, xpRequired: 48 * MILES_PER_LEVEL },
      { tier: 49, xpRequired: 49 * MILES_PER_LEVEL },
      {
        tier: 50,
        xpRequired: 50 * MILES_PER_LEVEL,
        // §3.1.2 (финал): "Значок «Season Veteran» + ◉ 50" — ведущий предмет
        // взят валютой (значок — косметический титул без отдельного ключа сета
        // в @/types на момент написания, второй компонент комбо).
        freeReward: { kind: 'currency', currency: 'dimes', qty: 50 },
        // §3.1.2 (финал): "Prestige-скин дайнера «Golden Booth» + рамка Fair
        // Patron сезона" — ведущий предмет взят prestige-скином.
        premiumReward: { kind: 'cosmetic', cosmeticKey: 'cos_season_golden_booth' },
      },
    ],
  },
]
