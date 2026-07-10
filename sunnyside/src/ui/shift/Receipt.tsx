/**
 * ui/shift/Receipt.tsx — Shift Receipt (Чек смены, R4 19-ui-ux / 09-fair §2.3/§4.10).
 *
 * Итог активной смены как бумажный чек дайнера: моноширинные числа (tabular-nums), кремовая
 * бумага, подпись «y'all come back now!». Провала нет (P3) — чек только тёплый итог. Цифры —
 * из движка (`ShiftResult` собран презентером через `scoreShift`); компонент лишь печатает.
 *
 * ГРАНИЦА: ui/ — DOM, ноль three/net.
 */

import type { ShiftResult } from './ShiftScreen'
import { T } from './theme'

export interface ReceiptProps {
  result: ShiftResult
  onClose: () => void
}

export function Receipt({ result, onClose }: ReceiptProps) {
  const earned = result.bucks + result.tips
  return (
    <div
      data-testid="shift-receipt"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        background: 'rgba(20,16,12,0.5)',
        fontFamily: '"Courier New", ui-monospace, monospace',
      }}
    >
      <div
        style={{
          width: 300,
          background: T.paper,
          color: T.ink,
          borderRadius: 4,
          padding: '18px 20px 14px',
          boxShadow: `0 10px 30px ${T.shadow}`,
          backgroundImage:
            'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 900, letterSpacing: 2, fontSize: 18 }}>
          SUNNYSIDE
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>
          — Смена у прилавка —
        </div>
        <Divider />
        <Line label="ПОДАНО" value={`${result.served}`} />
        <Line label="ЛУЧШАЯ СЕРИЯ" value={`×${result.maxCombo}`} />
        <Divider />
        <Line label="ВЫРУЧКА" value={`$${result.bucks}`} />
        <Line label="ЧАЕВЫЕ" value={`$${result.tips}`} />
        <Line label="FAIR SCORE" value={`★ ${result.fairScore}`} />
        {result.ticketsRaw > 0 && <Line label="ТАЛОНЫ" value={`🎟 ${result.ticketsRaw}`} />}
        <Divider />
        <Line label="ИТОГО" value={`$${earned}`} bold />
        <div style={{ textAlign: 'center', marginTop: 12, fontStyle: 'italic', color: T.inkSoft }}>
          y'all come back now!
        </div>
        <button
          data-testid="receipt-close"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 12,
            background: T.cherry,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: `0 2px 0 ${T.shadow}`,
          }}
        >
          Готово
        </button>
      </div>
    </div>
  )
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: bold ? 16 : 14,
        fontWeight: bold ? 900 : 500,
        padding: '2px 0',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: `1px dashed ${T.chromeDark}`, margin: '8px 0' }} />
}
