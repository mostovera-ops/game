/**
 * catalog.test.ts — Emote Stickers: ровно 12 базовых (11-town §3.9, гипотеза),
 * уникальные ключи, оба языка заполнены.
 */
import { describe, it, expect } from 'vitest'
import { EMOTE_STICKERS } from './catalog'

describe('EMOTE_STICKERS', () => {
  it('ровно 12 базовых стикеров', () => {
    expect(EMOTE_STICKERS.length).toBe(12)
  })

  it('ключи уникальны', () => {
    expect(new Set(EMOTE_STICKERS.map((s) => s.key)).size).toBe(EMOTE_STICKERS.length)
  })

  it('каждый стикер имеет глиф и оба языка ярлыка', () => {
    for (const s of EMOTE_STICKERS) {
      expect(s.glyph.length).toBeGreaterThan(0)
      expect(s.label.en.length).toBeGreaterThan(0)
      expect(s.label.ru.length).toBeGreaterThan(0)
    }
  })
})
