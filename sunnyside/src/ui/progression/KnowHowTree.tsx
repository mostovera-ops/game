/**
 * ui/progression/KnowHowTree.tsx — F7 Know-How Tree (docs/specs/19-ui-ux.md §3.2 F7,
 * 13-progression.md §3.2): альманах на 4 закладки-ветки × 15 узлов, статус
 * (изучено/в процессе/доступно/заперто), таймер активного слота, запуск исследования.
 *
 * Таймер — модель «дедлайн» (21-client §3.6): остаток = `node.studyReadyAt - serverNow()`,
 * готовность — `serverNow() >= studyReadyAt`. Само исследование (`research_start`) идёт
 * через `ProgressionSystem` (DI-контекст) → `BackendAdapter`; сервер — истина. Стоимость/
 * время узла — из контент-каталога (`@/data/catalogs/knowHow`), не считаются здесь.
 *
 * Гейт по Farm Level (13-progression §4.3) НЕ хранится в `KnowHowNodeDefSchema`
 * (см. комментарий каталога) — эта панель его не проверяет; сервер отклонит
 * преждевременный `research_start` с понятной ошибкой (тост ниже).
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import { KNOW_HOW_BRANCHES } from '@/types'
import type { KnowHowBranch } from '@/types'
import { nodesForBranch, knowHowLabel, knowHowEffectLabel } from './catalog'
import { useProgressionSystem } from './ProgressionSystemContext'
import { DINER, PRINT_SHADOW } from './tokens'

const BRANCH_LABEL: Record<KnowHowBranch, { en: string; ru: string }> = {
  kh_agronomy: { en: 'Agronomy', ru: 'Агрономия' },
  kh_cookery: { en: 'Cookery', ru: 'Кулинария' },
  kh_commerce: { en: 'Commerce', ru: 'Коммерция' },
  kh_civics: { en: 'Civics', ru: 'Гражданский долг' },
}

type NodeStatus = 'studied' | 'ready' | 'active' | 'available' | 'locked'

function formatRemaining(ms: number, ru: boolean): string {
  if (ms <= 0) return ru ? 'Готово' : 'Ready'
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}${ru ? 'ч' : 'h'} ${m}${ru ? 'м' : 'm'}` : `${m}${ru ? 'м' : 'm'}`
}

const TICK_MS = 1000

export interface KnowHowTreeProps {
  onClose?: () => void
}

export function KnowHowTree({ onClose }: KnowHowTreeProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const progression = useStore((s) => s.progression)
  const serverNow = useStore((s) => s.serverNow)
  const system = useProgressionSystem()
  const [branch, setBranch] = useState<KnowHowBranch>('kh_agronomy')
  const [busyNode, setBusyNode] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => serverNow(), [serverNow, tick])

  if (!progression) {
    return (
      <section
        data-testid="know-how-tree"
        className="pointer-events-auto mx-auto w-full max-w-2xl rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p className="py-6 text-center italic opacity-70">{ru ? 'Дерево ещё не загружено.' : 'Tree not loaded yet.'}</p>
      </section>
    )
  }

  const { knowHow } = progression
  const activeCount = Object.values(knowHow.nodes).filter((n) => !n.studied && n.studyReadyAt !== undefined).length

  async function research(nodeKey: string) {
    setBusyNode(nodeKey)
    try {
      const res = await system.research(nodeKey)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `research_start_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не изучается: ${res.error.message}` : `Can’t research: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyNode(null)
    }
  }

  const nodes = nodesForBranch(branch)

  return (
    <section
      data-testid="know-how-tree"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">{ru ? 'Дерево ноу-хау' : 'Know-How Tree'}</h2>
        {onClose && (
          <button
            type="button"
            data-testid="know-how-close"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: DINER.chrome }}
          >
            {ru ? 'Закрыть' : 'Close'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs tabular-nums opacity-80">
        <span data-testid="know-how-points">
          {ru ? 'Очки' : 'Points'}: {knowHow.points}
        </span>
        <span data-testid="know-how-slots">
          {ru ? 'Слоты исследования' : 'Research slots'}: {activeCount}/{knowHow.activeSlots}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {KNOW_HOW_BRANCHES.map((b) => (
          <button
            key={b}
            type="button"
            data-testid={`know-how-branch-${b}`}
            aria-pressed={branch === b}
            onClick={() => setBranch(b)}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: branch === b ? DINER.mustard : DINER.chrome, color: DINER.board }}
          >
            {ru ? BRANCH_LABEL[b].ru : BRANCH_LABEL[b].en}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2" data-testid="know-how-node-list">
        {nodes.map((def) => {
          const state = knowHow.nodes[def.key]
          const studied = state?.studied ?? false
          const studyReadyAt = state?.studyReadyAt
          const prereqsMet = def.prereqs.every((p) => knowHow.nodes[p]?.studied)
          const ready = !studied && studyReadyAt !== undefined && now >= studyReadyAt
          const active = !studied && studyReadyAt !== undefined && !ready

          let status: NodeStatus = 'locked'
          if (studied) status = 'studied'
          else if (ready) status = 'ready'
          else if (active) status = 'active'
          else if (prereqsMet && knowHow.points >= def.pointsCost && activeCount < knowHow.activeSlots) status = 'available'

          const statusLabel: Record<NodeStatus, { en: string; ru: string }> = {
            studied: { en: 'Studied', ru: 'Изучено' },
            ready: { en: 'Ready', ru: 'Готово' },
            active: { en: 'Studying', ru: 'Изучается' },
            available: { en: 'Available', ru: 'Доступно' },
            locked: { en: 'Locked', ru: 'Заперто' },
          }

          return (
            <li
              key={def.key}
              data-testid={`know-how-node-${def.key}`}
              data-status={status}
              className="flex items-center justify-between gap-2 rounded-lg p-2"
              style={{ background: DINER.board, color: DINER.boardInk }}
            >
              <div className="flex flex-col">
                <span className="font-bold" style={{ color: DINER.mustard }}>
                  {ru ? 'Тир' : 'Tier'} {def.pointsCost} · {knowHowLabel(def.key, locale)}
                </span>
                <span className="text-xs opacity-80">{knowHowEffectLabel(def.key, locale)}</span>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                <span
                  className="rounded px-2 py-0.5 font-bold uppercase"
                  style={{ background: status === 'studied' ? DINER.teal : DINER.chrome, color: DINER.board }}
                >
                  {ru ? statusLabel[status].ru : statusLabel[status].en}
                </span>
                {active && studyReadyAt !== undefined && (
                  <span data-testid={`know-how-timer-${def.key}`} className="tabular-nums opacity-80">
                    {formatRemaining(studyReadyAt - now, ru)}
                  </span>
                )}
                {status === 'available' && (
                  <button
                    type="button"
                    data-testid={`know-how-research-${def.key}`}
                    disabled={busyNode === def.key}
                    onClick={() => void research(def.key)}
                    className="rounded-lg px-2 py-1 font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: DINER.cherry, color: 'white' }}
                  >
                    {ru ? `Изучить (${def.pointsCost})` : `Research (${def.pointsCost})`}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
