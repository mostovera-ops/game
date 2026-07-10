/**
 * layout.ts — детерминированная планировка фермы (02-farm §3.1 «модульные A-слоты»).
 *
 * ЗАЧЕМ: слоты грядок — фиксированная сетка (Вариант A, D2 канона), не свободный билд.
 * Позиции построек/станков/животных заданы художником уровня; здесь — их числовая
 * гипотеза, вынесенная в чистый модуль ради node-тестов (стабильность сетки).
 *
 * Оси сцены: X — вправо, Z — к камере (3/4-ракурс, App camera [10,9,12]). Y — вверх.
 * Постройки стоят задним рядом (−Z), поле грядок — ближе к камере (+Z).
 *
 * ГРАНИЦА: чистые функции, ноль three/react.
 */

import type { BuildingKey } from '@/types'

/** Шаг сетки грядок в юнитах (расстояние между центрами слотов). */
export const PLOT_SPACING = 1.7

/** Слотов в ряду (блок земли = 5 слотов, 02-farm §3.2). */
export const PLOT_COLS = 5

/** Левый-дальний угол поля грядок (слот 0). Поле уходит вправо (X+) и к камере (Z+). */
export const FIELD_ORIGIN: readonly [number, number, number] = [-3.4, 0, 0.5]

/**
 * Позиция центра грядки по индексу слота (A-слот). Раскладка змейкой по рядам:
 * slot 0..4 — первый ряд, 5..9 — второй и т.д. Y=0 (грядка лежит на земле).
 */
export function plotGridPosition(slot: number, cols: number = PLOT_COLS): [number, number, number] {
  const s = Math.max(0, Math.floor(slot))
  const c = Math.max(1, Math.floor(cols))
  const row = Math.floor(s / c)
  const col = s % c
  const [ox, oy, oz] = FIELD_ORIGIN
  return [ox + col * PLOT_SPACING, oy, oz + row * PLOT_SPACING]
}

/**
 * Фиксированные позиции построек (02-farm §3.1). Y — половина высоты заглушки, чтобы
 * коробка стояла на земле, а не тонула. Значения — гипотеза планировки MVP.
 */
export const BUILDING_LAYOUT: Partial<Record<BuildingKey, [number, number, number]>> = {
  bld_house: [-9, 1, -7],
  bld_barn: [-4, 1.5, -8],
  bld_coop: [0.5, 0.8, -8.5],
  bld_kitchen: [5, 1, -6],
  bld_diner: [9, 1, -4.5],
  bld_garage: [-9, 1, 2.5],
  bld_silo: [10.5, 2, -8.5],
  bld_icehouse: [7.5, 1, -9],
  bld_apiary: [-7, 0.45, 3.5],
}

/** Постройки, клик по которым ведёт в кухонный оверлей (04-machines / 19-ui-ux §3.3). */
export const KITCHEN_BUILDINGS: readonly BuildingKey[] = ['bld_kitchen', 'bld_diner']

/** Постройки, клик по которым открывает Storage (F4, 19-ui-ux §3.2 — Silo & Icehouse). */
export const STORAGE_BUILDINGS: readonly BuildingKey[] = ['bld_silo', 'bld_icehouse']

/** Якорь ряда станков (перед кухней). Станки выстраиваются вправо по X. */
export const MACHINE_ANCHOR: readonly [number, number, number] = [3.4, 0.5, -3.6]
export const MACHINE_SPACING = 1.7

/** Позиция станка №index в ряду перед кухней. */
export function machinePosition(index: number): [number, number, number] {
  const [ax, ay, az] = MACHINE_ANCHOR
  return [ax + Math.max(0, Math.floor(index)) * MACHINE_SPACING, ay, az]
}

/** Якорь двора животных (перед амбаром/курятником). */
export const ANIMAL_ANCHOR: readonly [number, number, number] = [-5.5, 0.4, -5]
export const ANIMAL_SPACING = 2.2

/** Позиция животного №index во дворе. */
export function animalPosition(index: number): [number, number, number] {
  const [ax, ay, az] = ANIMAL_ANCHOR
  const i = Math.max(0, Math.floor(index))
  // Лёгкий зигзаг по Z, чтобы животные не стояли в идеальную линию.
  return [ax + i * ANIMAL_SPACING, ay, az + (i % 2 === 0 ? 0 : 0.8)]
}

/** Декоративные деревья по углам участка (env-пропсы, инстансинг-кандидаты §3.9). */
export const ENV_TREE_POSITIONS: readonly [number, number, number][] = [
  [-11, 0.7, 6],
  [11, 0.7, 6],
  [-12, 0.7, -6],
  [12.5, 0.7, -4],
]

export const ENV_BUSH_POSITIONS: readonly [number, number, number][] = [
  [-9.5, 0.3, 5],
  [9.5, 0.3, 5],
  [6, 0.3, 3.5],
]
