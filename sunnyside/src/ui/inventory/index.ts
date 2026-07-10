/**
 * ui/inventory — оверлей склада (F4 Storage / Silo & Icehouse).
 * Композиция оборачивает дерево в `<InventorySystemProvider>` с реальным
 * `InventorySystem` (см. `InventorySystemContext.tsx`).
 */
export { StorageOverlay } from './StorageOverlay'
export type { StorageOverlayProps } from './StorageOverlay'
export { InventorySystemProvider, useInventorySystem } from './InventorySystemContext'
