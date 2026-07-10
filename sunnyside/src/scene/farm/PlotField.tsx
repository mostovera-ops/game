/**
 * PlotField.tsx — сетка A-слотов грядок (02-farm §3.1). Читает `farm.plots` селектором,
 * раскладывает по фиксированной сетке (`layout.ts`) и рендерит интерактивные `Plot`.
 */

import { useStore } from '@/state'
import { Plot } from './Plot'
import { plotGridPosition } from './layout'

export function PlotField() {
  const plots = useStore((s) => s.farm?.plots)
  if (!plots || plots.length === 0) return null
  return (
    <group>
      {plots.map((plot) => (
        <group key={plot.id} position={plotGridPosition(plot.slot)}>
          <Plot plot={plot} />
        </group>
      ))}
    </group>
  )
}
