import { describe, expect, it } from 'vitest'
import { refusal, slotLabel } from './slotText'
import type { Slot } from '../game/store'

const empty: Slot = { id: '0:0', crop: null, stage: 0, watered: false, lucky: false }
const sprout: Slot = { ...empty, crop: 'tomato', stage: 0 }

describe('реплика на бесполезный клик по грядке', () => {
  it('семян нет ни одного — герой шлёт себя в лавку, чем бы он ни держал', () => {
    const buy = 'У меня нет семян для посадки. Нужно купить.'
    expect(refusal(empty, 'seed', false, false)).toBe(buy)
    expect(refusal(empty, 'hand', false, false)).toBe(buy)
    expect(refusal(empty, 'can', false, false)).toBe(buy)
  })

  it('семена есть, но в руках не они — предлагает их взять', () => {
    expect(refusal(empty, 'hand', true, true)).toBe('Мне надо выбрать семена для посадки.')
  })

  it('кончился только выбранный сорт — это не «нет семян»', () => {
    expect(refusal(empty, 'seed', false, true)).toBe('Эти семена кончились. Надо выбрать другие.')
  })

  it('семена в руках есть — клик сработает, реплики нет', () => {
    expect(refusal(empty, 'seed', true, true)).toBeNull()
  })

  it('рука по неполитому ростку напоминает и про полив', () => {
    expect(refusal(sprout, 'hand', true, true)).toBe(
      'Пока рано. Урожай будет через 2 дня. Сейчас его надо полить.',
    )
    expect(refusal({ ...sprout, watered: true, stage: 1 }, 'hand', true, true)).toBe(
      'Пока рано. Урожай будет через 1 день.',
    )
  })

  it('созревшее собирается молча', () => {
    expect(refusal({ ...sprout, stage: 2 }, 'hand', true, true)).toBeNull()
  })
})

describe('подпись грядки по ховеру', () => {
  it('пустая грядка зовёт посадить и молчит про полив', () => {
    expect(slotLabel(empty)).toEqual({
      title: 'Пустая грядка',
      lines: ['Тут можно посадить семена'],
    })
  })

  it('растущему полив важен', () => {
    expect(slotLabel(sprout).lines).toEqual(['До урожая: 2 дня', '💧 Не полито'])
    expect(slotLabel({ ...sprout, watered: true }).lines).toEqual([
      'До урожая: 2 дня',
      '✅ Полито',
    ])
  })

  it('созревшему полив уже не нужен', () => {
    expect(slotLabel({ ...sprout, stage: 2 }).lines).toEqual(['Созрело — можно собирать'])
  })
})
