/**
 * assetMap.test.ts — мапперы доменных ключей в id заглушек реестра (node, без браузера).
 */

import { describe, it, expect } from 'vitest'
import { getAsset } from '@/assets/placeholders/registry'
import {
  animalAssetId,
  cropAssetId,
  machineAssetId,
  plotAssetId,
  CROP_ASSET_FALLBACK,
  MACHINE_ASSET_FALLBACK,
  ANIMAL_ASSET_BY_KIND,
} from './assetMap'

describe('plotAssetId', () => {
  it('маппит тир 0..3 в plot_field_*', () => {
    expect(plotAssetId(0)).toBe('plot_field_basic')
    expect(plotAssetId(1)).toBe('plot_field_tilled')
    expect(plotAssetId(2)).toBe('plot_field_raised')
    expect(plotAssetId(3)).toBe('plot_field_irrigated')
  })
  it('клампит вне диапазона и режет дробные', () => {
    expect(plotAssetId(-5)).toBe('plot_field_basic')
    expect(plotAssetId(99)).toBe('plot_field_irrigated')
    expect(plotAssetId(1.9)).toBe('plot_field_tilled')
  })
  it('орчард — отдельный слот', () => {
    expect(plotAssetId(0, true)).toBe('plot_orchard')
  })
  it('все id грядок существуют в реестре', () => {
    for (const t of [0, 1, 2, 3]) expect(getAsset(plotAssetId(t))).toBeDefined()
    expect(getAsset('plot_orchard')).toBeDefined()
  })
})

describe('cropAssetId', () => {
  it('пустой ключ → null (пустая грядка, крест не рисуем)', () => {
    expect(cropAssetId(undefined)).toBeNull()
    expect(cropAssetId('')).toBeNull()
  })
  it('crop_* проходит как есть', () => {
    expect(cropAssetId('crop_tomato')).toBe('crop_tomato')
    expect(cropAssetId('crop_wheat')).toBe('crop_wheat')
  })
  it('seed_* нормализуется в crop_*', () => {
    expect(cropAssetId('seed_lettuce')).toBe('crop_lettuce')
  })
  it('голый ключ достраивается до crop_*', () => {
    expect(cropAssetId('potato')).toBe('crop_potato')
  })
  it('неизвестная культура → фолбэк', () => {
    expect(cropAssetId('crop_dragonfruit')).toBe(CROP_ASSET_FALLBACK)
  })
  it('итоговый id всегда есть в реестре', () => {
    for (const k of ['crop_tomato', 'seed_lettuce', 'potato', 'crop_unknownX']) {
      const id = cropAssetId(k)
      expect(id).not.toBeNull()
      expect(getAsset(id as string)).toBeDefined()
    }
  })
})

describe('animalAssetId', () => {
  it('маппит вид в an_* и все существуют в реестре', () => {
    expect(animalAssetId('chicken')).toBe('an_hen')
    expect(animalAssetId('cow')).toBe('an_cow')
    for (const kind of Object.keys(ANIMAL_ASSET_BY_KIND) as (keyof typeof ANIMAL_ASSET_BY_KIND)[]) {
      expect(getAsset(animalAssetId(kind))).toBeDefined()
    }
  })
})

describe('machineAssetId', () => {
  it('известный станок проходит как есть', () => {
    expect(machineAssetId('mch_oven')).toBe('mch_oven')
  })
  it('неизвестный станок → фолбэк-гриль', () => {
    expect(machineAssetId('mch_teleporter')).toBe(MACHINE_ASSET_FALLBACK)
  })
  it('итоговый id есть в реестре', () => {
    expect(getAsset(machineAssetId('mch_churn'))).toBeDefined()
    expect(getAsset(machineAssetId('mch_unknown'))).toBeDefined()
  })
})
