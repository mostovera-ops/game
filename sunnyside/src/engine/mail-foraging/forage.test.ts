import { describe, it, expect } from 'vitest'
import { forageDayIndex } from './forage'
import { FORAGE_RESPAWN_OFFSET_MS, DAY_MS } from './constants'

describe('forageDayIndex', () => {
  it('одинаковый день фуражинга по обе стороны от 06:00 UTC даёт один индекс', () => {
    const dayStart = FORAGE_RESPAWN_OFFSET_MS + 5 * DAY_MS
    expect(forageDayIndex(dayStart)).toBe(5)
    expect(forageDayIndex(dayStart + DAY_MS - 1)).toBe(5)
  })

  it('момент ДО 06:00 UTC относится к предыдущим суткам фуражинга', () => {
    const justBefore = FORAGE_RESPAWN_OFFSET_MS + 5 * DAY_MS - 1
    expect(forageDayIndex(justBefore)).toBe(4)
  })

  it('пересечение границы 06:00 UTC увеличивает индекс на 1', () => {
    const before = FORAGE_RESPAWN_OFFSET_MS + 10 * DAY_MS - 1
    const after = FORAGE_RESPAWN_OFFSET_MS + 10 * DAY_MS
    expect(forageDayIndex(after) - forageDayIndex(before)).toBe(1)
  })
})
