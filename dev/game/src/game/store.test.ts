import { beforeEach, describe, expect, it } from 'vitest'
import { RECIPES, SLOT_IDS, useGameStore } from './store'

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
