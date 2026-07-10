/**
 * ui/shop/index.ts — барель зоны «ui-shop-pass» (AGENTS.md §2, docs/specs/15-monetization.md).
 * Экраны монетизации: Shop (Cosmetics/Boosters/Bundles/Dimes), Route Pass, Prize Machine.
 * Композиция оборачивает дерево в `<ShopSystemProvider value={{ collection, monetization }}>`
 * (App.tsx/бутстрап — вне этой зоны, см. `ShopSystemContext.tsx` докстринг).
 */

export { ShopHome } from './ShopHome'
export { CosmeticsShop } from './CosmeticsShop'
export { Boosters } from './Boosters'
export { EventBundles } from './EventBundles'
export { DimesShop } from './DimesShop'
export { RoutePass } from './RoutePass'
export { PrizeMachine } from './PrizeMachine'
export { ShopSystemProvider, useShopSystems } from './ShopSystemContext'
export type { ShopSystems } from './ShopSystemContext'
export { usePaymentEmulation } from './PaymentDialog'
export * from './catalog'
export * from './format'
