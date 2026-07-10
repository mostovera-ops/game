import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BASE_RECIPE_IDS,
  BEDS,
  EGG_REGROW,
  MUSHROOM_REGROW,
  regrowChance,
  regrowForage,
  craftableCount,
  CROPS,
  RECIPES,
  RECIPE_IDS,
  SEED_PRICE,
  SLOTS_PER_BED,
  SLOT_IDS,
  START_MONEY,
  START_SEEDS,
  bedOf,
  slotActionable,
  useGameStore,
  type Inventory,
} from './store'

/** Доводит слот до stage 2, подсовывая нужный бросок удачи при созревании. */
function ripen(id: string, luckyRoll: number) {
  const S = () => useGameStore.getState()
  S().plant(id)
  S().water(id)
  S().endDay() // stage 1 — удача ещё не бросается
  S().water(id)
  vi.spyOn(Math, 'random').mockReturnValue(luckyRoll)
  S().endDay() // stage 2 — здесь бросок
}

const S = () => useGameStore.getState()
const slot = (id: string) => S().slots.find((x) => x.id === id)!

/** Сумка: перечисляем только непустое, остальное — нули. */
const bag = (patch: Partial<Inventory>): Inventory => ({
  carrot: 0,
  greens: 0,
  tomato: 0,
  mushroom: 0,
  egg: 0,
  ...patch,
})

beforeEach(() => {
  S().resetGame()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('farm cycle', () => {
  it('посадил → полил → endDay → полил → endDay → stage 2 → harvest → инвентарь +1', () => {
    const id = SLOT_IDS[0]
    S().selectSeed('carrot')

    S().plant(id)
    expect(slot(id).crop).toBe('carrot')
    expect(slot(id).stage).toBe(0)

    S().water(id)
    S().endDay()
    expect(slot(id).stage).toBe(1)

    S().water(id)
    // Бросок удачи фиксируем: иначе раз в десять прогонов растение оказывается
    // удачным, даёт 2 единицы, и тест про обычный сбор падает на ровном месте.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    S().endDay()
    expect(slot(id).stage).toBe(2)
    expect(slot(id).lucky).toBe(false)

    const before = S().inventory.carrot
    S().harvest(id)
    expect(S().inventory.carrot).toBe(before + 1)
    expect(slot(id).crop).toBeNull()
  })

  it('посадил → endDay без полива → слот пуст', () => {
    const id = SLOT_IDS[1]
    S().plant(id)
    S().endDay()
    expect(slot(id).crop).toBeNull()
    expect(slot(id).stage).toBe(0)
  })

  it('endDay на дне 6 → phase === "truck"', () => {
    for (let i = 0; i < 5; i++) S().endDay() // день 1 → 6
    expect(S().day).toBe(6)
    expect(S().phase).toBe('farm')

    S().endDay() // день 6 → 7
    expect(S().day).toBe(7)
    expect(S().phase).toBe('truck')
  })
})

describe('грядка: 3 слота', () => {
  it('в грядке ровно 3 слота, всего 9', () => {
    expect(SLOTS_PER_BED).toBe(3)
    expect(SLOT_IDS.length).toBe(BEDS * 3)
    for (let bed = 0; bed < BEDS; bed++) {
      expect(SLOT_IDS.filter((id) => bedOf(id) === bed).length).toBe(3)
    }
  })

  it('четвёртого слота не существует', () => {
    expect(SLOT_IDS).not.toContain('0:3')
    expect(S().slots.find((x) => x.id === '0:3')).toBeUndefined()
  })
})

describe('инструменты', () => {
  it('по умолчанию в руках семена', () => {
    expect(S().tool).toBe('seed')
  })

  it('выбор семени возвращает семена в руки', () => {
    S().selectTool('can')
    expect(S().tool).toBe('can')
    S().selectSeed('tomato')
    expect(S().tool).toBe('seed')
    expect(S().selectedSeed).toBe('tomato')
  })

  it('water красит любой слот: пустой, растущий, созревший', () => {
    const id = SLOT_IDS[0]
    S().water(id) // пустой слот
    expect(slot(id).watered).toBe(true)

    S().plant(id)
    S().water(id)
    expect(slot(id).watered).toBe(true)

    S().endDay()
    S().water(id)
    S().endDay() // stage 2 — созрело
    expect(slot(id).stage).toBe(2)

    S().water(id)
    expect(slot(id).watered).toBe(true)
  })

  it('полив пустого слота не заводит растение и не мешает росту', () => {
    const id = SLOT_IDS[0]
    S().water(id)
    S().endDay()
    expect(slot(id).crop).toBeNull()
    expect(slot(id).watered).toBe(false) // сухая земля к утру
  })

  it('полив созревшего слота не сбрасывает и не двигает стадию', () => {
    const id = SLOT_IDS[0]
    ripen(id, 1) // 1 → не удачное
    S().water(id)
    S().endDay()
    expect(slot(id).stage).toBe(2)
    expect(slot(id).crop).not.toBeNull()
  })

  it('slotActionable: лейка берёт любой слот, рука — только созревший', () => {
    const id = SLOT_IDS[0]
    expect(slotActionable(slot(id), 'can')).toBe(true) // пустой
    expect(slotActionable(slot(id), 'seed')).toBe(true)
    expect(slotActionable(slot(id), 'hand')).toBe(false)

    S().plant(id)
    expect(slotActionable(slot(id), 'can')).toBe(true) // растущий
    expect(slotActionable(slot(id), 'seed')).toBe(false)
    expect(slotActionable(slot(id), 'hand')).toBe(false)

    S().water(id)
    S().endDay()
    S().water(id)
    S().endDay() // созрело
    expect(slotActionable(slot(id), 'can')).toBe(true)
    expect(slotActionable(slot(id), 'hand')).toBe(true)
  })
})

describe('полив принадлежит грядке, а не растению', () => {
  it('сбор урожая не осушает грядку', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.5)
    S().water(id)
    expect(slot(id).watered).toBe(true)

    S().harvest(id)
    expect(slot(id).crop).toBeNull()
    expect(slot(id).watered).toBe(true)
  })

  it('посадка в мокрую грядку сохраняет полив, и росток растёт', () => {
    const id = SLOT_IDS[1]
    S().water(id) // поливаем пустую грядку
    S().plant(id)
    expect(slot(id).watered).toBe(true)

    S().endDay()
    expect(slot(id).stage).toBe(1) // политый — вырос, а не погиб
    expect(slot(id).crop).not.toBeNull()
  })
})

describe('удачное растение (1 к 10)', () => {
  it('бросок < 0.1 → lucky, сбор даёт 2 единицы', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.05)
    expect(slot(id).stage).toBe(2)
    expect(slot(id).lucky).toBe(true)

    S().harvest(id)
    expect(S().inventory.carrot).toBe(2)
  })

  it('бросок ≥ 0.1 → обычное, сбор даёт 1 единицу', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.5)
    expect(slot(id).lucky).toBe(false)

    S().harvest(id)
    expect(S().inventory.carrot).toBe(1)
  })

  it('удача бросается один раз — созревшее не переигрывает её на endDay', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.05)
    expect(slot(id).lucky).toBe(true)

    vi.spyOn(Math, 'random').mockReturnValue(0.99) // «неудачный» бросок
    S().endDay()
    expect(slot(id).lucky).toBe(true)
  })

  it('сбор очищает флаг удачи, новый росток не наследует его', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.05)
    S().harvest(id)
    expect(slot(id).lucky).toBe(false)
    S().plant(id)
    expect(slot(id).lucky).toBe(false)
  })
})

describe('уведомления', () => {
  it('сбор кладёт тост с культурой и количеством', () => {
    const id = SLOT_IDS[0]
    ripen(id, 0.05)
    S().harvest(id)
    const n = S().notices.at(-1)!
    expect(n.kind).toBe('harvest')
    expect(n.crop).toBe('carrot')
    expect(n.amount).toBe(2)
  })

  it('гибель без полива сообщает, сколько погибло', () => {
    S().plant(SLOT_IDS[0])
    S().plant(SLOT_IDS[1])
    S().endDay()
    const n = S().notices.at(-1)!
    expect(n.kind).toBe('withered')
    expect(n.amount).toBe(2)
  })

  it('торговля: нет ресурсов / не то блюдо / нет клиента', () => {
    useGameStore.setState({
      phase: 'truck',
      inventory: bag({}),
      truck: {
        timeLeft: 60, queue: [], served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false, nextCustomerId: 1,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('no-customer')

    useGameStore.setState({
      truck: {
        timeLeft: 60,
        queue: [{ id: 1, want: 'salad', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false, nextCustomerId: 1,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('wrong-dish')
    expect(S().notices.at(-1)!.recipe).toBe('salad')

    useGameStore.setState({
      truck: {
        timeLeft: 60,
        queue: [{ id: 1, want: 'soup', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false, nextCustomerId: 1,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('no-ingredients')
  })

  it('успешная продажа сообщает цену', () => {
    useGameStore.setState({
      phase: 'truck',
      inventory: bag({ carrot: 2 }),
      truck: {
        timeLeft: 60,
        queue: [{ id: 1, want: 'soup', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false, nextCustomerId: 1,
      },
    })
    expect(S().serveCustomer('soup')).toBe('ok')
    const n = S().notices.at(-1)!
    expect(n.kind).toBe('served')
    expect(n.amount).toBe(RECIPES.soup.price)
  })

  it('ушедший клиент и конец времени попадают в тосты', () => {
    useGameStore.setState({
      phase: 'truck',
      truck: {
        timeLeft: 60,
        queue: [{ id: 1, want: 'taco', patience: 0.5, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 99, ended: false, nextCustomerId: 1,
      },
    })
    S().tickTruck(1)
    expect(S().notices.at(-1)!.kind).toBe('customer-left')

    useGameStore.setState({
      truck: {
        timeLeft: 0.5, queue: [], served: 0, spawnTimer: 0, nextSpawnIn: 99, ended: false, nextCustomerId: 1,
      },
    })
    S().tickTruck(1)
    expect(S().notices.at(-1)!.kind).toBe('time-up')
  })

  it('тостов на экране не больше четырёх', () => {
    for (let i = 0; i < 7; i++) {
      S().plant(SLOT_IDS[i])
      S().endDay() // каждый endDay даёт тост withered
    }
    expect(S().notices.length).toBeLessThanOrEqual(4)
  })

  it('notify не дублирует один и тот же вид подряд', () => {
    S().notify('too-far')
    S().notify('too-far')
    S().notify('too-far')
    expect(S().notices.filter((n) => n.kind === 'too-far').length).toBe(1)

    S().notify('no-customer')
    S().notify('too-far') // вид сменился — снова можно
    expect(S().notices.filter((n) => n.kind === 'too-far').length).toBe(2)
  })

  it('dismissNotice убирает тост по id', () => {
    S().plant(SLOT_IDS[0])
    S().endDay()
    const id = S().notices.at(-1)!.id
    S().dismissNotice(id)
    expect(S().notices.find((n) => n.id === id)).toBeUndefined()
  })
})

describe('дополнительные правила', () => {
  it('созревшее растение (stage 2) без полива не погибает', () => {
    const id = SLOT_IDS[2]
    S().plant(id)
    S().water(id)
    S().endDay() // stage 1
    S().water(id)
    S().endDay() // stage 2
    S().endDay() // без полива — остаётся
    expect(slot(id).stage).toBe(2)
    expect(slot(id).crop).not.toBeNull()
  })

  it('нельзя посадить в занятый слот', () => {
    const id = SLOT_IDS[3]
    S().selectSeed('carrot')
    S().plant(id)
    S().selectSeed('tomato')
    S().plant(id)
    expect(slot(id).crop).toBe('carrot')
  })

  it('serve вычитает ингредиенты и добавляет деньги', () => {
    // Готовим soup: нужно 2 моркови.
    useGameStore.setState({
      phase: 'truck',
      inventory: bag({ carrot: 2 }),
    })
    const ok = S().serve('soup')
    expect(ok).toBe(true)
    expect(S().inventory.carrot).toBe(0)
    expect(S().money).toBe(START_MONEY + RECIPES.soup.price)
  })

  it('serve не проходит без ингредиентов', () => {
    useGameStore.setState({
      phase: 'truck',
      inventory: bag({ carrot: 1 }),
    })
    const ok = S().serve('soup')
    expect(ok).toBe(false)
    expect(S().money).toBe(START_MONEY)
  })
})

describe('семена и лавка', () => {
  it('на старте по три семени каждой культуры — ровно на девять слотов', () => {
    expect(S().seeds).toEqual({ carrot: START_SEEDS, greens: START_SEEDS, tomato: START_SEEDS })
    expect(SLOT_IDS.length).toBe(3 * START_SEEDS)
  })

  it('посадка тратит семя', () => {
    S().selectSeed('carrot')
    S().plant(SLOT_IDS[0])
    expect(S().seeds.carrot).toBe(START_SEEDS - 1)
    expect(S().seeds.greens).toBe(START_SEEDS)
  })

  it('без семян слот остаётся пустым, летит тост', () => {
    S().selectSeed('carrot')
    useGameStore.setState({ seeds: { carrot: 0, greens: 3, tomato: 3 } })
    S().plant(SLOT_IDS[0])
    expect(slot(SLOT_IDS[0]).crop).toBeNull()
    expect(S().notices.at(-1)?.kind).toBe('no-seeds')
  })

  it('посадка в занятый слот семя не тратит', () => {
    S().plant(SLOT_IDS[0])
    const left = S().seeds[S().selectedSeed]
    S().plant(SLOT_IDS[0])
    expect(S().seeds[S().selectedSeed]).toBe(left)
  })

  it('покупка снимает деньги и добавляет семена', () => {
    S().buySeeds('tomato', 3)
    expect(S().money).toBe(START_MONEY - SEED_PRICE.tomato * 3)
    expect(S().seeds.tomato).toBe(START_SEEDS + 3)
  })

  it('не хватает денег — ничего не меняется', () => {
    useGameStore.setState({ money: 1 })
    S().buySeeds('tomato', 1)
    expect(S().money).toBe(1)
    expect(S().seeds.tomato).toBe(START_SEEDS)
    expect(S().notices.at(-1)?.kind).toBe('no-money')
  })

  it('каждое блюдо окупает свои семена', () => {
    for (const id of RECIPE_IDS) {
      const recipe = RECIPES[id]
      const seedCost = CROPS.reduce((sum, c) => sum + SEED_PRICE[c] * (recipe.needs[c] ?? 0), 0)
      expect(recipe.price).toBeGreaterThan(seedCost)
    }
  })

  it('новая неделя не выдаёт семян даром', () => {
    useGameStore.setState({ seeds: bag({}), money: 7 })
    S().nextWeek()
    expect(S().seeds).toEqual(bag({}))
    expect(S().money).toBe(7)
  })
})

describe('день фудтрака (Task 3)', () => {
  const mkTruck = (over = {}) => ({
    timeLeft: 60,
    queue: [] as {
      id: number
      want: 'salad' | 'soup' | 'taco' | null
      patience: number
      maxPatience: number
    }[],
    served: 0,
    spawnTimer: 0,
    nextSpawnIn: 2.5,
    ended: false,
    nextCustomerId: 1,
    ...over,
  })

  it('пропуск заказа отпускает первого и двигает очередь', () => {
    useGameStore.setState({
      phase: 'truck',
      money: 0,
      truck: mkTruck({
        queue: [
          { id: 1, want: 'taco' as const, patience: 16, maxPatience: 16 },
          { id: 2, want: 'soup' as const, patience: 16, maxPatience: 16 },
        ],
      }),
    })
    S().skipCustomer()
    expect(S().truck!.queue.map((c) => c.id)).toEqual([2])
    expect(S().truck!.served).toBe(0) // пропуск — не продажа
    expect(S().money).toBe(0)
    const n = S().notices.at(-1)!
    expect(n.kind).toBe('skipped')
    expect(n.recipe).toBe('taco')
  })

  it('пропускать некого — тост, очередь не трогаем', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck() })
    S().skipCustomer()
    expect(S().notices.at(-1)!.kind).toBe('no-customer')
  })

  it('craftableCount ограничен самым дефицитным ингредиентом', () => {
    expect(craftableCount('soup', bag({ carrot: 5 }))).toBe(2) // 2 моркови на порцию
    expect(craftableCount('taco', bag({ carrot: 3, greens: 1, tomato: 9 }))).toBe(1) // зелень в дефиците
    expect(craftableCount('salad', bag({ carrot: 9, tomato: 9 }))).toBe(0)
    // Находки считаются наравне с урожаем: грибов на два супа, моркови на одну.
    expect(craftableCount('mushroom_soup', bag({ mushroom: 4, carrot: 1 }))).toBe(1)
  })

  it('endDay на дне 6 открывает фудтрек', () => {
    for (let i = 0; i < 6; i++) S().endDay() // день 1 → 7
    expect(S().phase).toBe('truck')
    expect(S().truck).not.toBeNull()
    expect(S().truck!.timeLeft).toBeGreaterThan(0)
  })

  it('tickTruck спавнит клиента и убавляет время', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck() })
    S().tickTruck(3)
    expect(S().truck!.queue.length).toBe(1)
    expect(S().truck!.timeLeft).toBeLessThan(60)
  })

  it('каждый клиент получает свой id, и он не переиспользуется', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck() })
    S().tickTruck(3) // спавн первого
    const first = S().truck!.queue[0].id
    S().tickTruck(7) // спавн второго
    const ids = S().truck!.queue.map((c) => c.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
    expect(S().truck!.nextCustomerId).toBeGreaterThan(Math.max(...ids))

    // Первого обслужили — его id не должен достаться следующему. Заказ он
    // делает у окна, поэтому сперва доводим его туда.
    S().customerReady(first)
    useGameStore.setState({ inventory: bag({ carrot: 2, greens: 2, tomato: 2 }) })
    S().serveCustomer(S().truck!.queue[0].want!)
    S().tickTruck(7)
    expect(S().truck!.queue.map((c) => c.id)).not.toContain(first)
  })

  it('время вышло → truck.ended', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck({ timeLeft: 0.5 }) })
    S().tickTruck(1)
    expect(S().truck!.ended).toBe(true)
  })

  it('serveCustomer продаёт верное блюдо и двигает очередь', () => {
    useGameStore.setState({
      phase: 'truck',
      money: 0,
      inventory: bag({ carrot: 2 }),
      truck: mkTruck({ queue: [{ id: 1, want: 'soup', patience: 16, maxPatience: 16 }] }),
    })
    expect(S().serveCustomer('soup')).toBe('ok')
    expect(S().money).toBe(RECIPES.soup.price)
    expect(S().truck!.served).toBe(1)
    expect(S().truck!.queue.length).toBe(0)
  })

  it('serveCustomer отклоняет: нет клиента / не то блюдо / нет ингредиентов', () => {
    useGameStore.setState({ phase: 'truck', inventory: bag({}), truck: mkTruck() })
    expect(S().serveCustomer('soup')).toBe('no-customer')
    useGameStore.setState({ truck: mkTruck({ queue: [{ id: 1, want: 'salad', patience: 16, maxPatience: 16 }] }) })
    expect(S().serveCustomer('soup')).toBe('wrong-dish')
    useGameStore.setState({
      inventory: bag({ carrot: 1, greens: 1, tomato: 1 }),
      truck: mkTruck({ queue: [{ id: 1, want: 'soup', patience: 16, maxPatience: 16 }] }),
    })
    expect(S().serveCustomer('soup')).toBe('no-ingredients')
  })

  it('заказ появляется только у окна: спавн даёт клиента без него', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck() })
    S().tickTruck(3)
    const c = S().truck!.queue[0]
    expect(c.want).toBeNull()
    // Подать нечего: клиент ещё ничего не просил.
    expect(S().serveCustomer('soup')).toBe('no-customer')

    S().customerReady(c.id)
    expect(S().truck!.queue[0].want).not.toBeNull()
  })

  it('терпение не тратится, пока клиент идёт к окну', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck() })
    S().tickTruck(3)
    const before = S().truck!.queue[0].patience
    S().tickTruck(5)
    expect(S().truck!.queue[0].patience).toBe(before)
  })

  it('заказать может только первый в очереди', () => {
    useGameStore.setState({
      phase: 'truck',
      truck: mkTruck({
        queue: [
          { id: 1, want: null, patience: 16, maxPatience: 16 },
          { id: 2, want: null, patience: 16, maxPatience: 16 },
        ],
      }),
    })
    S().customerReady(2)
    expect(S().truck!.queue[1].want).toBeNull()
  })

  it('nextWeek не выкорчёвывает грядки', () => {
    useGameStore.setState({
      day: 7,
      phase: 'truck',
      truck: mkTruck({ ended: true }),
      slots: S().slots.map((s, i) =>
        i === 0 ? { ...s, crop: 'tomato' as const, stage: 2 as const } : s,
      ),
    })
    S().nextWeek()
    expect(S().slots[0].crop).toBe('tomato')
    expect(S().slots[0].stage).toBe(2)
  })

  it('nextWeek возвращает к дню 1, деньги остаются', () => {
    useGameStore.setState({ day: 7, phase: 'truck', money: 20, truck: mkTruck({ ended: true }) })
    S().nextWeek()
    expect(S().day).toBe(1)
    expect(S().phase).toBe('farm')
    expect(S().truck).toBeNull()
    expect(S().money).toBe(20)
  })
})

describe('музыка', () => {
  // resetGame намеренно не трогает флаг, поэтому beforeEach его не вернёт:
  // без этого тесты зависели бы от порядка выполнения.
  afterEach(() => useGameStore.setState({ musicOn: true }))

  it('по умолчанию включена', () => {
    expect(S().musicOn).toBe(true)
  })

  it('toggleMusic переключает флаг', () => {
    S().toggleMusic()
    expect(S().musicOn).toBe(false)
    S().toggleMusic()
    expect(S().musicOn).toBe(true)
  })

  it('переживает сброс игры: это настройка звука, а не прогресс', () => {
    S().toggleMusic()
    S().resetGame()
    expect(S().musicOn).toBe(false)
    expect(S().day).toBe(1)
  })
})

describe('лесные находки и рецепты', () => {
  it('на старте известны только базовые рецепты', () => {
    expect(S().knownRecipes).toEqual(BASE_RECIPE_IDS)
    expect(S().inventory.mushroom).toBe(0)
    expect(S().inventory.egg).toBe(0)
  })

  it('первый гриб кладётся в сумку и открывает грибной суп', () => {
    S().collectForage('mushroom:0', 'mushroom')
    expect(S().inventory.mushroom).toBe(1)
    expect(S().knownRecipes).toContain('mushroom_soup')
    const kinds = S().notices.map((n) => n.kind)
    expect(kinds).toContain('foraged')
    expect(kinds).toContain('recipe-found')
  })

  it('первое яйцо открывает яичницу', () => {
    S().collectForage('egg:0', 'egg')
    expect(S().inventory.egg).toBe(1)
    expect(S().knownRecipes).toContain('omelette')
  })

  it('второй гриб рецепт не переоткрывает', () => {
    S().collectForage('mushroom:0', 'mushroom')
    S().collectForage('mushroom:1', 'mushroom')
    expect(S().inventory.mushroom).toBe(2)
    expect(S().knownRecipes.filter((r) => r === 'mushroom_soup')).toHaveLength(1)
    expect(S().notices.at(-1)!.kind).toBe('foraged')
  })

  it('одну и ту же точку дважды за день не собрать', () => {
    S().collectForage('mushroom:0', 'mushroom')
    S().collectForage('mushroom:0', 'mushroom')
    expect(S().inventory.mushroom).toBe(1)
    expect(S().takenForage).toEqual(['mushroom:0'])
  })

  it('гриб отрастает за ночь, если бросок удался', () => {
    S().collectForage('mushroom:0', 'mushroom')
    vi.spyOn(Math, 'random').mockReturnValue(0) // бросок меньше любого шанса
    S().endDay()
    expect(S().takenForage).toEqual([])
    expect(S().knownRecipes).toContain('mushroom_soup')
    S().collectForage('mushroom:0', 'mushroom')
    expect(S().inventory.mushroom).toBe(2)
  })

  it('не отрастает, если бросок не удался: точка остаётся пустой', () => {
    S().collectForage('mushroom:0', 'mushroom')
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    S().endDay()
    expect(S().takenForage).toEqual(['mushroom:0'])
    S().collectForage('mushroom:0', 'mushroom')
    expect(S().inventory.mushroom).toBe(1) // собрать нечего
  })

  it('яйцо возвращается вдвое охотнее гриба', () => {
    expect(regrowChance('egg:0')).toBe(EGG_REGROW)
    expect(regrowChance('mushroom:2')).toBe(MUSHROOM_REGROW)
    expect(EGG_REGROW).toBeGreaterThan(MUSHROOM_REGROW)
    // Бросок 0.3 проходит для яйца (0.5) и не проходит для гриба (0.2).
    expect(regrowForage(['egg:0', 'mushroom:0'], () => 0.3)).toEqual(['mushroom:0'])
  })

  it('regrowForage не трогает то, что не собирали', () => {
    expect(regrowForage([], () => 0)).toEqual([])
  })

  it('новая неделя поднимает лес целиком, но рецепты не забывает', () => {
    S().collectForage('egg:0', 'egg')
    S().nextWeek()
    expect(S().takenForage).toEqual([])
    expect(S().knownRecipes).toContain('omelette')
  })

  it('грибной суп готовится из находок и моркови', () => {
    useGameStore.setState({
      phase: 'truck',
      money: 0,
      knownRecipes: [...BASE_RECIPE_IDS, 'mushroom_soup'],
      inventory: bag({ mushroom: 2, carrot: 1 }),
      truck: {
        timeLeft: 60,
        queue: [{ id: 1, want: 'mushroom_soup', patience: 16, maxPatience: 16 }],
        served: 0,
        spawnTimer: 0,
        nextSpawnIn: 2.5,
        ended: false,
        nextCustomerId: 2,
      },
    })
    expect(S().serveCustomer('mushroom_soup')).toBe('ok')
    expect(S().money).toBe(RECIPES.mushroom_soup.price)
    expect(S().inventory.mushroom).toBe(0)
    expect(S().inventory.carrot).toBe(0)
  })

  it('клиенты не заказывают того, чего герой не знает', () => {
    useGameStore.setState({
      phase: 'truck',
      knownRecipes: ['soup'],
      truck: {
        timeLeft: 60,
        queue: [],
        served: 0,
        spawnTimer: 10,
        nextSpawnIn: 0,
        ended: false,
        nextCustomerId: 1,
      },
    })
    S().tickTruck(0.1)
    // Заказ клиент делает у окна — там же и выбирает из освоенных рецептов.
    S().customerReady(S().truck!.queue[0].id)
    expect(S().truck!.queue.map((c) => c.want)).toEqual(['soup'])
  })
})
