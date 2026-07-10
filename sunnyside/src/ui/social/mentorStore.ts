/**
 * ui/social/mentorStore.ts — Mentorship pairing (11-town.md §3.7 «Менторство новичков»,
 * ведёт `npc_whittaker`/Old Man Whittaker; см. `types/social.ts` `MentorLink`).
 *
 * ПРОБЕЛ БЭКЕНДА (AGENTS.md §0.6 — не чиним чужие зоны молча, оставляем TODO): у сервера
 * пока нет RPC матчинга ментора/менти — `20-backend.md` §3.2.6 заводит ТОЛЬКО таблицу
 * `mentorships` (mentor_id/mentee_id/state/started_week) и её RLS (§3.3, запись = false),
 * но §3.4.1 не перечисляет `mentor_invite`/`mentor_accept` среди ~47 RPC (сверено). Это тот
 * же класс пробела, что уже задокументирован в `engine/fair/system.ts` (`shift_start` —
 * TODO(architecture) до появления в `contracts.ts`), тот же паттерн решения: локальный
 * стор-заглушка + явный TODO, а не самовольное расширение `engine/contracts.ts`
 * (общий файл, «меняются только по согласованию», AGENTS.md §2).
 *
 * TODO(net,backend): когда `mentor_invite`/`mentor_accept`/`mentor_milestone_claim` появятся
 * в `20-backend.md` §3.4.1 и `engine/contracts.ts` (`BackendAdapter`/`SocialSystem`), заменить
 * этот локальный стор на `SystemContext.applyMutation` + серверный снапшот (как `SocialSystem`
 * в `ui/street/SocialSystemContext.tsx`). До тех пор пара «ментор↔менти» и статус пула — ТОЛЬКО
 * клиентское намерение (не персистится на сервере, не переживает вход с другого устройства).
 *
 * АНТИ-ЧИТ (AGENTS.md §0.3, «золотое правило»): этот стор НЕ начисляет `bucks/dimes/tickets/
 * ribbons` — вехи (§3.7 таблица) лишь ОТМЕЧАЮТСЯ как пройденные локально (`celebrated`) на
 * основе уже серверно-истинных данных (`farm.farmLevel`, `town.coopOrders[].myContribution`,
 * `town.potluck.myScore` — все читаются из общего `useStore`, не отсюда). Реальная выдача
 * награды — будущий Edge/RPC сервера; здесь только витрина «что будет начислено».
 *
 * НЕ общий `state/` (не персистится общим `partialize`, не участвует в `state/index.ts`
 * — эта зона (`ui-social-misc`, src/ui/**) не трогает чужие слайсы, AGENTS.md §2) —
 * отдельный маленький zustand-стор, специфичный для одной DOM-панели (`ui_mentor`).
 */
import { create } from 'zustand'
import type { EpochMs, UUID } from '@/types'

/** Вехи адаптации менти (11-town §3.7 таблица) — ключ клиентский, не canon (пробел бэкенда). */
export type MentorMilestoneKey =
  | 'first_fair_sale'
  | 'first_coop_contribution'
  | 'first_potluck'
  | 'farm_level_5'

export const MENTOR_MILESTONE_KEYS: readonly MentorMilestoneKey[] = [
  'first_fair_sale',
  'first_coop_contribution',
  'first_potluck',
  'farm_level_5',
]

export interface MentorLinkLocal {
  partnerId: UUID
  partnerName: string
  /** Я в этой паре — ментор или менти (11-town §3.7: ментор ведёт ≤2 менти одновременно). */
  myRole: 'mentor' | 'mentee'
  since: EpochMs
}

export interface MentorStoreState {
  /** Записался ли игрок в Mentor Pool (кандидат в менторы, требования §3.7 — ферма ≥8, ≥2 нед). */
  poolOptIn: boolean
  /** Активные пары (менти ≤2 на ментора; для роли mentee — максимум одна запись). */
  links: MentorLinkLocal[]
  /** Вехи, которые игрок уже видел отпразднованными в этом UI (не награда, витрина). */
  celebrated: MentorMilestoneKey[]

  setPoolOptIn: (v: boolean) => void
  /** Менти запрашивает ментора (или ментор соглашается вести менти) — локальная пара. */
  addLink: (link: MentorLinkLocal) => void
  /** Выпуск менти (уровень 5) / разрыв пары. */
  removeLink: (partnerId: UUID) => void
  markCelebrated: (key: MentorMilestoneKey) => void
  /** Тесты/сброс dev-сессии. */
  reset: () => void
}

const initial = {
  poolOptIn: false,
  links: [] as MentorLinkLocal[],
  celebrated: [] as MentorMilestoneKey[],
}

/** Кап §3.7: ментор ведёт максимум 2 менти одновременно (гипотеза). Менти — максимум 1 ментор. */
const MAX_MENTEES_PER_MENTOR = 2

export const useMentorStore = create<MentorStoreState>((set, get) => ({
  ...initial,

  setPoolOptIn: (v) => set({ poolOptIn: v }),

  addLink: (link) => {
    const { links } = get()
    if (links.some((l) => l.partnerId === link.partnerId)) return
    if (link.myRole === 'mentee' && links.some((l) => l.myRole === 'mentee')) return // 1 ментор/менти
    if (link.myRole === 'mentor') {
      const mentees = links.filter((l) => l.myRole === 'mentor').length
      if (mentees >= MAX_MENTEES_PER_MENTOR) return
    }
    set({ links: [...links, link] })
  },

  removeLink: (partnerId) => set((s) => ({ links: s.links.filter((l) => l.partnerId !== partnerId) })),

  markCelebrated: (key) =>
    set((s) => (s.celebrated.includes(key) ? s : { celebrated: [...s.celebrated, key] })),

  reset: () => set({ ...initial }),
}))
