/**
 * ui/shift/ShiftHost.tsx — жизненный цикл смены: idle → running → receipt (09-fair §3.4).
 *
 * Держит гейт входа (F2: нужен готовый сток → иначе подсказка «сначала наготовь»), старт
 * (seed из serverNow, детерминированная очередь движка), и переключение на чек по завершении.
 * Читает стор селекторами (serverNow / inventory / уровень палатки) — ноль three/net (§3).
 *
 * УНИФИКАЦИЯ ОВЕРЛЕЕВ (интегратор C3, modal-unify): running/receipt смонтированы в общем
 * `Modal` (`panelKey="ui_shift"`, `variant="fullscreen"` — полноэкранный мини-геймплей без
 * диммера/карточки, но с тем же крестиком/Escape/«Назад»/z-порядком, что и у прочих панелей).
 * `ui.activePanel` — единственный источник истины «открыт ли оверлей смены»: клик по старт-
 * карточке зовёт `openPanel('ui_shift')` наравне со стартом забега; дип-линк `?panel=ui_shift`
 * или программный `openPanel('ui_shift')` при отсутствии активного забега — автостарт (при
 * пустом стоке дальше показываем тот же гейт-текст, но уже ВНУТРИ модалки, а не блокируем её).
 * Закрытие модалки (крестик/подложка/Escape/«Назад») сбрасывает локальную фазу к idle —
 * локальный `phase` не дублирует источник истины, он лишь держит данные текущего забега.
 *
 * Монтируется сценой ярмарки через drei <Html> (см. scene/fair/FairScene.tsx). Сам компонент —
 * чистый DOM. Компактный старт-каркас на площади кликабелен всегда (не блокирует орбит-камеру:
 * pointer-events только на карточке); полноэкранный оверлей — через Modal.
 */

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { TentLevel } from '@/engine/fair'
import type { ShiftSystem } from '@/engine/contracts'
import { Modal } from '@/ui/hud/Modal'
import { poolFromInventory } from './pool'
import { deriveSeed, initRun, type RunState } from './session'
import { ShiftScreen, type ShiftResult } from './ShiftScreen'
import { Receipt } from './Receipt'
import { T } from './theme'

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; run: RunState; startedAt: number }
  | { kind: 'receipt'; result: ShiftResult }

function clampTent(level: number | undefined): TentLevel {
  const l = Math.min(5, Math.max(1, Math.floor(level ?? 1)))
  return l as TentLevel
}

export function ShiftHost({ shiftSystem }: { shiftSystem?: ShiftSystem } = {}) {
  const serverNow = useStore((s) => s.serverNow)
  const inventory = useStore((s) => s.inventory)
  const stallLevel = useStore((s) => s.fair.stall?.level)
  const active = useStore((s) => s.ui.activePanel === 'ui_shift')
  const openPanel = useStore((s) => s.openPanel)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const pool = useMemo(() => poolFromInventory(inventory), [inventory])
  const tentLevel = clampTent(stallLevel)
  const canStart = pool.length > 0

  function start() {
    if (!canStart) return
    const startedAt = serverNow()
    const run = initRun({ seed: deriveSeed(startedAt), tentLevel, pool })
    setPhase({ kind: 'running', run, startedAt })
    openPanel('ui_shift')
  }

  // Панель закрыта извне (крестик/подложка/Escape/«Назад», см. Modal) — единый источник
  // истины `ui.activePanel` говорит «не активна», сбрасываем локальную фазу к idle, чтобы
  // следующее открытие начиналось с чистого гейта (провала нет, P3 — это не «слив» забега,
  // сервер ничего не терял: мутаций в adapter отсюда не уходит, см. TODO(shift-econ) ниже).
  useEffect(() => {
    if (!active && phase.kind !== 'idle') setPhase({ kind: 'idle' })
  }, [active, phase.kind])

  // Дип-линк/программное открытие панели (`?panel=ui_shift`) без активного забега — автостарт,
  // чтобы модалка не была пустой. Если стока нет (`!canStart`) — просто держим гейт-подсказку
  // внутри той же модалки (ниже, ветка idle) вместо запуска.
  useEffect(() => {
    if (active && phase.kind === 'idle' && canStart) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  function finishReceipt() {
    setPhase({ kind: 'idle' })
    openPanel(null)
  }

  const overlayBody =
    phase.kind === 'running' ? (
      <ShiftScreen
        initial={phase.run}
        startedAt={phase.startedAt}
        now={serverNow}
        onEnd={(result) => setPhase({ kind: 'receipt', result })}
        shiftSystem={shiftSystem}
      />
    ) : phase.kind === 'receipt' ? (
      <Receipt result={phase.result} onClose={finishReceipt} />
    ) : (
      <ShiftGate canStart={canStart} onStart={start} />
    )

  return (
    <>
      {/* idle — компактный старт-каркас (не блокирует орбит-камеру: pointer-events только
          на карточке). Живёт вне Modal — это триггер входа в панель, не сама панель. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 20,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          data-testid="shift-start-card"
          style={{
            pointerEvents: 'auto',
            background: T.cream,
            borderRadius: 14,
            padding: '12px 16px',
            textAlign: 'center',
            boxShadow: `0 6px 20px ${T.shadow}`,
            fontFamily: '"Courier New", ui-monospace, monospace',
            color: T.ink,
            maxWidth: 320,
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
            ✶ Прилавок открыт ✶
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>
            {canStart
              ? 'Собирай подносы под заказы гостей. Держи серию — чаевые ×2!'
              : 'Сначала наготовь блюд — смене нужен готовый сток.'}
          </div>
          <button
            data-testid="shift-start"
            onClick={start}
            disabled={!canStart}
            style={{
              background: canStart ? T.cherry : T.chromeDark,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 22px',
              fontWeight: 800,
              fontSize: 16,
              fontFamily: 'inherit',
              cursor: canStart ? 'pointer' : 'default',
              opacity: canStart ? 1 : 0.7,
              boxShadow: `0 2px 0 ${T.shadow}`,
            }}
          >
            Начать смену
          </button>
        </div>
      </div>

      {/* Полноэкранный оверлей активного забега/чека — общий каркас Modal (ui.activePanel). */}
      <Modal panelKey="ui_shift" title="Смена у прилавка" variant="fullscreen">
        {overlayBody}
      </Modal>
    </>
  )
}

/** Гейт «нужен сток» внутри модалки — тот же текст, что и на старт-карточке, но полноэкранно. */
function ShiftGate({ canStart, onStart }: { canStart: boolean; onStart: () => void }) {
  return (
    <div
      data-testid="shift-gate"
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
          maxWidth: 320,
          background: T.cream,
          borderRadius: 14,
          padding: '16px 20px',
          textAlign: 'center',
          color: T.ink,
          boxShadow: `0 6px 20px ${T.shadow}`,
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
          ✶ Прилавок открыт ✶
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>
          {canStart
            ? 'Собирай подносы под заказы гостей. Держи серию — чаевые ×2!'
            : 'Сначала наготовь блюд — смене нужен готовый сток.'}
        </div>
        <button
          data-testid="shift-gate-start"
          onClick={onStart}
          disabled={!canStart}
          style={{
            background: canStart ? T.cherry : T.chromeDark,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontWeight: 800,
            fontSize: 16,
            fontFamily: 'inherit',
            cursor: canStart ? 'pointer' : 'default',
            opacity: canStart ? 1 : 0.7,
            boxShadow: `0 2px 0 ${T.shadow}`,
          }}
        >
          Начать смену
        </button>
      </div>
    </div>
  )
}
