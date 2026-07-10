import { describe, expect, it } from 'vitest'
import { ALERT, SAFE, awayFrom, nextMode, reflectAtEdge, type Mode } from './boarRules'

describe('nextMode', () => {
  it('пасётся, пока герой далеко', () => {
    expect(nextMode('wander', ALERT + 0.1, 0)).toBe('wander')
  })

  it('пугается, когда герой подошёл ближе ALERT', () => {
    expect(nextMode('wander', ALERT - 0.1, 0)).toBe('startle')
  })

  it('стоит столбом, пока не истекла пауза испуга', () => {
    expect(nextMode('startle', 1, 0.2)).toBe('startle')
  })

  it('срывается в бег, когда пауза истекла', () => {
    expect(nextMode('startle', 1, 0)).toBe('flee')
  })

  it('бежит, пока герой не отстал на SAFE', () => {
    expect(nextMode('flee', SAFE - 0.1, 0)).toBe('flee')
  })

  it('успокаивается, отбежав дальше SAFE', () => {
    expect(nextMode('flee', SAFE + 0.1, 0)).toBe('wander')
  })

  it('не дёргается на границе: убежав за ALERT, всё ещё бежит', () => {
    // Между ALERT и SAFE кабан не переобувается — иначе мигал бы каждый кадр.
    expect(nextMode('flee', ALERT + 0.1, 0)).toBe('flee')
  })

  it('весь цикл: увидел → развернулся → убежал → успокоился', () => {
    let mode: Mode = 'wander'
    mode = nextMode(mode, 4, 0)
    expect(mode).toBe('startle')
    mode = nextMode(mode, 4, 0.2)
    expect(mode).toBe('startle')
    mode = nextMode(mode, 4, 0)
    expect(mode).toBe('flee')
    mode = nextMode(mode, 8, 0)
    expect(mode).toBe('flee')
    mode = nextMode(mode, 12, 0)
    expect(mode).toBe('wander')
  })
})

describe('awayFrom', () => {
  it('смотрит прочь от героя и нормирован', () => {
    const d = awayFrom({ x: 3, z: 0 }, { x: 0, z: 0 })
    expect(d).toEqual({ x: 1, z: 0 })
  })

  it('нормирует по диагонали', () => {
    const d = awayFrom({ x: 3, z: 4 }, { x: 0, z: 0 })
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9)
    expect(d.x).toBeCloseTo(0.6, 9)
  })

  it('не делит на ноль, когда герой ровно на кабане', () => {
    const d = awayFrom({ x: 1, z: 1 }, { x: 1, z: 1 })
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9)
  })
})

describe('reflectAtEdge', () => {
  const dir = { x: 1, z: 1 }

  it('внутри поля направление не трогает', () => {
    expect(reflectAtEdge(dir, 5, 5, 19)).toEqual(dir)
  })

  it('за краем по X разворачивает только X', () => {
    expect(reflectAtEdge(dir, 20, 5, 19)).toEqual({ x: -1, z: 1 })
  })

  it('в углу разворачивает обе оси', () => {
    expect(reflectAtEdge(dir, 20, -20, 19)).toEqual({ x: -1, z: -1 })
  })
})
