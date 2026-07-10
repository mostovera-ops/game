/**
 * ui/collections/RibbonWall.tsx — C3 Ribbon Wall (docs/specs/19-ui-ux.md §3.7 C3,
 * 17-collections §2.2): «зеркальный экран-витрина» стены лент конкурсов —
 * гравировка «год · конкурс · дивизион · место», подсветка последней ленты.
 *
 * Ленты приходят ТОЛЬКО с ярмарки (contest_enter/judge, серверная истина,
 * `CollectionsSnapshot.ribbons`, canon §2.1 — эта витрина не создаёт ленты сама).
 * Физическая 3D-стена в сцене фермы — вне скоупа (scene-агент); это UI-зеркало.
 */
import { useMemo } from 'react'
import { useStore } from '@/state'
import type { ContestKey, Ribbon } from '@/types'
import { DINER, PRINT_SHADOW } from './tokens'

const CONTEST_LABEL: Record<ContestKey, { ru: string; en: string }> = {
  ct_pie_week: { ru: 'Пирог недели', en: 'Pie of the Week' },
  ct_giant_veg: { ru: 'Гигантский овощ', en: 'Giant Vegetable' },
  ct_best_window: { ru: 'Лучшая витрина', en: 'Best Window' },
}

const DIVISION_BY_RANK = (rank: number): string => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze')

// Fallback стабильной ссылкой — иначе zustand useSyncExternalStore видит «новый»
// массив на каждом вызове селектора и уходит в бесконечный ре-рендер.
const EMPTY_RIBBONS: readonly Ribbon[] = []

export interface RibbonWallProps {
  onClose?: () => void
}

export function RibbonWall({ onClose }: RibbonWallProps) {
  const locale = useStore((s) => s.ui.locale)
  const ribbons = useStore((s) => s.collections?.ribbons ?? EMPTY_RIBBONS)

  const sorted = useMemo(() => [...ribbons].sort((a, b) => b.weekIndex - a.weekIndex), [ribbons])
  const latestId = sorted[0]?.id

  return (
    <section
      data-testid="ribbon-wall"
      className="flex max-h-[80vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Стена лент' : 'Ribbon Wall'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="ribbon-wall-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      {sorted.length === 0 ? (
        <p data-testid="ribbon-wall-empty" className="text-xs italic opacity-70">
          {locale === 'ru' ? 'Первую ленту получишь на ярмарке.' : "You'll earn your first ribbon at the fair."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r: Ribbon) => {
            const isLatest = r.id === latestId
            const label = CONTEST_LABEL[r.contestKey]
            return (
              <li
                key={r.id}
                data-testid={`ribbon-${r.id}`}
                data-latest={isLatest}
                className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center text-xs"
                style={{
                  background: DINER.card,
                  borderColor: isLatest ? DINER.cherry : DINER.chrome,
                  boxShadow: PRINT_SHADOW,
                  color: DINER.ink,
                  opacity: isLatest ? 1 : 0.85,
                }}
              >
                <span className="text-2xl" aria-hidden>
                  🎀
                </span>
                <h3 className="font-black uppercase" style={{ color: DINER.board }}>
                  {label ? label[locale] : r.contestKey}
                </h3>
                <p className="tabular-nums opacity-80">
                  {locale === 'ru' ? 'Неделя' : 'Week'} {r.weekIndex} · {DIVISION_BY_RANK(r.rank)} · #{r.rank}
                </p>
                {isLatest && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: DINER.cherry }}>
                    {locale === 'ru' ? 'Новая' : 'Latest'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
