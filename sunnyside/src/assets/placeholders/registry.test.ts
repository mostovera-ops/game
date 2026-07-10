/**
 * registry.test.ts — sanity-тесты мастер-реестра заглушек (22-audio-visual.md §7).
 * Чистая логика (без three/canvas) — node-тестируемо, как engine/econ.
 */

import { describe, expect, it } from 'vitest'
import { ASSET_IDS, assetRegistry, categoryCounts, color, getAsset, listByCategory } from './registry'

describe('assetRegistry — покрытие и целостность', () => {
  it('id уникальны и реестр непуст', () => {
    expect(ASSET_IDS.length).toBe(new Set(ASSET_IDS).size)
    expect(ASSET_IDS.length).toBeGreaterThan(0)
  })

  it('покрытие в требуемом диапазоне 150-300 позиций (задача Фазы D)', () => {
    expect(ASSET_IDS.length).toBeGreaterThanOrEqual(150)
    expect(ASSET_IDS.length).toBeLessThanOrEqual(300)
  })

  it('каждая запись несёт минимальный набор полей (id/label/category/usedIn/specSource/final)', () => {
    for (const id of ASSET_IDS) {
      const entry = getAsset(id)
      expect(entry).toBeDefined()
      expect(entry?.id).toBe(id)
      expect(entry?.label.length).toBeGreaterThan(0)
      expect(entry?.usedIn.length).toBeGreaterThan(0)
      expect(entry?.specSource.length).toBeGreaterThan(0)
      expect(entry?.final.style.length).toBeGreaterThan(0)
      expect(entry?.final.format.length).toBeGreaterThan(0)
    }
  })

  it('неизвестный id даёт undefined, а не исключение (V3 22-av §8)', () => {
    expect(getAsset('does_not_exist_xyz')).toBeUndefined()
  })

  it('categoryCounts суммируется в общее число id', () => {
    const counts = categoryCounts()
    const sum = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(sum).toBe(ASSET_IDS.length)
  })

  it('listByCategory возвращает только записи своей категории', () => {
    for (const entry of listByCategory('model')) {
      expect(entry.category).toBe('model')
    }
  })

  it('canon-ключи из спек присутствуют (buildings/machines/animals/town projects)', () => {
    for (const id of [
      'bld_house',
      'bld_diner',
      'bld_apiary',
      'mch_grill',
      'mch_steam_kettle',
      'an_hen',
      'an_turkey',
      'an_sheep',
      'tp_ferris_wheel_stage3',
      'st_california',
      'toy_diner_mascots_chase',
      'cos_xmas_55',
      'npc_grimsby',
      'staff_hank',
    ]) {
      expect(assetRegistry[id], `ожидали ключ ${id} в реестре`).toBeDefined()
    }
  })

  it('color() резолвит палитру канона и даёт magenta-маркер на неизвестном ключе (§8 V3)', () => {
    expect(color('pal_cherry')).toBe('#C33B3B')
    expect(color('nope_not_a_color')).toBe('#ff00ff')
  })

  it('placeholder-геометрия задана для всех категорий 3D (model/vfx)', () => {
    for (const entry of [...listByCategory('model'), ...listByCategory('vfx')]) {
      expect(entry.placeholder, `${entry.id} должен иметь placeholder-геометрию`).toBeDefined()
    }
  })
})
