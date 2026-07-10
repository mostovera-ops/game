/**
 * types/index.ts — единый барель доменных типов Sunnyside.
 *
 * Это СЛОВАРЬ всех будущих код-агентов (21-client §6, AGENTS.md).
 * Импортируй типы отсюда: `import type { Plot, RecipeDef } from '@/types'`.
 *
 * ГРАНИЦА: ни один файл здесь не импортирует three / @react-three / net / state / scene.
 * Только чистые типы + каноничные const-реестры ключей. Node-тестируемо.
 */

export * from './common'
export * from './currency'
export * from './calendar'
export * from './npc'
export * from './social'
export * from './ingredients'
export * from './recipes'
export * from './machines'
export * from './farm'
export * from './animals'
export * from './expeditions'
export * from './mail-foraging'
export * from './fair'
export * from './event'
export * from './town'
export * from './progression'
export * from './economy'
export * from './collections'
export * from './monetization'
export * from './ui'
export * from './net'
export * from './rpc'
