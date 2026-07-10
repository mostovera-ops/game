/**
 * data/validate.test.ts — прогоняет все каталоги `src/data/catalogs/*.ts` через
 * zod-схемы (`schema.ts`) и проверяет ссылочную целостность между каталогами.
 *
 * Каталоги пока пусты (контент не написан) — тесты по отсутствующим файлам
 * СКИПАЮТСЯ (`it.skip`) с пояснением, а не падают. Как только появится
 * `src/data/catalogs/<file>.ts` с ожидаемым именованным экспортом (см.
 * `CONTENT_CATALOGS` в `schema.ts`), соответствующие проверки включаются сами —
 * никаких правок этого файла не требуется.
 *
 * Уровень 1 (vitest, node) по AGENTS.md §4: чистая логика, без three/react.
 */

import { describe, it, expect } from 'vitest'
import {
  CONTENT_CATALOGS,
  parseCatalog,
  assertUniqueKeys,
  type Ingredient,
  type Recipe,
  type CropDef,
  type AnimalDef,
  type KnowHowNodeDef,
  type StateContent,
  type TownProjectDef,
  type DailySpecialTemplate,
  type PostcardDef,
  type Machine,
} from './schema'

// ── Загрузка каталогов ────────────────────────────────────────────────────────
// import.meta.glob — Vite/vitest нативная фича; при отсутствии файлов в
// src/data/catalogs/ просто вернёт пустой объект, ничего не падает.
const modules = import.meta.glob('./catalogs/*.ts', { eager: true }) as Record<string, Record<string, unknown>>

function rawModuleFor(file: string): Record<string, unknown> | undefined {
  return modules[`./catalogs/${file}.ts`]
}

/**
 * Достаёт и валидирует каталог по его спеке. Возвращает `undefined`, если файл
 * каталога ещё не создан (контент не написан) — вызывающий код должен в этом
 * случае вызвать `it.skip`, а не считать это ошибкой.
 */
function loadCatalog<T>(spec: (typeof CONTENT_CATALOGS)[number]): T[] | undefined {
  const mod = rawModuleFor(spec.file)
  if (!mod) return undefined

  const exported = mod[spec.exportName]
  if (exported === undefined) {
    throw new Error(
      `catalogs/${spec.file}.ts существует, но не экспортирует \`${spec.exportName}\` ` +
        `(контракт — CONTENT_CATALOGS в schema.ts)`,
    )
  }
  if (!Array.isArray(exported)) {
    throw new Error(`catalogs/${spec.file}.ts: \`${spec.exportName}\` должен быть массивом`)
  }

  const parsed = parseCatalog<T>(spec.schema, exported, spec.name)
  assertUniqueKeys(parsed.map((item) => spec.keyOf(item)), spec.name)
  return parsed
}

// ── 1. Схема + уникальность ключей — по одному describe на каталог ───────────

describe('content catalogs: схема + уникальность ключей', () => {
  for (const spec of CONTENT_CATALOGS) {
    const mod = rawModuleFor(spec.file)

    if (!mod) {
      it.skip(`[${spec.name}] catalogs/${spec.file}.ts ещё не создан — контент не написан`, () => {})
      continue
    }

    it(`[${spec.name}] все записи валидны по схеме и ключи уникальны`, () => {
      expect(() => loadCatalog(spec)).not.toThrow()
    })
  }
})

// ── 2. Ссылочная целостность между каталогами ─────────────────────────────────
//
// Присутствие катaлога проверяем ДЁШЕВО (rawModuleFor, без парсинга) на этапе
// сборки тестов — только чтобы решить it/it.skip. Сам парсинг (loadCatalog,
// может throw при невалидном контенте) происходит ВНУТРИ тела `it()`, лениво —
// так падение одной проверки не рушит сбор остальных тестов файла.

describe('content catalogs: ссылочная целостность', () => {
  const ingredientsSpec = CONTENT_CATALOGS.find((s) => s.name === 'Ingredient')!
  const recipesSpec = CONTENT_CATALOGS.find((s) => s.name === 'Recipe')!
  const machinesSpec = CONTENT_CATALOGS.find((s) => s.name === 'Machine')!
  const cropsSpec = CONTENT_CATALOGS.find((s) => s.name === 'CropDef')!
  const animalsSpec = CONTENT_CATALOGS.find((s) => s.name === 'AnimalDef')!
  const knowHowSpec = CONTENT_CATALOGS.find((s) => s.name === 'KnowHowNodeDef')!
  const statesSpec = CONTENT_CATALOGS.find((s) => s.name === 'StateContent')!
  const townProjectsSpec = CONTENT_CATALOGS.find((s) => s.name === 'TownProjectDef')!
  const dailySpecialsSpec = CONTENT_CATALOGS.find((s) => s.name === 'DailySpecialTemplate')!
  const postcardsSpec = CONTENT_CATALOGS.find((s) => s.name === 'PostcardDef')!

  const present = (spec: (typeof CONTENT_CATALOGS)[number]) => rawModuleFor(spec.file) !== undefined

  /** Регистрирует it/it.skip в зависимости от наличия файлов всех нужных каталогов. */
  function testWhenPresent(title: string, specs: (typeof CONTENT_CATALOGS)[number][], fn: () => void) {
    if (specs.every(present)) {
      it(title, fn)
    } else {
      const missing = specs.filter((s) => !present(s)).map((s) => `catalogs/${s.file}.ts`)
      it.skip(`${title} (пропущено: не написан(ы) ${missing.join(', ')})`, () => {})
    }
  }

  // --- Recipe → Ingredient ------------------------------------------------------

  testWhenPresent(
    '[Recipe→Ingredient] каждый вход и выход рецепта ссылается на существующий ингредиент',
    [recipesSpec, ingredientsSpec],
    () => {
      const recipes = loadCatalog<Recipe>(recipesSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const ingredientKeys = new Set(ingredients.map((i) => i.key))
      for (const recipe of recipes) {
        for (const input of recipe.inputs) {
          expect(
            ingredientKeys.has(input.key),
            `рецепт "${recipe.key}" ссылается на несуществующий вход "${input.key}"`,
          ).toBe(true)
        }
        expect(
          ingredientKeys.has(recipe.output.key),
          `рецепт "${recipe.key}" ссылается на несуществующий выход "${recipe.output.key}"`,
        ).toBe(true)
      }
    },
  )

  testWhenPresent(
    '[Recipe] цена продажи блюда превышает себестоимость сырья (положительная маржа)',
    [recipesSpec, ingredientsSpec],
    () => {
      const recipes = loadCatalog<Recipe>(recipesSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const priceByKey = new Map(ingredients.map((i) => [i.key, i.basePrice]))
      // Первый рецепт-производитель для каждого output-ключа (у некоторых блюд/полуфабрикатов
      // несколько рецептов — напр. прямой крафт дерева, 06-recipes §3.7; для раскрытия
      // себестоимости берём любой корректный путь до сырья).
      const recipeByOutput = new Map<string, Recipe>()
      for (const r of recipes) if (!recipeByOutput.has(r.output.key)) recipeByOutput.set(r.output.key, r)

      // «Себестоимость входов» = рыночная стоимость РАСХОДНОГО СЫРЬЯ, а не перепродажная
      // цена промежуточных произведённых товаров. Полуфабрикат/блюдо-вход раскрываем
      // РЕКУРСИВНО до листьев-сырья (crop_*/животные продукты/каталог-товары без рецепта).
      // Иначе инвариант ложно отвергает (а) дерево-финалы, где база блюда по дизайну равна
      // базе промежуточного (Cherry Pie à la Mode #21 = Cherry Pie + Custard, обе база $75;
      // маржа копится через mastery ★, 06-recipes §3.3), и (б) полуфабрикаты, которые в
      // перепродаже дешевле сырья (Butter < Milk×2 — его крафтят под рецепты, не на продажу).
      const rawCost = (key: string, stack: readonly string[] = []): number => {
        const r = recipeByOutput.get(key)
        if (!r) {
          const p = priceByKey.get(key)
          return p === undefined ? NaN : p // отсутствие ключа-листа словит [Recipe→Ingredient]
        }
        if (stack.includes(key)) return NaN // защита от цикла в графе рецептов
        const next = [...stack, key]
        const inputsCost = r.inputs.reduce((sum, input) => sum + rawCost(input.key, next) * input.qty, 0)
        return inputsCost / r.output.qty // на одну единицу выхода
      }

      // Инвариант проверяем на КОНЕЧНЫХ блюдах (output.itemClass 'dish' — то, что продаётся
      // NPC). Промежуточные полуфабрикаты не продаются с маржой сами по себе; их вклад учтён
      // внутри rawCost блюда, а сквозная прибыльность всей цепочки крафта гарантируется этой
      // же проверкой на её финале.
      for (const recipe of recipes) {
        if (recipe.output.itemClass !== 'dish') continue
        const outputPrice = priceByKey.get(recipe.output.key)
        if (outputPrice === undefined) continue // словит [Recipe→Ingredient]
        const perUnitCost =
          recipe.inputs.reduce((sum, input) => sum + rawCost(input.key, [recipe.output.key]) * input.qty, 0) /
          recipe.output.qty
        if (Number.isNaN(perUnitCost)) continue // отсутствующий вход — зона [Recipe→Ingredient]
        expect(
          outputPrice > perUnitCost,
          `рецепт "${recipe.key}": цена продажи блюда (${outputPrice}) должна быть больше себестоимости сырья (${perUnitCost.toFixed(2)})`,
        ).toBe(true)
      }
    },
  )

  testWhenPresent(
    '[Recipe] цена продажи полуфабриката (itemClass ingredient) превышает сумму basePrice его прямых входов ' +
      '(STATE-1: полуфабрикат не должен продаваться дешевле сырья, из которого его крафтят)',
    [recipesSpec, ingredientsSpec],
    () => {
      const recipes = loadCatalog<Recipe>(recipesSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const priceByKey = new Map(ingredients.map((i) => [i.key, i.basePrice]))
      for (const recipe of recipes) {
        if (recipe.output.itemClass !== 'ingredient') continue
        const outputPrice = priceByKey.get(recipe.output.key)
        if (outputPrice === undefined) continue // словит [Recipe→Ingredient]
        // Себестоимость = рыночная стоимость ПРЯМЫХ входов (их basePrice как есть, без
        // рекурсивного раскрытия до сырья) — именно то число, с которым игрок сравнивает
        // цену полуфабриката при прямой продаже вместо дальнейшей переработки.
        let inputsCost = 0
        let missingInput = false
        for (const input of recipe.inputs) {
          const p = priceByKey.get(input.key)
          if (p === undefined) {
            missingInput = true // словит [Recipe→Ingredient]
            break
          }
          inputsCost += p * input.qty
        }
        if (missingInput) continue
        const perUnitCost = inputsCost / recipe.output.qty
        expect(
          outputPrice > perUnitCost,
          `рецепт "${recipe.key}": цена продажи полуфабриката "${recipe.output.key}" (${outputPrice}) должна быть больше суммы basePrice его входов (${perUnitCost.toFixed(2)})`,
        ).toBe(true)
      }
    },
  )

  testWhenPresent(
    '[Recipe→Machine] machineKey ссылается на существующий станок',
    [recipesSpec, machinesSpec],
    () => {
      const recipes = loadCatalog<Recipe>(recipesSpec)!
      const machines = loadCatalog<Machine>(machinesSpec)!
      const machineKeys = new Set(machines.map((m) => m.key))
      for (const recipe of recipes) {
        expect(
          machineKeys.has(recipe.machineKey),
          `рецепт "${recipe.key}" ссылается на несуществующий станок "${recipe.machineKey}"`,
        ).toBe(true)
      }
    },
  )

  // --- StateContent.highlights → Ingredient ------------------------------------
  // Хайлайт-продукты стопа роуд-трипа (07-expeditions §3.1/§4.2) — ссылки на реальные
  // ключи каталога ингредиентов. Ловит рассинхрон плейсхолдеров между states.ts и
  // ingredients.ts (были `prod_*`, которых нет в каталоге — унифицированы в states.ts).

  testWhenPresent(
    '[StateContent→Ingredient] highlights ссылаются на существующие ингредиенты',
    [statesSpec, ingredientsSpec],
    () => {
      const states = loadCatalog<StateContent>(statesSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const ingredientKeys = new Set(ingredients.map((i) => i.key))
      for (const state of states) {
        for (const key of state.highlights) {
          expect(
            ingredientKeys.has(key),
            `штат "${state.key}": highlight "${key}" не найден среди ингредиентов`,
          ).toBe(true)
        }
      }
    },
  )

  // --- Crop → Ingredient (семя и урожай должны существовать) -------------------

  testWhenPresent(
    '[CropDef→Ingredient] seedKey и cropKey существуют в каталоге ингредиентов',
    [cropsSpec, ingredientsSpec],
    () => {
      const crops = loadCatalog<CropDef>(cropsSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const ingredientKeys = new Set(ingredients.map((i) => i.key))
      for (const crop of crops) {
        expect(
          ingredientKeys.has(crop.seedKey),
          `crop "${crop.cropKey}": seedKey "${crop.seedKey}" не найден среди ингредиентов`,
        ).toBe(true)
        expect(
          ingredientKeys.has(crop.cropKey),
          `crop с seedKey "${crop.seedKey}": cropKey "${crop.cropKey}" не найден среди ингредиентов`,
        ).toBe(true)
      }
    },
  )

  // --- Animal → Ingredient (продукт-источник должен существовать) -------------

  testWhenPresent(
    '[AnimalDef→Ingredient] productKey существует в каталоге ингредиентов',
    [animalsSpec, ingredientsSpec],
    () => {
      const animals = loadCatalog<AnimalDef>(animalsSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const ingredientKeys = new Set(ingredients.map((i) => i.key))
      for (const animal of animals) {
        expect(
          ingredientKeys.has(animal.productKey),
          `animal "${animal.kind}": productKey "${animal.productKey}" не найден среди ингредиентов`,
        ).toBe(true)
      }
    },
  )

  // --- KnowHowNode prereqs → KnowHowNode ---------------------------------------

  testWhenPresent('[KnowHowNodeDef] все prereqs ссылаются на существующие узлы дерева', [knowHowSpec], () => {
    const nodes = loadCatalog<KnowHowNodeDef>(knowHowSpec)!
    const nodeKeys = new Set(nodes.map((n) => n.key))
    for (const node of nodes) {
      for (const prereq of node.prereqs) {
        expect(nodeKeys.has(prereq), `узел "${node.key}" ссылается на несуществующий prereq "${prereq}"`).toBe(true)
      }
    }
  })

  // --- TownProject.goalResources → Ingredient ----------------------------------

  testWhenPresent(
    '[TownProjectDef→Ingredient] ключи goalResources существуют в каталоге ингредиентов',
    [townProjectsSpec, ingredientsSpec],
    () => {
      const projects = loadCatalog<TownProjectDef>(townProjectsSpec)!
      const ingredients = loadCatalog<Ingredient>(ingredientsSpec)!
      const ingredientKeys = new Set(ingredients.map((i) => i.key))
      for (const project of projects) {
        for (const stage of project.stages) {
          for (const key of Object.keys(stage.goalResources ?? {})) {
            expect(
              ingredientKeys.has(key),
              `town project "${project.key}" stage ${stage.stage}: ресурс "${key}" не найден среди ингредиентов`,
            ).toBe(true)
          }
        }
      }
    },
  )

  // --- DailySpecialTemplate.recipePoolKeys → Recipe ----------------------------

  testWhenPresent(
    '[DailySpecialTemplate→Recipe] recipePoolKeys ссылаются на существующие рецепты',
    [dailySpecialsSpec, recipesSpec],
    () => {
      const templates = loadCatalog<DailySpecialTemplate>(dailySpecialsSpec)!
      const recipes = loadCatalog<Recipe>(recipesSpec)!
      const recipeKeys = new Set(recipes.map((r) => r.key))
      for (const template of templates) {
        for (const key of template.recipePoolKeys ?? []) {
          expect(recipeKeys.has(key), `daily special "${template.key}" ссылается на несуществующий рецепт "${key}"`).toBe(
            true,
          )
        }
      }
    },
  )

  // --- PostcardDef.stateKey → StateContent -------------------------------------

  testWhenPresent(
    '[PostcardDef→StateContent] stateKey (если задан) ссылается на существующий штат',
    [postcardsSpec, statesSpec],
    () => {
      const postcards = loadCatalog<PostcardDef>(postcardsSpec)!
      const states = loadCatalog<StateContent>(statesSpec)!
      const stateKeys = new Set(states.map((s) => s.key))
      for (const postcard of postcards) {
        if (postcard.stateKey) {
          expect(
            stateKeys.has(postcard.stateKey),
            `открытка "${postcard.key}" ссылается на несуществующий штат "${postcard.stateKey}"`,
          ).toBe(true)
        }
      }
    },
  )
})

// ── 3. Санити на пустом наборе (обязателен по ТЗ: тест работает и без контента) ──

describe('content catalogs: пустой набор (пока контент не написан)', () => {
  it('CONTENT_CATALOGS описывает непустой реестр ожидаемых каталогов', () => {
    expect(CONTENT_CATALOGS.length).toBeGreaterThan(0)
  })

  it('парсер каталога принимает пустой массив для любой схемы (сам по себе пустой каталог валиден)', () => {
    for (const spec of CONTENT_CATALOGS) {
      expect(() => parseCatalog(spec.schema, [], spec.name)).not.toThrow()
    }
  })

  it('assertUniqueKeys не падает на пустом списке ключей', () => {
    expect(() => assertUniqueKeys([], 'empty')).not.toThrow()
  })
})
