/**
 * ui/progression/StaffRoster.tsx — F6 Staff Board (docs/specs/19-ui-ux.md §3.2 F6,
 * 13-progression.md §3.1): 12 карточек стаффа (портрет-заглушка, пост, уровень, навык),
 * назначение на пост, апгрейд жетонами, панель активных синергий сета.
 *
 * Таймеры/деньги — не считаем сами: апгрейд/назначение идут через `ProgressionSystem`
 * (DI-контекст, `ProgressionSystemContext.tsx`), истина — ответ адаптера (AGENTS.md §0.3).
 * Множители/стоимости — чистые формулы `engine/progression` (никаких своих чисел).
 *
 * ОГРАНИЧЕНИЕ ТИПОВ (не выдумываем): канон вводит жетон на КАЖДОГО персонажа
 * (`token_<staff>`, §3.1.4), но `ProgressionSnapshot` (13-progression.md, ключ ещё не
 * внесён в canon §3.12/§3.13 — см. спека §8 п.1) несёт единственный агрегат
 * `staffTokens: number`. Пока сервер не отдаёт разбивку по персонажам, панель
 * апгрейда сверяет стоимость с этим общим числом (см. TODO ниже) — это осознанное
 * упрощение презентации, не бизнес-правило.
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import { STAFF_KEYS } from '@/types'
import type { StaffKey, StaffPost } from '@/types'
import {
  STAFF_POST,
  staffUpgradeCost,
  staffLevelMultiplier,
  STAFF_MAX_LEVEL,
  activeSynergies,
} from '@/engine/progression'
import type { SynergyId } from '@/engine/progression'
import { staffLabel, staffContent } from './catalog'
import { useProgressionSystem } from './ProgressionSystemContext'
import { DINER, PRINT_SHADOW } from './tokens'

const STAFF_POSTS: readonly StaffPost[] = ['Kitchen', 'Field', 'Counter', 'Yard']

/** Имена сетов синергий (§3.1.5) — презентационный словарь, числа считает engine/progression. */
const SYNERGY_LABEL: Record<SynergyId, { en: string; ru: string }> = {
  kitchen_brigade: { en: 'Kitchen Brigade', ru: 'Кухонная бригада' },
  front_of_house: { en: 'Front of House', ru: 'Зал' },
  motor_pool: { en: 'Motor Pool', ru: 'Автопарк' },
  homestead: { en: 'Homestead', ru: 'Хозяйство' },
  syn_bruno_ada: { en: 'Books & Broth', ru: 'Гроссбух и бульон' },
  syn_peggy_dizzy: { en: 'Curb Service', ru: 'Обслуживание у машины' },
  syn_gus_buck: { en: 'Road Warriors', ru: 'Короли дороги' },
  syn_marty_vernon: { en: 'Fire & Frame', ru: 'Огонь и каркас' },
}

function postLabel(post: StaffPost, ru: boolean): string {
  const map: Record<StaffPost, { en: string; ru: string }> = {
    Kitchen: { en: 'Kitchen', ru: 'Кухня' },
    Field: { en: 'Field', ru: 'Поле' },
    Counter: { en: 'Counter', ru: 'Прилавок' },
    Yard: { en: 'Yard', ru: 'Двор' },
  }
  return ru ? map[post].ru : map[post].en
}

export interface StaffRosterProps {
  onClose?: () => void
}

export function StaffRoster({ onClose }: StaffRosterProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const progression = useStore((s) => s.progression)
  const system = useProgressionSystem()
  const [postFilter, setPostFilter] = useState<StaffPost | 'all'>('all')
  const [busyKey, setBusyKey] = useState<StaffKey | null>(null)

  const activeSet = useMemo(() => {
    const set = new Set<StaffKey>()
    if (!progression) return set
    for (const key of STAFF_KEYS) {
      const m = progression.staff[key]
      if (m?.hired && m.assignedPost === STAFF_POST[key]) set.add(key)
    }
    return set
  }, [progression])

  const synergies = useMemo(() => activeSynergies(activeSet), [activeSet])

  if (!progression) {
    return (
      <section
        data-testid="staff-roster"
        className="pointer-events-auto mx-auto w-full max-w-2xl rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p className="py-6 text-center italic opacity-70">
          {ru ? 'Ростер ещё не загружен.' : 'Roster not loaded yet.'}
        </p>
      </section>
    )
  }

  async function assign(key: StaffKey, post: StaffPost) {
    setBusyKey(key)
    try {
      const res = await system.assignStaff({ staffKey: key, post })
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `staff_assign_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не вышло назначить: ${res.error.message}` : `Couldn’t assign: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  async function upgrade(key: StaffKey) {
    setBusyKey(key)
    try {
      const res = await system.upgradeStaff(key)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `staff_upgrade_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Апгрейд не удался: ${res.error.message}` : `Upgrade failed: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const visibleKeys = STAFF_KEYS.filter((key) => postFilter === 'all' || STAFF_POST[key] === postFilter)

  return (
    <section
      data-testid="staff-roster"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">{ru ? 'Стафф — посты' : 'Staff Board'}</h2>
        {onClose && (
          <button
            type="button"
            data-testid="staff-roster-close"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: DINER.chrome }}
          >
            {ru ? 'Закрыть' : 'Close'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        <button
          type="button"
          data-testid="staff-tab-all"
          aria-pressed={postFilter === 'all'}
          onClick={() => setPostFilter('all')}
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: postFilter === 'all' ? DINER.mustard : DINER.chrome,
            color: postFilter === 'all' ? DINER.board : DINER.board,
          }}
        >
          {ru ? 'Все' : 'All'}
        </button>
        {STAFF_POSTS.map((post) => (
          <button
            key={post}
            type="button"
            data-testid={`staff-tab-${post.toLowerCase()}`}
            aria-pressed={postFilter === post}
            onClick={() => setPostFilter(post)}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: postFilter === post ? DINER.mustard : DINER.chrome,
              color: DINER.board,
            }}
          >
            {postLabel(post, ru)}
          </button>
        ))}
      </div>

      {synergies.length > 0 && (
        <div
          data-testid="staff-synergy-panel"
          className="rounded-lg p-2 text-xs"
          style={{ background: DINER.board, color: DINER.boardInk }}
        >
          <span className="font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
            {ru ? 'Активные синергии' : 'Active synergies'}
          </span>
          <ul className="mt-1 flex flex-wrap gap-2">
            {synergies.map((s) => (
              <li key={s.id} data-testid={`staff-synergy-${s.id}`}>
                {ru ? SYNERGY_LABEL[s.id].ru : SYNERGY_LABEL[s.id].en}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="staff-cards">
        {visibleKeys.map((key) => {
          const def = staffContent(key)
          const member = progression.staff[key]
          const hired = member?.hired ?? false
          const level = member?.level ?? 0
          const nextLevel = level + 1
          const atMax = level >= STAFF_MAX_LEVEL
          const cost = atMax ? 0 : staffUpgradeCost(nextLevel)
          const canAfford = hired && !atMax && progression.staffTokens >= cost
          const active = activeSet.has(key)

          return (
            <li
              key={key}
              data-testid={`staff-card-${key}`}
              className="flex flex-col gap-1.5 rounded-lg p-3"
              style={{ background: DINER.board, color: DINER.boardInk, boxShadow: PRINT_SHADOW, opacity: hired ? 1 : 0.55 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black" style={{ color: DINER.mustard }}>
                  {staffLabel(key, locale)}
                </h3>
                <span className="text-xs tabular-nums opacity-80">
                  {postLabel(STAFF_POST[key], ru)} {hired ? `· Ур.${level}` : ru ? '· не нанят' : '· not hired'}
                </span>
              </div>

              {hired ? (
                <>
                  <p className="text-xs opacity-90">
                    {def?.skillDescription[locale]} (×{staffLevelMultiplier(level).toFixed(2)})
                  </p>
                  {active && (
                    <span
                      data-testid={`staff-active-${key}`}
                      className="w-fit rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: DINER.teal, color: DINER.board }}
                    >
                      {ru ? 'на посту' : 'on post'}
                    </span>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {STAFF_POSTS.filter((p) => p === STAFF_POST[key]).map((post) => (
                      <button
                        key={post}
                        type="button"
                        data-testid={`staff-assign-${key}`}
                        disabled={busyKey === key || member?.assignedPost === post}
                        onClick={() => void assign(key, post)}
                        className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: DINER.mustard, color: DINER.board }}
                      >
                        {member?.assignedPost === post ? (ru ? 'На посту' : 'Assigned') : ru ? 'Назначить' : 'Assign'}
                      </button>
                    ))}
                    <button
                      type="button"
                      data-testid={`staff-upgrade-${key}`}
                      disabled={busyKey === key || atMax || !canAfford}
                      onClick={() => void upgrade(key)}
                      className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: DINER.cherry, color: 'white' }}
                    >
                      {atMax
                        ? ru
                          ? 'Макс. уровень'
                          : 'Max level'
                        : ru
                          ? `Улучшить (${cost} жетонов)`
                          : `Upgrade (${cost} tokens)`}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs italic opacity-70">
                  {ru ? 'Появится по сюжету/уровню/экспедиции.' : 'Unlocks via story/level/expedition.'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
