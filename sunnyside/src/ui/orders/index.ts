/**
 * ui/orders/index.ts — барель зоны «ui-market-orders» / orders (AGENTS.md §2).
 * Доска кооп-заказов города (W5) + potluck-стол стрита (W4, 11-town §кооп, 19-ui-ux §3.6).
 * Композиция оборачивает дерево в `<CoopSystemProvider>` с реальным `CoopSystem`.
 */

export { CoopOrders } from './CoopOrders'
export { Potluck } from './Potluck'
export { CoopSystemProvider, useCoopSystem } from './CoopSystemContext'
export * from './format'
