/**
 * ui/collections — экраны коллекций (17-collections.md): Ribbon Wall, Postcards,
 * Toy Shelf (+ Prize Machine pulls), Achievement Wall, Kodachrome Photo Mode,
 * Neon Builder. Композиция оборачивает дерево в `<CollectionSystemProvider>`
 * с реальным `CollectionSystem` (см. `CollectionSystemContext.tsx`).
 *
 * Recipe Box (K2) живёт в зоне `ui/kitchen/RecipeBox.tsx` — не здесь: дубль,
 * ранее лежавший в этой папке, был мёртвым кодом (никем не импортировался,
 * держал коллизионный `data-testid="recipe-box"`) и удалён (фикс UI-2).
 */
export { RibbonWall } from './RibbonWall'
export type { RibbonWallProps } from './RibbonWall'

export { Postcards } from './Postcards'
export type { PostcardsProps } from './Postcards'

export { ToyShelf } from './ToyShelf'
export type { ToyShelfProps } from './ToyShelf'

export { AchievementWall } from './AchievementWall'
export type { AchievementWallProps } from './AchievementWall'

export { PhotoMode } from './PhotoMode'
export type { PhotoModeProps, PhotoFilterKey } from './PhotoMode'

export { NeonBuilder } from './NeonBuilder'
export type { NeonBuilderProps } from './NeonBuilder'

export { CollectionSystemProvider, useCollectionSystem } from './CollectionSystemContext'
