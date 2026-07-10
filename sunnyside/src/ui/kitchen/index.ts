/**
 * ui/kitchen — оверлеи кухни (K1 Machine Queues, K2 Recipe Box, K3 Recipe Card).
 * Композиция (App.tsx/бутстрап) оборачивает дерево в `<CraftSystemProvider>` с реальным
 * `CraftSystem` (см. `CraftSystemContext.tsx` — почему через контекст, не прямой импорт net).
 */
export { MachineQueues } from './MachineQueues'
export type { MachineQueuesProps } from './MachineQueues'
export { RecipeBox } from './RecipeBox'
export type { RecipeBoxProps } from './RecipeBox'
export { RecipeCard } from './RecipeCard'
export type { RecipeCardProps } from './RecipeCard'
export { CraftSystemProvider, useCraftSystem } from './CraftSystemContext'
export {
  recipeContent,
  machineContent,
  ingredientContent,
  recipesForMachine,
  productLabel,
  machineLabel,
  recipeLabel,
  recipeAvailability,
} from './catalog'
export type { RecipeAvailability } from './catalog'
export { DINER, PRINT_SHADOW } from './tokens'
