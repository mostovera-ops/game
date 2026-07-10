/**
 * ui/progression — экраны прогрессии (F3 Buildings, F6 Staff Board, F7 Know-How Tree,
 * C1/F9 Profile). Композиция (App.tsx/бутстрап) оборачивает дерево в
 * `<ProgressionSystemProvider>` (стафф/know-how/стрик) и `<BuildingsSystemProvider>`
 * (апгрейд построек — узкий срез `FarmSystem`), см. соответствующие *Context.tsx.
 */
export { StaffRoster } from './StaffRoster'
export type { StaffRosterProps } from './StaffRoster'
export { KnowHowTree } from './KnowHowTree'
export type { KnowHowTreeProps } from './KnowHowTree'
export { Buildings } from './Buildings'
export type { BuildingsProps } from './Buildings'
export { Profile } from './Profile'

export { ProgressionSystemProvider, useProgressionSystem } from './ProgressionSystemContext'
export { BuildingsSystemProvider, useBuildingsSystem } from './BuildingsSystemContext'
export type { BuildingsSystem } from './BuildingsSystemContext'

export {
  staffContent,
  knowHowContent,
  buildingContent,
  staffLabel,
  knowHowLabel,
  knowHowEffectLabel,
  buildingLabel,
  nodesForBranch,
  buildingLevel,
} from './catalog'

export { DINER, PRINT_SHADOW } from './tokens'
