import { describe, it, expect } from 'vitest'
import {
  POSTCARD_SETS,
  isPostcardSetComplete,
  postcardSetProgress,
  completedPostcardSets,
  allPostcardSetProgress,
} from './postcards'
import { postcards } from '@/data/catalogs/postcards'

describe('POSTCARD_SETS (17-collections §3.3)', () => {
  it('содержит ровно 5 сетов канона', () => {
    expect(POSTCARD_SETS.map((s) => s.key).sort()).toEqual(
      [
        'postcards_coast_to_coast',
        'postcards_deep_south',
        'postcards_full_album',
        'postcards_heartland',
        'postcards_home_region',
      ].sort(),
    )
  })

  it('все члены сетов существуют в каталоге открыток', () => {
    const catalogKeys = new Set(postcards.map((p) => p.key))
    for (const set of POSTCARD_SETS) {
      for (const member of set.members) {
        expect(catalogKeys.has(member)).toBe(true)
      }
    }
  })

  it('Full Album требует все 8 открыток волны 1', () => {
    const fullAlbum = POSTCARD_SETS.find((s) => s.key === 'postcards_full_album')!
    expect(fullAlbum.members.length).toBe(8)
  })

  it('Heartland — 2 члена, Deep South — 3, Coast to Coast — 2', () => {
    const byKey = new Map(POSTCARD_SETS.map((s) => [s.key, s]))
    expect(byKey.get('postcards_heartland')?.members.length).toBe(2)
    expect(byKey.get('postcards_deep_south')?.members.length).toBe(3)
    expect(byKey.get('postcards_coast_to_coast')?.members.length).toBe(2)
  })
})

describe('isPostcardSetComplete / postcardSetProgress', () => {
  it('пустое владение — ни один сет не собран', () => {
    const owned = new Set<string>()
    for (const set of POSTCARD_SETS) {
      expect(isPostcardSetComplete(owned, set)).toBe(false)
    }
  })

  it('частичное владение Heartland — не собран, прогресс 1/2', () => {
    const heartland = POSTCARD_SETS.find((s) => s.key === 'postcards_heartland')!
    const owned = new Set<string>([heartland.members[0] as string])
    expect(isPostcardSetComplete(owned, heartland)).toBe(false)
    const progress = postcardSetProgress(owned, heartland)
    expect(progress.have).toBe(1)
    expect(progress.total).toBe(2)
    expect(progress.complete).toBe(false)
  })

  it('полное владение Heartland — собран', () => {
    const heartland = POSTCARD_SETS.find((s) => s.key === 'postcards_heartland')!
    const owned = new Set(heartland.members)
    expect(isPostcardSetComplete(owned, heartland)).toBe(true)
    expect(postcardSetProgress(owned, heartland).complete).toBe(true)
  })

  it('владение всеми 8 открытками собирает и Full Album, и все под-сеты', () => {
    const owned = new Set(postcards.map((p) => p.key))
    const completed = completedPostcardSets(owned).map((s) => s.key)
    expect(completed.sort()).toEqual(POSTCARD_SETS.map((s) => s.key).sort())
  })
})

describe('allPostcardSetProgress', () => {
  it('возвращает запись на каждый сет канона', () => {
    const progress = allPostcardSetProgress(new Set())
    expect(progress.length).toBe(POSTCARD_SETS.length)
    expect(progress.every((p) => p.have === 0)).toBe(true)
  })
})
