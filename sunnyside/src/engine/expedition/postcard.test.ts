import { describe, it, expect } from 'vitest'
import { duplicatePostcardBucks, shouldAwardPostcard } from './postcard'

describe('engine/expedition/postcard', () => {
  it('duplicatePostcardBucks = 15 × tier (§3.3)', () => {
    expect(duplicatePostcardBucks(3, false)).toBe(45)
    expect(duplicatePostcardBucks(4, false)).toBe(60)
    expect(duplicatePostcardBucks(5, false)).toBe(75)
  })

  it('road_local_fair doubles the conversion (§3.8)', () => {
    expect(duplicatePostcardBucks(4, true)).toBe(120)
  })

  it('shouldAwardPostcard: awarded unless already owned (X5/X9 — never skipped)', () => {
    expect(shouldAwardPostcard(false)).toBe(true)
    expect(shouldAwardPostcard(true)).toBe(false)
  })
})
