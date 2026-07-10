/**
 * ui/kitchen/RecipeBox.tsx — K2 Recipe Box (docs/specs/19-ui-ux.md §3.3 K2): каталог всех
 * рецептов — сетка карточек + фильтр по станку + таб Unlocked/Locked/Secret.
 *
 * Логика: доступность (`recipeAvailability`) и нехватка сырья (`missingInputs`,
 * `engine/craft/chain.ts`) — чистые функции движка, компонент их только вызывает
 * (AGENTS.md §0.3: UI не считает награду/правила сам).
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import { missingInputs } from '@/engine/craft'
import { recipes } from '@/data/catalogs/recipes'
import { machines } from '@/data/catalogs/machines'
import type { RecipeKey, MachineInstance, ProductKey } from '@/types'
import { RecipeCard } from './RecipeCard'
import { recipeAvailability, type RecipeAvailability } from './catalog'
import { useCraftSystem } from './CraftSystemContext'
import { DINER } from './tokens'

type Tab = RecipeAvailability

// TODO(c3): стабильные пустые ссылки — селектор `?? {}`/`?? []` возвращал бы новый объект
// на каждый рендер при null-слайсе → useSyncExternalStore «infinite loop» и падение панели
// (проявилось при монтировании через PanelHost). Держим один инстанс.
const EMPTY_ITEMS: Partial<Record<ProductKey, number>> = {}
const EMPTY_MACHINES: MachineInstance[] = []

const TAB_LABEL: Record<Tab, { ru: string; en: string }> = {
  unlocked: { ru: 'Открытые', en: 'Unlocked' },
  locked: { ru: 'Закрытые', en: 'Locked' },
  secret: { ru: 'Секретки', en: 'Secret' },
}

export interface RecipeBoxProps {
  /** Станок, для которого показывать «Cook» (передаётся из Machine Queues при «Queue dish»). */
  machineId?: string
  onClose?: () => void
}

export function RecipeBox({ machineId, onClose }: RecipeBoxProps) {
  const locale = useStore((s) => s.ui.locale)
  const farmLevel = useStore((s) => s.farm?.farmLevel ?? 1)
  const items = useStore((s) => s.inventory?.items ?? EMPTY_ITEMS)
  const machineInstances = useStore((s) => s.farm?.machines ?? EMPTY_MACHINES)
  const craft = useCraftSystem()

  const [tab, setTab] = useState<Tab>('unlocked')
  const [machineFilter, setMachineFilter] = useState<string>('all')
  const [cookingKey, setCookingKey] = useState<RecipeKey | null>(null)

  const machine = machineId ? machineInstances.find((m) => m.id === machineId) : undefined

  const visible = useMemo(() => {
    return recipes.filter((r) => {
      if (machineFilter !== 'all' && r.machineKey !== machineFilter) return false
      if (machine && r.machineKey !== machine.key) return false
      return recipeAvailability(r, farmLevel) === tab
    })
  }, [tab, machineFilter, machine, farmLevel])

  async function cook(recipeKey: RecipeKey) {
    if (!machine) return
    setCookingKey(recipeKey)
    try {
      const res = await craft.start(machine.id, recipeKey, 1)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `craft_start_err_${Date.now()}`,
          kind: 'warn',
          message:
            locale === 'ru'
              ? `Не получилось поставить блюдо: ${res.error.message}`
              : `Could not queue dish: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setCookingKey(null)
    }
  }

  return (
    <section
      data-testid="recipe-box"
      className="flex max-h-[80vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Коробка рецептов' : 'Recipe Box'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="recipe-box-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {(['unlocked', 'locked', 'secret'] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`recipe-box-tab-${t}`}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: tab === t ? DINER.cherry : DINER.card,
              color: tab === t ? 'white' : DINER.ink,
              border: `1px solid ${DINER.chrome}`,
            }}
          >
            {TAB_LABEL[t][locale]}
          </button>
        ))}

        <select
          data-testid="recipe-box-machine-filter"
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="ml-auto rounded-lg border px-2 py-1 text-xs"
          style={{ borderColor: DINER.chrome, background: DINER.card, color: DINER.ink }}
        >
          <option value="all">{locale === 'ru' ? 'Все станки' : 'All machines'}</option>
          {machines.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name[locale]}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p data-testid="recipe-box-empty" className="italic opacity-70">
          {locale === 'ru'
            ? 'Пока только тосты — Бабушка Опал подскажет рецепты'
            : 'Just toast so far — Grandma Opal will point the way'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3 overflow-y-auto">
          {visible.map((r) => (
            <RecipeCard
              key={r.key}
              recipe={r}
              locale={locale}
              availability={tab}
              missing={missingInputs(r.key, items, 1)}
              onCook={machine ? () => void cook(r.key) : undefined}
              cooking={cookingKey === r.key}
            />
          ))}
        </div>
      )}
    </section>
  )
}
