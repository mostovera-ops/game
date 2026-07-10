/**
 * DemandBoard.tsx — доска спроса недели (ui_demand_board, 19-ui-ux §3.6 W6,
 * 14-economy §3.6). Letterboard-стиль (§4.5): категории с ▲/▼/±0 и процентом,
 * строка «Ностальгия-бонус ×2». Один и тот же экран для Farm HUD-POI и World-таба —
 * этот компонент их общая реализация (§3.6: «оба входа открывают один и тот же экран»).
 *
 * ГРАНИЦА (AGENTS.md §3): читает только `useStore` (state/demand.ts, чужой слайс —
 * не мутирую). Ноль пересчёта D_cat/сатурации здесь — только форматирование уже
 * готового `DemandBoard.board` (см. `@/engine/econ/demand.ts` — владеет формулой).
 */

import { useStore } from '@/state'
import { categoryLabel, demandArrow, demandPercent } from './format'
import { DINER, PRINT_SHADOW } from './tokens'

export function DemandBoardScreen() {
  const locale = useStore((s) => s.ui.locale)
  const demand = useStore((s) => s.demand)
  const ru = locale === 'ru'

  return (
    <section
      data-testid="ui-demand-board"
      className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-2 rounded-xl p-4"
      style={{ background: DINER.board, color: DINER.boardInk, boxShadow: PRINT_SHADOW }}
    >
      <header className="mb-1 border-b border-dotted pb-2 text-center" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {ru ? 'Городская доска · спрос этой недели' : 'City Board · this week’s demand'}
        </h2>
      </header>

      {demand === null ? (
        <p data-testid="demand-board-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Доска обновится в понедельник.' : 'Board updates on Monday.'}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1" data-testid="demand-board-rows">
            {Object.entries(demand.board).map(([category, mult]) => {
              const isNostalgia = demand.nostalgia.includes(category)
              const up = mult > 1
              const down = mult < 1
              return (
                <li
                  key={category}
                  data-testid={`demand-row-${category}`}
                  className="flex items-center justify-between border-b border-dotted pb-1 text-sm tabular-nums"
                  style={{ borderColor: DINER.chrome }}
                >
                  <span>
                    {categoryLabel(category, ru)}
                    {isNostalgia && (
                      <span
                        className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold"
                        style={{ background: DINER.cherry, color: DINER.boardInk }}
                      >
                        {ru ? 'Ностальгия-бонус ×2' : 'Nostalgia bonus ×2'}
                      </span>
                    )}
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: up ? DINER.teal : down ? DINER.cherry : DINER.chrome }}
                  >
                    {demandArrow(mult)} {demandPercent(mult)}
                  </span>
                </li>
              )
            })}
          </ul>
          <footer className="mt-1 text-center text-xs opacity-60">
            {ru ? 'Неделя' : 'Week'} №{demand.weekIndex}
          </footer>
        </>
      )}
    </section>
  )
}
