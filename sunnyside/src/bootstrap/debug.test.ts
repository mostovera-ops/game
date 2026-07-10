/**
 * debug.test.ts — юнит парсера дебаг-параметров (пример для агентов; node без браузера).
 */

import { describe, it, expect } from 'vitest'
import { parseDebugParams } from './debug'

describe('parseDebugParams', () => {
  it('пустой search → пустой объект', () => {
    expect(parseDebugParams('')).toEqual({})
  })
  it('валидные screen/seed/net', () => {
    expect(parseDebugParams('?screen=fair&seed=42&net=offline')).toEqual({
      screen: 'fair',
      seed: 42,
      net: 'offline',
    })
  })
  it('невалидный screen отбрасывается', () => {
    expect(parseDebugParams('?screen=nope')).toEqual({})
  })
  it('невалидный seed отбрасывается', () => {
    expect(parseDebugParams('?seed=abc')).toEqual({})
  })
  it('town/street/clock прокидываются как строки', () => {
    expect(parseDebugParams('?town=demo&street=maple&clock=sat_fair')).toEqual({
      town: 'demo',
      street: 'maple',
      clock: 'sat_fair',
    })
  })
})
