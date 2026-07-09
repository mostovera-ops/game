import { beforeEach, describe, expect, it } from 'vitest'
import { BEDS, RECIPES, SLOTS_PER_BED, SLOT_IDS, bedOf, useGameStore } from './store'

const S = () => useGameStore.getState()
const slot = (id: string) => S().slots.find((x) => x.id === id)!

beforeEach(() => {
  S().resetGame()
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
