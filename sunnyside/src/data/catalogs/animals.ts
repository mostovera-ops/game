/**
 * data/catalogs/animals.ts — контент-каталог видов животных (docs/specs/03-animals.md).
 *
 * Владелец: контент-агент «animals» (AGENTS.md §2, зона `src/data/catalogs/**`).
 * Схема/валидация — `../schema.ts` (`AnimalDefSchema`, `CONTENT_CATALOGS`), НЕ трогать
 * отсюда. Ссылочная целостность (`productKey` → Ingredient) проверяется в
 * `../validate.test.ts` (тест сам скипается, пока не появится `catalogs/ingredients.ts`).
 *
 * Числа — ИЗ СПЕКИ (03-animals.md, прошла ревью Фазы B), не придуманы:
 * - §3.1 / §3.1.1 (виды, жильё, тир продукта, гейты разблокировки),
 * - §3.2 / §4.1 (циклы кормления и базовые продукты),
 * - §4.1 (сводная таблица: тир, цикл, слот-жильё).
 *
 * unlockLevel — «уровень фермы» из §3.1/§3.1.1 (housing-гейт эквивалентен
 * `house_level`, `13-progression.md §3.3.1`, см. преамбулу §3.1 спеки):
 * Hen — старт (1), Dairy Cow — Barn Ур.1 ≈ 3, Pig — Barn Ур.2 ≈ 5,
 * Bee Hive — Apiary Ур.1 ≈ 6, Dairy Goat — Barn Ур.3 ≈ 10.
 *
 * assetKey — канон-кандидат ключа вида из §3.1 спеки (`an_hen`/`an_cow`/...),
 * для `src/assets/placeholders/registry.ts` (арт/сцен-агент, вне моей зоны — только ключ-подсказка).
 *
 * ── ВАЖНО: расхождение контракт vs. спека (не в моей зоне, только TODO) ─────────
 * `AnimalKindSchema` (../schema.ts) и `AnimalKind` (@/types/animals.ts) — закрытый
 * enum `chicken | cow | pig | goat | sheep | bee`. Спека 03-animals.md (§3.1)
 * описывает 6 видов как `an_hen(chicken) | an_cow | an_pig | an_bee | an_goat |
 * an_turkey` — т.е. **turkey**, а не **sheep**. `sheep` нигде в спеках (docs/specs/)
 * не встречается — данных для него нет, придумывать по AGENTS.md запрещено;
 * `turkey` в закрытый enum не входит (и у него по спеке §3.1/§3.4 двойной гейт —
 * уровень жилья И ивент `ev_harvest_homecoming`, — под который в `AnimalDefSchema`
 * нет отдельного поля, только `unlockLevel`). Поэтому этот каталог сознательно
 * покрывает 5 видов, для которых контракт и спека согласуются один-в-один
 * (chicken/cow/pig/goat/bee); `sheep` и `turkey` — см. TODO(architecture) ниже,
 * решается через PR к `@/types/animals.ts` + `schema.ts` (AGENTS.md §0 правило 6,
 * §2 «Общие файлы» — только по согласованию).
 *
 * TODO(architecture): свести `AnimalKind`/`AnimalKindSchema` с 03-animals.md §3.1
 * (turkey vs sheep) — см. также спеку §8, открытый вопрос 5 (сезонный гейт индейки).
 */

import type { AnimalDef } from '../schema'

export const animals: AnimalDef[] = [
  {
    kind: 'chicken',
    name: { en: 'Hen', ru: 'Курица' },
    housing: 'bld_coop',
    productKey: 'egg',
    tier: 1,
    cycleMin: 20,
    unlockLevel: 1,
    assetKey: 'an_hen',
  },
  {
    kind: 'cow',
    name: { en: 'Dairy Cow', ru: 'Молочная корова' },
    housing: 'bld_barn',
    productKey: 'milk',
    tier: 2,
    cycleMin: 45,
    unlockLevel: 3,
    assetKey: 'an_cow',
  },
  {
    kind: 'pig',
    name: { en: 'Pig', ru: 'Свинья' },
    housing: 'bld_barn',
    productKey: 'bacon',
    tier: 2,
    cycleMin: 90,
    unlockLevel: 5,
    assetKey: 'an_pig',
  },
  {
    kind: 'bee',
    name: { en: 'Bee Hive', ru: 'Пчелиный улей' },
    housing: 'bld_apiary',
    productKey: 'honey',
    tier: 3,
    cycleMin: 240,
    unlockLevel: 6,
    assetKey: 'an_bee',
  },
  {
    kind: 'goat',
    name: { en: 'Dairy Goat', ru: 'Молочная коза' },
    housing: 'bld_barn',
    productKey: 'goat_milk',
    tier: 3,
    cycleMin: 180,
    unlockLevel: 10,
    assetKey: 'an_goat',
  },
]
