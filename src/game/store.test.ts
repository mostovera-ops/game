import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEDS, RECIPES, SLOTS_PER_BED, SLOT_IDS, bedOf, useGameStore } from './store'

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
    S().endDay()
    expect(slot(id).stage).toBe(2)

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

  it('water красит слот только пока растение растёт', () => {
    const id = SLOT_IDS[0]
    S().water(id) // пустой слот
    expect(slot(id).watered).toBe(false)

    S().plant(id)
    S().water(id)
    expect(slot(id).watered).toBe(true)

    S().endDay()
    S().water(id)
    S().endDay() // stage 2 — созрело
    expect(slot(id).stage).toBe(2)

    S().water(id) // созревшее не поливается
    expect(slot(id).watered).toBe(false)
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
      inventory: { carrot: 0, greens: 0, tomato: 0 },
      truck: {
        timeLeft: 60, queue: [], served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('no-customer')

    useGameStore.setState({
      truck: {
        timeLeft: 60,
        queue: [{ want: 'salad', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('wrong-dish')
    expect(S().notices.at(-1)!.recipe).toBe('salad')

    useGameStore.setState({
      truck: {
        timeLeft: 60,
        queue: [{ want: 'soup', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false,
      },
    })
    S().serveCustomer('soup')
    expect(S().notices.at(-1)!.kind).toBe('no-ingredients')
  })

  it('успешная продажа сообщает цену', () => {
    useGameStore.setState({
      phase: 'truck',
      inventory: { carrot: 2, greens: 0, tomato: 0 },
      truck: {
        timeLeft: 60,
        queue: [{ want: 'soup', patience: 16, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 2.5, ended: false,
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
        queue: [{ want: 'taco', patience: 0.5, maxPatience: 16 }],
        served: 0, spawnTimer: 0, nextSpawnIn: 99, ended: false,
      },
    })
    S().tickTruck(1)
    expect(S().notices.at(-1)!.kind).toBe('customer-left')

    useGameStore.setState({
      truck: {
        timeLeft: 0.5, queue: [], served: 0, spawnTimer: 0, nextSpawnIn: 99, ended: false,
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
      inventory: { carrot: 2, greens: 0, tomato: 0 },
    })
    const ok = S().serve('soup')
    expect(ok).toBe(true)
    expect(S().inventory.carrot).toBe(0)
    expect(S().money).toBe(RECIPES.soup.price)
  })

  it('serve не проходит без ингредиентов', () => {
    useGameStore.setState({
      phase: 'truck',
      inventory: { carrot: 1, greens: 0, tomato: 0 },
    })
    const ok = S().serve('soup')
    expect(ok).toBe(false)
    expect(S().money).toBe(0)
  })
})

describe('день фудтрака (Task 3)', () => {
  const mkTruck = (over = {}) => ({
    timeLeft: 60,
    queue: [] as { want: 'salad' | 'soup' | 'taco'; patience: number; maxPatience: number }[],
    served: 0,
    spawnTimer: 0,
    nextSpawnIn: 2.5,
    ended: false,
    ...over,
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

  it('время вышло → truck.ended', () => {
    useGameStore.setState({ phase: 'truck', truck: mkTruck({ timeLeft: 0.5 }) })
    S().tickTruck(1)
    expect(S().truck!.ended).toBe(true)
  })

  it('serveCustomer продаёт верное блюдо и двигает очередь', () => {
    useGameStore.setState({
      phase: 'truck',
      money: 0,
      inventory: { carrot: 2, greens: 0, tomato: 0 },
      truck: mkTruck({ queue: [{ want: 'soup', patience: 16, maxPatience: 16 }] }),
    })
    expect(S().serveCustomer('soup')).toBe('ok')
    expect(S().money).toBe(RECIPES.soup.price)
    expect(S().truck!.served).toBe(1)
    expect(S().truck!.queue.length).toBe(0)
  })

  it('serveCustomer отклоняет: нет клиента / не то блюдо / нет ингредиентов', () => {
    useGameStore.setState({ phase: 'truck', inventory: { carrot: 0, greens: 0, tomato: 0 }, truck: mkTruck() })
    expect(S().serveCustomer('soup')).toBe('no-customer')
    useGameStore.setState({ truck: mkTruck({ queue: [{ want: 'salad', patience: 16, maxPatience: 16 }] }) })
    expect(S().serveCustomer('soup')).toBe('wrong-dish')
    useGameStore.setState({
      inventory: { carrot: 1, greens: 1, tomato: 1 },
      truck: mkTruck({ queue: [{ want: 'soup', patience: 16, maxPatience: 16 }] }),
    })
    expect(S().serveCustomer('soup')).toBe('no-ingredients')
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
