/**
 * engine/mail-foraging/index.ts — барель модуля Каталога почтой + фуражинга
 * (08-mail-foraging). Публичный вход: `import { catalogAt } from '@/engine/mailForaging'`
 * (через namespaced-реэкспорт в `engine/index.ts`).
 */

export * from './constants'
export * from './pool'
export * from './rotation'
export * from './delivery'
export * from './fishing'
export * from './forage'
