/**
 * ui/onboarding/store.ts — состояние FTUE (18-onboarding §3.2/§3.3), персист + резюм.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ СТОР, А НЕ СЛАЙС В `@/state`:
 *  - `state/index.ts`, `state/types.ts` — ОБЩИЕ файлы (AGENTS.md §2: «меняются только
 *    по согласованию»), их правка задевает все зоны. FTUE — изолированная песочница
 *    (§3.2: «не пишет в общий server_calendar, не занимает слот стрита»), поэтому её
 *    прогресс живёт в собственном сторе зоны `ui-onboarding` и не смешивается с
 *    серверной истиной. Граница `ui/` соблюдена (zustand разрешён, three/net — нет).
 *  - Персист в localStorage (ключ `sunnyside.ftue`) даёт резюм после перезагрузки
 *    (§3.2: «выход в середине мини-недели → возврат на тот же t_day», O2). Белый
 *    список — только флоу-прогресс (фаза/шаг/имя/аватар/стрит), без игровой истины.
 *
 * ЛОГИКА vs UI: здесь ТОЛЬКО прогресс туториального флоу (какой шаг открыт). Никаких
 * эконом-расчётов — награды мини-недели детерминированы и заданы данными
 * (`scenario.ts`, §4.2), реальные мутации после выпуска идут через штатные системы.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { MINI_WEEK_STEPS } from './scenario'
import type { AvatarPresetKey } from './scenario'

/** Фаза онбординга — конечный автомат (18-onboarding §2). */
export type FtuePhase =
  | 'letter' // экран письма-наследства (ui_legacy_letter): имя, аватар, Skip/Begin
  | 'mini_week' // сжатая мини-неделя t_day_1..7 (§3.3)
  | 'released' // экран выпуска на улицу + Grand Opening + автопредложение стрита (§3.4/§3.8)
  | 'done' // FTUE завершён (полное прохождение)
  | 'skipped' // опытный игрок пропустил мини-неделю (§3.7)

export const DEFAULT_FARM_NAME = 'Sunnyside'

export interface FtueState {
  phase: FtuePhase
  /** Индекс текущего шага мини-недели 0..6 (t_day_1..t_day_7). */
  step: number
  /** Имя фермы (дефолт Sunnyside, переименовываемо — §2.1). */
  farmName: string
  /** Косметический пресет аватара (D11, без влияния на геймплей). */
  avatar: AvatarPresetKey
  /** Принял ли автопредложение стрита (§3.8). */
  streetJoined: boolean
  /** Признак «прошёл через скип» — для ускоренного раскрытия систем (§3.7). */
  skipped: boolean

  setFarmName: (name: string) => void
  setAvatar: (avatar: AvatarPresetKey) => void
  /** Старт мини-недели с экрана письма (Begin). */
  startMiniWeek: () => void
  /** Следующий шаг мини-недели; на последнем — переход к экрану выпуска. */
  advanceStep: () => void
  /** Скип мини-недели опытным игроком (§3.7): сразу к выпуску, помечаем skipped. */
  skip: () => void
  /** Принять автопредложение стрита (§3.8). */
  joinStreet: () => void
  /** Финал FTUE (закрыть экран выпуска). */
  finish: () => void
  /** Полный сброс (dev / повторный туториал). */
  reset: () => void
}

const LAST_STEP = MINI_WEEK_STEPS.length - 1

const initial = {
  phase: 'letter' as FtuePhase,
  step: 0,
  farmName: DEFAULT_FARM_NAME,
  avatar: 'sunny' as AvatarPresetKey,
  streetJoined: false,
  skipped: false,
}

export const useFtueStore = create<FtueState>()(
  persist(
    (set) => ({
      ...initial,
      setFarmName: (farmName) =>
        // Пустое имя откатываем к дефолту (ферма всегда как-то называется, §2.1).
        set({ farmName: farmName.trim() === '' ? DEFAULT_FARM_NAME : farmName }),
      setAvatar: (avatar) => set({ avatar }),
      startMiniWeek: () => set({ phase: 'mini_week', step: 0 }),
      advanceStep: () =>
        set((s) =>
          s.step >= LAST_STEP
            ? { phase: 'released' }
            : { step: s.step + 1 },
        ),
      skip: () => set({ phase: 'released', skipped: true, step: LAST_STEP }),
      joinStreet: () => set({ streetJoined: true }),
      finish: () => set({ phase: 'done' }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'sunnyside.ftue',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Белый список: только прогресс флоу. Игровой истины тут нет (§3.2).
      partialize: (s) => ({
        phase: s.phase,
        step: s.step,
        farmName: s.farmName,
        avatar: s.avatar,
        streetJoined: s.streetJoined,
        skipped: s.skipped,
      }),
    },
  ),
)
