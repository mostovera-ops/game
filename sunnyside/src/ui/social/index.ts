/**
 * ui/social/index.ts — публичный барель зоны `ui-social-misc` (AGENTS.md §2).
 * Менторство, Gone Fishin', присмотр за фермой соседа (в `ui/street/NeighborProfile.tsx`,
 * через уже собранный `SocialSystem`), переименование/ласка-подарок питомцу, Contest Gallery.
 */
export { MentorPanel } from './MentorPanel'
export { useMentorStore, MENTOR_MILESTONE_KEYS, type MentorMilestoneKey, type MentorLinkLocal } from './mentorStore'
export { GoneFishinToggle } from './GoneFishinToggle'
export { PetCard } from './PetCard'
export { ContestGallery } from './ContestGallery'
export { AnimalSystemProvider, useAnimalSystem } from './AnimalSystemContext'
export { ContestSystemProvider, useContestSystem } from './ContestSystemContext'
export { RetentionSystemProvider, useRetentionSystem } from './RetentionSystemContext'
