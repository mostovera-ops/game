/**
 * app/SystemsProvider.tsx — единый DI-корень систем для DOM-оверлеев (интегратор C3).
 *
 * Оборачивает поддерево во ВСЕ System-провайдеры зон `ui/*` одним объектом систем,
 * собранным поверх общего `SystemContext` (`createSystems`). Панели вызывают только
 * публичные методы систем (`useCraftSystem()` и т.п.) — сам объект систем стабилен
 * на всё время жизни приложения (мемоизирован), так что подписки/эффекты панелей не
 * пересоздаются.
 *
 * Системы, нужные СЦЕНЕ (внутри `<Canvas>`, вне этого дерева) — `FarmSystem`/`AnimalSystem`
 * (farm-ui-seams), `SocialSystem`/`MailForagingSystem`/`ShiftSystem` (adapter-seams) — идут
 * НЕ через этот провайдер, а пропами через `scene/index.tsx` (`ActiveScene`), см. `App.tsx`:
 * там же строится ОДИН `AppSystems`, который передаётся и сюда (`systems={...}`), и в сцену —
 * не дублируем сборку. `AnimalSystem`/`ContestSystem` — ИСКЛЮЧЕНИЕ (ui-social-misc): те же
 * объекты `sys.animals`/`sys.contest` идут ОБОИМИ путями — сцене (пропами) и сюда
 * (DOM-панели `ui_pet_card`/`ui_contest_gallery`, `ui/social/*SystemContext.tsx`) — один
 * системный объект, два потребителя, дублирования сборки по-прежнему нет.
 *
 * ГРАНИЦА: это композиция (`src/app/**`, вне правил `lint:boundary`) — единственное
 * место, где `ui/`-провайдеры встречаются со сборкой систем из `@/engine` + `@/net`.
 */

import { useMemo, type ReactNode } from 'react'
import { CraftSystemProvider } from '@/ui/kitchen'
import { InventorySystemProvider } from '@/ui/inventory'
import { FarmSystemProvider } from '@/ui/farm'
import { FairSystemProvider } from '@/ui/market'
import { CoopSystemProvider } from '@/ui/orders'
import { EventSystemProvider } from '@/ui/event'
import { SocialSystemProvider } from '@/ui/street'
import { ProgressionSystemProvider, BuildingsSystemProvider } from '@/ui/progression'
import { CollectionSystemProvider } from '@/ui/collections'
import { ShopSystemProvider } from '@/ui/shop'
import {
  AnimalSystemProvider,
  ContestSystemProvider,
  RetentionSystemProvider,
} from '@/ui/social'
import { TownSystemProvider } from '@/ui/migration'
import { ExpeditionSystemProvider } from '@/ui/expeditions'
import { MailSystemProvider } from '@/ui/mail'
import { getAdapter, createSystemContext, createSystems, type AppSystems } from './backend'

/** Собрать системы один раз (адаптер-синглтон + SystemContext поверх стора). */
function buildSystems(): AppSystems {
  return createSystems(createSystemContext(getAdapter()))
}

export function SystemsProvider({
  children,
  systems: injected,
}: {
  children: ReactNode
  /** Тесты могут подсунуть готовый набор систем; прод собирает сам. */
  systems?: AppSystems
}) {
  const sys = useMemo(() => injected ?? buildSystems(), [injected])

  return (
    <CraftSystemProvider value={sys.craft}>
      <InventorySystemProvider value={sys.inventory}>
        <FairSystemProvider value={sys.fair}>
          <CoopSystemProvider value={sys.coop}>
            <EventSystemProvider value={sys.event}>
              <SocialSystemProvider value={sys.social}>
                <ProgressionSystemProvider value={sys.progression}>
                  <BuildingsSystemProvider value={sys.farm}>
                    <FarmSystemProvider value={sys.farm}>
                      <CollectionSystemProvider value={sys.collection}>
                        <ShopSystemProvider
                          value={{ collection: sys.collection, monetization: sys.monetization }}
                        >
                          <AnimalSystemProvider value={sys.animals}>
                            <ContestSystemProvider value={sys.contest}>
                              <RetentionSystemProvider value={sys.retention}>
                                <TownSystemProvider value={sys.town}>
                                  <ExpeditionSystemProvider value={sys.expedition}>
                                    <MailSystemProvider value={sys.mailForaging}>
                                      {children}
                                    </MailSystemProvider>
                                  </ExpeditionSystemProvider>
                                </TownSystemProvider>
                              </RetentionSystemProvider>
                            </ContestSystemProvider>
                          </AnimalSystemProvider>
                        </ShopSystemProvider>
                      </CollectionSystemProvider>
                    </FarmSystemProvider>
                  </BuildingsSystemProvider>
                </ProgressionSystemProvider>
              </SocialSystemProvider>
            </EventSystemProvider>
          </CoopSystemProvider>
        </FairSystemProvider>
      </InventorySystemProvider>
    </CraftSystemProvider>
  )
}
