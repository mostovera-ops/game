/**
 * ui/expeditions — экран роуд-трипа грузовика (`ui_expeditions`, 07-expeditions).
 * Публичный экспорт зоны: панель, DI-провайдер системы, хук чтения снапшота.
 */
export { ExpeditionsPanel } from './ExpeditionsPanel'
export type { ExpeditionsPanelProps } from './ExpeditionsPanel'
export { ExpeditionSystemProvider, useExpeditionSystem } from './ExpeditionSystemContext'
export { useExpeditions } from './useExpeditions'
export type { UseExpeditions } from './useExpeditions'
