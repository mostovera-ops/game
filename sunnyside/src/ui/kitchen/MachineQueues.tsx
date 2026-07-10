/**
 * ui/kitchen/MachineQueues.tsx — K1 Kitchen / Machine Queues (docs/specs/19-ui-ux.md §3.3
 * K1): letterboard очередей станков — слоты с таймерами, `Queue dish`, `Collect`,
 * индикатор овертайма/батча.
 *
 * Таймеры — модель «дедлайн» (21-client §3.6): остаток = `job.readyAt - serverNow()`,
 * готовность — `serverNow() >= job.readyAt`, никогда не считаем «начислено» сами —
 * `craft.collect` идёт через `CraftSystem` → `BackendAdapter` (сервер — истина).
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import { queueCapacity, maxBatch } from '@/engine/craft'
import type { MachineInstance, MachineJob, UUID } from '@/types'
import { machineLabel, recipeLabel } from './catalog'
import { useCraftSystem } from './CraftSystemContext'
import { DINER, PRINT_SHADOW } from './tokens'

function formatRemaining(ms: number, locale: 'ru' | 'en'): string {
  if (ms <= 0) return locale === 'ru' ? 'Готово' : 'Ready'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface MachineRowProps {
  machine: MachineInstance
  now: number
  locale: 'ru' | 'en'
  onCollect: (jobIds: UUID[]) => void
  onOpenRecipeBox: (machineId: UUID) => void
  collecting: boolean
  /** Станок, по которому кликнули в сцене (farm-ui-seams) — подсвечиваем его строку. */
  focused: boolean
}

function jobIsReady(job: MachineJob, now: number): boolean {
  return job.state === 'ready' || (job.state === 'cooking' && now >= job.readyAt)
}

function MachineRow({ machine, now, locale, onCollect, onOpenRecipeBox, collecting, focused }: MachineRowProps) {
  const capacity = queueCapacity(machine.level)
  const cap = maxBatch(machine.key, machine.level)
  const activeJobs = machine.jobs.filter((j) => j.state !== 'collected')
  const readyJobIds = activeJobs.filter((j) => jobIsReady(j, now)).map((j) => j.id)
  const full = activeJobs.length >= capacity

  return (
    <div
      data-testid={`machine-row-${machine.id}`}
      data-focused={focused}
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{
        background: DINER.board,
        color: DINER.boardInk,
        boxShadow: PRINT_SHADOW,
        outline: focused ? `2px solid ${DINER.teal}` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-black uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {machineLabel(machine.key, locale)} · Ур.{machine.level}
        </h3>
        <span className="tabular-nums text-xs opacity-80">
          {activeJobs.length}/{capacity} · батч ≤{cap}
        </span>
      </div>

      {activeJobs.length === 0 ? (
        <p data-testid={`machine-empty-${machine.id}`} className="text-sm italic opacity-70">
          {locale === 'ru' ? 'Кухня остыла — поставь первое блюдо' : 'Cold burners — queue the first dish'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {activeJobs.map((job) => {
            const ready = jobIsReady(job, now)
            return (
              <li
                key={job.id}
                data-testid={`job-${job.id}`}
                data-ready={ready}
                className="flex items-center justify-between border-b border-dotted pb-1 text-sm tabular-nums"
                style={{ borderColor: DINER.chrome }}
              >
                <span>
                  {recipeLabel(job.recipeKey, locale)} ×{job.batch}
                </span>
                <span style={ready ? { color: DINER.teal, fontWeight: 700 } : undefined}>
                  {formatRemaining(job.readyAt - now, locale)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          data-testid={`machine-queue-btn-${machine.id}`}
          disabled={full}
          onClick={() => onOpenRecipeBox(machine.id)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: DINER.mustard }}
        >
          {locale === 'ru' ? 'Поставить' : 'Queue dish'}
        </button>
        <button
          type="button"
          data-testid={`machine-collect-btn-${machine.id}`}
          disabled={readyJobIds.length === 0 || collecting}
          onClick={() => onCollect(readyJobIds)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: DINER.cherry }}
        >
          {locale === 'ru' ? 'Забрать' : 'Collect'}
        </button>
      </div>
    </div>
  )
}

export interface MachineQueuesProps {
  /** Открывает Recipe Box (K2) для постановки блюда — композиция решает, как показать оверлей. */
  onQueueDish: (machineId: UUID) => void
  /** Станок-фокус (клик по нему в сцене, `ui.kitchenMachineId`) — подсвечивает его строку. */
  focusMachineId?: UUID | null
}

/** Тик перерисовки таймеров (не источник истины — только частота ре-рендера, §3.6). */
const TICK_MS = 1000

// TODO(c3): стабильная пустая ссылка (см. RecipeBox) — иначе `?? []` роняет
// useSyncExternalStore «infinite loop» при null-farm.
const EMPTY_MACHINES: MachineInstance[] = []

export function MachineQueues({ onQueueDish, focusMachineId }: MachineQueuesProps) {
  const locale = useStore((s) => s.ui.locale)
  const machines = useStore((s) => s.farm?.machines ?? EMPTY_MACHINES)
  const serverNow = useStore((s) => s.serverNow)
  const craft = useCraftSystem()
  const [collectingId, setCollectingId] = useState<UUID | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => serverNow(), [serverNow, tick])

  async function collect(machineId: UUID, jobIds: UUID[]) {
    if (jobIds.length === 0) return
    setCollectingId(machineId)
    try {
      const res = await craft.collect(jobIds)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `craft_collect_err_${Date.now()}`,
          kind: 'warn',
          message:
            locale === 'ru'
              ? `Станок закапризничал: ${res.error.message}`
              : `The machine balked: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setCollectingId(null)
    }
  }

  return (
    <section data-testid="machine-queues" className="flex flex-col gap-3 p-4" style={{ background: DINER.paper }}>
      <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
        {locale === 'ru' ? 'Кухня — очереди станков' : 'Kitchen — machine queues'}
      </h2>
      {machines.length === 0 ? (
        <p className="italic opacity-70">{locale === 'ru' ? 'Станков пока нет' : 'No machines yet'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {machines.map((m) => (
            <MachineRow
              key={m.id}
              machine={m}
              now={now}
              locale={locale}
              onOpenRecipeBox={onQueueDish}
              onCollect={(jobIds) => void collect(m.id, jobIds)}
              collecting={collectingId === m.id}
              focused={focusMachineId != null && m.id === focusMachineId}
            />
          ))}
        </div>
      )}
    </section>
  )
}
