/**
 * ui/shop/ShopSystemContext.tsx — DI-точка для системы(-ы) монетизации (engine/contracts.ts).
 *
 * ПОЧЕМУ КОНТЕКСТ, А НЕ ПРЯМОЙ ИМПОРТ: `ui/` не имеет права ходить в `@/net`
 * (AGENTS.md §3, `lint:boundary`) — сборку систем (адаптер + `SystemContext`) делает
 * композиция (App.tsx/бутстрап, вне зоны `ui-shop-pass`). Тот же паттерн, что
 * `ui/kitchen/CraftSystemContext.tsx`/`ui/market/FairSystemContext.tsx`.
 *
 * Два системных объекта нужны экранам монетизации:
 *  - `CollectionSystem` (`engine/collections`, зона «collections») — `pullPrize` для
 *    Prize Machine и `purchaseDecor`/`placeDecor` для декора; здесь ЖЕ переиспользуется
 *    как обобщённая «купить SKU за `◉`» точка входа для Cosmetics Shop/Boosters/Event
 *    Bundles/докупки уровня Route Pass — до тех пор, пока у этих категорий нет
 *    отдельных RPC/`MutationKind` в `engine/contracts.ts` (общий файл, правится по
 *    согласованию — не наша зона). См. TODO-комментарии у мест вызова
 *    (`CosmeticsShop.tsx`/`Boosters.tsx`/`EventBundles.tsx`/`RoutePass.tsx`).
 *  - `MonetizationSystem` (`engine/monetization`, наша зона) — `verifyPurchase` для
 *    покупки `◉`-пакетов за реал (`ui_shop` таб Dimes) — единственная НАСТОЯЩАЯ
 *    реал-транзакция во всей монетизации (15-monetization.md §9).
 */
import { createContext, useContext } from 'react'
import type { CollectionSystem, MonetizationSystem } from '@/engine/contracts'

export interface ShopSystems {
  collection: CollectionSystem
  monetization: MonetizationSystem
}

const ShopSystemContext = createContext<ShopSystems | null>(null)

export const ShopSystemProvider = ShopSystemContext.Provider

/** Бросает, если дерево не обёрнуто провайдером — явная ошибка сборки лучше молчаливого no-op. */
export function useShopSystems(): ShopSystems {
  const systems = useContext(ShopSystemContext)
  if (!systems) {
    throw new Error(
      'useShopSystems: нет ShopSystems в контексте — оберни дерево в ' +
        '<ShopSystemProvider value={{ collection, monetization }}>',
    )
  }
  return systems
}
