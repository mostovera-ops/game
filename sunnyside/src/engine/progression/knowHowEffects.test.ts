/**
 * knowHowEffects.test.ts — ссылочная целостность числовых эффектов know-how с контент-
 * каталогом (data/catalogs/knowHow.ts). Гарантирует, что ключи в KNOW_HOW_NODE_EFFECTS
 * не «дрейфуют» от реальных узлов (§3.2.2–3.2.5) — опечатка в ключе провалит тест.
 *
 * Тест ИМПОРТИРУЕТ каталог (это тест — граница engine→types не нарушается в проде;
 * сам модуль knowHowEffects.ts автономен и каталог не тянет).
 */

import { describe, it, expect } from 'vitest'
import { knowHowNodes } from '@/data/catalogs/knowHow'
import { KNOW_HOW_NODE_EFFECTS } from './knowHowEffects'

const catalogKeys = new Set(knowHowNodes.map((n) => n.key))

describe('KNOW_HOW_NODE_EFFECTS ↔ каталог knowHow', () => {
  it('каждый ключ эффекта существует в каталоге узлов', () => {
    for (const key of Object.keys(KNOW_HOW_NODE_EFFECTS)) {
      expect(catalogKeys.has(key), `узел эффекта отсутствует в каталоге: ${key}`).toBe(true)
    }
  })

  it('каталог содержит ровно 60 узлов (4 ветки × 15)', () => {
    expect(knowHowNodes).toHaveLength(60)
  })

  it('каждый вклад имеет ненулевую величину', () => {
    for (const contribs of Object.values(KNOW_HOW_NODE_EFFECTS)) {
      for (const c of contribs) expect(c.value).not.toBe(0)
    }
  })
})
