/**
 * CurrencyBar.tsx — marquee-бар валют + Farm Value (19-ui-ux §3.1 S2 top marquee,
 * §4.5 «Marquee/бегущая строка»). Читает `econ.wallet`/`econ.pendingDelta`/`econ.farmValue`
 * из стора — НИЧЕГО не считает (оптимистичная дельта уже посчитана эконом-слайсом).
 */

import { useStore } from '@/state'
import { CURRENCIES, type CurrencyKey } from '@/types'
import { formatAmount } from './format'

const ORDER: CurrencyKey[] = ['bucks', 'dimes', 'tickets', 'ribbons']

export function CurrencyBar() {
  const wallet = useStore((s) => s.econ.wallet)
  const pendingDelta = useStore((s) => s.econ.pendingDelta)
  const farmValue = useStore((s) => s.econ.farmValue)

  return (
    <div
      data-testid="currency-bar"
      className="hud-marquee pointer-events-auto flex items-center gap-3 rounded-full px-3 py-1.5 text-sm"
    >
      {ORDER.map((key) => {
        const meta = CURRENCIES[key]
        const shown = wallet[key] + (pendingDelta[key] ?? 0)
        return (
          <span
            key={key}
            data-testid={`currency-${key}`}
            className="tabular-nums flex items-center gap-1"
            title={meta.type}
          >
            <span aria-hidden>{meta.symbol}</span>
            {formatAmount(shown)}
          </span>
        )
      })}
      <span
        data-testid="farm-value"
        className="tabular-nums ml-1 flex items-center gap-1 border-l border-white/20 pl-3 opacity-90"
        title="Farm Value"
      >
        <span aria-hidden>★</span>
        {farmValue ? formatAmount(farmValue.total) : '—'}
      </span>
    </div>
  )
}
