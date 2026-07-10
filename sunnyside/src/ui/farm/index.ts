/**
 * ui/farm — оверлеи фермы, не имеющие canon `ui_*` ключа (контекстные `SHEET`, 19-ui-ux
 * §3.2): F1 Seed Picker. Композиция (`src/app/**`) оборачивает дерево в
 * `<FarmSystemProvider>` с реальным `FarmSystem` (см. `FarmSystemContext.tsx`).
 */
export { SeedPicker } from './SeedPicker'
export { FarmSystemProvider, useFarmSystem } from './FarmSystemContext'
export type { SeedSystem } from './FarmSystemContext'
