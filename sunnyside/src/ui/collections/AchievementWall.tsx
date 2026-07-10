/**
 * ui/collections/AchievementWall.tsx — C6 Plaques / Achievements (docs/specs/19-ui-ux.md
 * §3.7 C6, 17-collections §2.5): «латунь на стене дайнера» — список 63 табличек
 * с прогрессом, кнопка `Hang` вешает разблокированную табличку в интерьер.
 *
 * Разблокировка (`unlocked_at`) — серверная истина (`CollectionsSnapshot.achievementsUnlocked`,
 * 17-collections §4.1); предикаты условий (`evaluateAchievements`,
 * `engine/collections/achievements.ts`) требуют `AchievementStats`, агрегируемый
 * из МНОЖЕСТВА чужих слайсов (farm/craft/fair/social/expeditions/progression) —
 * эта карточка не собирает статистику сама (AGENTS.md §3 граница импортов), она
 * только отображает уже разблокированный список. `Hang` — локальный
 * витринный тумблер интерьера (`state/collections.ts` setAchievementHung);
 * TODO(owner: net/collections, вне зоны ui-collections): контракт
 * `CollectionSystem` пока не содержит отдельного RPC «повесить табличку» —
 * когда появится, заменить локальный тумблер на реальную мутацию.
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import { achievements } from '@/data/catalogs/achievements'
import { DINER, PRINT_SHADOW } from './tokens'

// Fallback стабильной ссылкой (не литерал в селекторе) — zustand useSyncExternalStore
// иначе видит «новый» снапшот на каждом рендере и уходит в бесконечный ре-рендер.
const EMPTY_STRINGS: readonly string[] = []

export interface AchievementWallProps {
  onClose?: () => void
}

export function AchievementWall({ onClose }: AchievementWallProps) {
  const locale = useStore((s) => s.ui.locale)
  const unlocked = useStore((s) => s.collections?.achievementsUnlocked ?? EMPTY_STRINGS)
  const hung = useStore((s) => s.collections?.achievementsHung ?? EMPTY_STRINGS)
  const setAchievementHung = useStore((s) => s.setAchievementHung)

  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked])
  const hungSet = useMemo(() => new Set(hung), [hung])
  const categories = useMemo(() => Array.from(new Set(achievements.map((a) => a.category))), [])

  const rows = useMemo(
    () => achievements.filter((a) => categoryFilter === 'all' || a.category === categoryFilter),
    [categoryFilter],
  )

  const progressLabel = `${unlockedSet.size} / ${achievements.length}`

  return (
    <section
      data-testid="achievement-wall"
      className="flex max-h-[80vh] w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Стена ачивок' : 'Achievement Wall'}
        </h2>
        <span data-testid="achievement-wall-progress" className="tabular-nums text-xs font-bold">
          {progressLabel}
        </span>
        {onClose && (
          <button
            type="button"
            data-testid="achievement-wall-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      <select
        data-testid="achievement-wall-category-filter"
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        className="w-fit rounded-lg border px-2 py-1 text-xs"
        style={{ borderColor: DINER.chrome, background: DINER.card, color: DINER.ink }}
      >
        <option value="all">{locale === 'ru' ? 'Все разделы' : 'All categories'}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <ul className="grid grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {rows.map((a) => {
          const isUnlocked = unlockedSet.has(a.key)
          const isHung = hungSet.has(a.key)
          return (
            <li
              key={a.key}
              data-testid={`achievement-${a.key}`}
              data-unlocked={isUnlocked}
              data-hung={isHung}
              className="flex items-center justify-between gap-2 rounded-xl border-2 p-3 text-xs"
              style={{
                background: isUnlocked ? '#3a2f1f' : DINER.card,
                borderColor: isUnlocked ? DINER.mustard : DINER.chrome,
                boxShadow: PRINT_SHADOW,
                color: isUnlocked ? '#F2E9D8' : DINER.inkMuted,
                opacity: isUnlocked ? 1 : 0.65,
              }}
            >
              <div>
                <p className="font-black uppercase" style={{ color: isUnlocked ? DINER.mustard : DINER.inkMuted }}>
                  {a.rewardTitle}
                </p>
                <p className="opacity-80">{a.condition[locale]}</p>
              </div>
              {isUnlocked && (
                <button
                  type="button"
                  data-testid={`achievement-hang-${a.key}`}
                  aria-pressed={isHung}
                  onClick={() => setAchievementHung(a.key, !isHung)}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase text-white"
                  style={{ background: isHung ? DINER.teal : DINER.cherry }}
                >
                  {isHung ? (locale === 'ru' ? 'Снять' : 'Unhang') : locale === 'ru' ? 'Повесить' : 'Hang'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
