/**
 * collections.ts — игрушки, косметика, открытки, ленты (17-collections). Кэш.
 *
 * Доп. поля этого слайса (ui-collections, 17-collections §2.1/§2.5/§2.6/§2.7):
 * `recipeMastery` (Recipe Box, счётчик «готовили N раз»), `achievementsUnlocked`/
 * `achievementsHung` (Achievement Wall), `neonSign` (Neon Builder), `photos`
 * (Kodachrome галерея). Истина всех четырёх — сервер (`CollectionsSnapshot`
 * whole-snapshot через `setCollections`); точечные патчеры ниже — только для
 * оптимистичного/локального UI-предпросмотра до подтверждения ответа адаптера
 * (AGENTS.md §0.3 — клиент не начисляет сам, эти сеттеры не заменяют мутацию).
 */

import type { CollectionsSnapshot, NeonSignConfig, CollectionPhoto } from '@/types'
import type { SliceCreator } from './types'

export interface CollectionsSlice {
  collections: CollectionsSnapshot | null
  setCollections: (collections: CollectionsSnapshot) => void
  /** Локально проставляет разблокированные ачивки (превью до reconcile со снапшотом). */
  setAchievementsUnlocked: (keys: string[]) => void
  /** Переключает «повешена в интерьере» для уже разблокированной ачивки. */
  setAchievementHung: (key: string, hung: boolean) => void
  /** Локальный превью-патч mastery-счётчика (реальный инкремент — сервер при craft_collect). */
  setRecipeTimesCooked: (recipeKey: string, timesCooked: number) => void
  /** Кэш сохранённой вывески после успешного `neon_save`. */
  setNeonSign: (config: NeonSignConfig | null) => void
  /** Добавляет снимок Kodachrome в локальную галерею (после `photoUpload`). */
  addPhoto: (photo: CollectionPhoto) => void
}

const emptySnapshot = (): CollectionsSnapshot => ({
  toys: {},
  cosmetics: {},
  postcards: [],
  ribbons: [],
  achievementsUnlocked: [],
  achievementsHung: [],
  recipeMastery: {},
  neonSign: null,
  photos: [],
})

export const createCollectionsSlice: SliceCreator<CollectionsSlice> = (set) => ({
  collections: null,
  setCollections: (collections) => set({ collections }),

  setAchievementsUnlocked: (keys) =>
    set((s) => ({ collections: { ...(s.collections ?? emptySnapshot()), achievementsUnlocked: keys } })),

  setAchievementHung: (key, hung) =>
    set((s) => {
      const base = s.collections ?? emptySnapshot()
      const current = new Set(base.achievementsHung ?? [])
      if (hung) current.add(key)
      else current.delete(key)
      return { collections: { ...base, achievementsHung: [...current] } }
    }),

  setRecipeTimesCooked: (recipeKey, timesCooked) =>
    set((s) => {
      const base = s.collections ?? emptySnapshot()
      return { collections: { ...base, recipeMastery: { ...(base.recipeMastery ?? {}), [recipeKey]: timesCooked } } }
    }),

  setNeonSign: (config) => set((s) => ({ collections: { ...(s.collections ?? emptySnapshot()), neonSign: config } })),

  addPhoto: (photo) =>
    set((s) => {
      const base = s.collections ?? emptySnapshot()
      return { collections: { ...base, photos: [photo, ...(base.photos ?? [])] } }
    }),
})
