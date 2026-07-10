import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXPRESSION_MS,
  faceForNotice,
  getExpression,
  setExpression,
} from './heroFace'

beforeEach(() => {
  vi.useFakeTimers()
  setExpression('neutral')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('мимика героя', () => {
  it('погибший урожай злит', () => {
    faceForNotice('withered', 2)
    expect(getExpression()).toBe('angry')
  })

  it('сорванная продажа злит', () => {
    faceForNotice('wrong-dish')
    expect(getExpression()).toBe('angry')
    setExpression('neutral')
    faceForNotice('no-customer')
    expect(getExpression()).toBe('angry')
  })

  it('нет ингредиентов — грустит', () => {
    faceForNotice('no-ingredients')
    expect(getExpression()).toBe('sad')
  })

  it('удачный сбор радует, обычный лицо не трогает', () => {
    faceForNotice('harvest', 2)
    expect(getExpression()).toBe('happy')

    setExpression('neutral')
    faceForNotice('harvest', 1)
    expect(getExpression()).toBe('neutral')
  })

  it('событие без гримасы лицо не меняет', () => {
    setExpression('happy')
    faceForNotice('too-far')
    expect(getExpression()).toBe('happy')
  })

  it('гримаса сама сходит с лица', () => {
    faceForNotice('withered')
    vi.advanceTimersByTime(EXPRESSION_MS - 1)
    expect(getExpression()).toBe('angry')
    vi.advanceTimersByTime(1)
    expect(getExpression()).toBe('neutral')
  })

  it('новая гримаса перебивает прежнюю и заводит таймер заново', () => {
    faceForNotice('withered')
    vi.advanceTimersByTime(EXPRESSION_MS - 100)
    faceForNotice('no-ingredients')
    expect(getExpression()).toBe('sad')

    // Старый таймер не должен сбросить лицо через оставшиеся 100 мс.
    vi.advanceTimersByTime(200)
    expect(getExpression()).toBe('sad')
  })
})
