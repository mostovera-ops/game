/**
 * engine/index.ts — барель движка: контракты систем + BackendAdapter + чистые формулы.
 * Импорт: `import type { FarmSystem, BackendAdapter } from '@/engine'`.
 */

export * from './contracts'
export * as econ from './econ'
export * as craft from './craft'
export * as clock from './clock'
export * as inventory from './inventory'
export * as fair from './fair'
export * as progression from './progression'
export * as expedition from './expedition'
export * as mailForaging from './mail-foraging'
